# System Architecture and Data Invariants

[Versão em Português](ARQUITETURA.md)

This document establishes the architectural decisions, domain models, and integrity invariants of the **Rotina ITA** project.

---

## 1. Design Principles

1. **Separation of Content and User Activity:**  
   The `Question` record exclusively models question statements, provenance metadata, and the official answer key. Student progress, selected alternatives, and discursive notes reside in `ResponseRecord`, encapsulated within `StudySession`.

2. **Official Answer Key as an Authoritative Oracle:**  
   Language models are never treated as sources of truth for examination answer keys. Official keys are ingested from a separate official document (`answerKeyPdf`). If a question lacks a key in the official document, its validation state is marked as `sem_gabarito` (missing key), and it never receives an AI-generated guess.

3. **Coverage Verification by Count:**  
   The total number of entries in the official answer key defines the expected question count for the examination. Any mismatch between extracted questions and the official count produces a `completed_with_gaps` job status, isolating missing question numbers in an explicit `missing` list.

4. **Stable Identity and Non-Ambiguity:**  
   The extraction order within a document (`source.order`) is strictly decoupled from the printed question number (`source.questionNumber`). If the printed number cannot be parsed, the question remains with `questionNumber: undefined` and is placed into quarantine (`incompleta`), preventing it from borrowing the answer key of an adjacent item.

5. **Authoritative Handling of Annulled Questions:**  
   Questions officially annulled by the examination board (`annulled: true`) remain in the database, count as correct for the student, and are included in both the numerator and denominator across all score calculations (`scoringService`).

6. **Canonical Character Normalization:**  
   All ingested texts are normalized to Unicode NFC (`normalize('NFC')`). Search indexes and deduplication keys apply a diacritic-folded projection (`foldText`), preventing identical text fragments from becoming segregated across incompatible Unicode forms (NFC vs NFD).

7. **Strict Credential Containment:**  
   Communication with the Gemini API is restricted to the Node.js backend (`server/`). No API keys or sensitive environment variables are ever included in the client browser bundle.

---

## 2. Domain Data Model

### 2.1 Core Entities (`src/types.ts`)

```ts
// Structural validation state
export type QuestionValidationState =
  | 'limpa'           // Complete structure and verified official answer key
  | 'com_alertas'     // Structural alerts (e.g. missing alternatives)
  | 'sem_gabarito'    // Missing answer key in official document
  | 'referencia_figura' // Refers to an image, diagram, or chart in the PDF
  | 'incompleta'      // Missing printed question number or parse failure
  | 'anulada';        // Officially annulled by examination board

// Canonical question entity
export interface Question {
  id: string;
  subject: Subject;              // Mathematics, Physics, Chemistry, etc.
  topic: string;                 // Subject topic
  difficulty: Difficulty;        // Basic, Intermediate, Advanced
  statement: string;             // Statement text (rendered via KaTeX)
  alternatives: Record<string, string>; // { A: '...', B: '...', ... }
  answerKey?: string;            // Official letter (A-E)
  explanation?: string;          // Worked solution or commentary
  source: QuestionSource;        // Provenance and indexing
  tags: string[];
  createdAt: string;
  hasOfficialKey?: boolean;
  validationState?: QuestionValidationState;
  alerts?: string[];
  importBatchId?: string;        // Batch ID enabling rollback
  annulled?: boolean;            // Annulled question flag
}

// Provenance and stable identifiers
export interface QuestionSource {
  label: string;                 // Institution (e.g., 'ITA')
  year: number;                  // Exam year
  phase?: string;                // '1ª fase', '2ª fase'
  questionNumber?: number;       // Printed number from booklet
  order?: number;                // Extraction sequence order
  fileName?: string;             // Processed PDF file name
  page?: number;                 // Page number in PDF
  examChecksum?: string;         // SHA-256 hash of exam PDF
  answerKeyChecksum?: string;    // SHA-256 hash of answer key PDF
}

// Trackable import batch
export interface ImportBatch {
  id: string;                    // batch-{timestamp}-{hash}
  timestamp: string;             // ISO date-time
  sourceFileName: string;        // Original file name
  sourceChecksum: string;        // SHA-256 hash
  totalImported: number;         // Count of questions in batch
  questionIds: string[];         // Imported question IDs
}

// Study session entity
export interface StudySession {
  id: string;
  title: string;
  mode: 'treino' | 'simulado';
  questionIds: string[];
  currentQuestionIndex: number;
  responses: Record<string, ResponseRecord>;
  startedAt: string;
  completedAt?: string;
  durationSeconds: number;
  timeLimitMinutes?: number;     // Mock exam mode only
}

// Individual response record
export interface ResponseRecord {
  questionId: string;
  selectedAlternative?: string;
  discursiveAnswer?: string;
  isCorrect?: boolean;
  timeSpentSeconds: number;
  markedForReview: boolean;
  notes?: string;
}
```

---

## 3. Exam Ingestion Pipeline

The examination parsing lifecycle runs across four deterministic phases:

```text
[Exam PDF] ---------> [ Gemini 3.8 Flash ] -------> [ Structured Questions ]
                                                            │
[Answer Key PDF] ---> [ Deterministic Parser ] ---> [ Official Keys ]
                                                            │
                                                            ▼
                                              [ Reconciliation & Oracle ]
                                                            │
                                              ┌─────────────┴─────────────┐
                                              ▼                           ▼
                                    [ Coverage Audit ]           [ Deduplication Check ]
                                    (Gaps & Annulled items)      (Version Conflicts)
                                              │                           │
                                              └─────────────┬─────────────┘
                                                            ▼
                                              [ Review & Decision Modal ]
                                                            │
                                                            ▼
                                              [ Storage with Batch Tag ]
```

### 3.1 Phase 1: File Ingestion
- The user provides two separate documents: the exam question booklet and the official answer key.
- The server computes SHA-256 hashes for both files to enforce idempotence and provenance tracking.
- The system checks if the booklet hash matches an existing batch, warning the user against duplicate imports.

### 3.2 Phase 2: Extraction and Deterministic Reconciliation
- The multimodal model extracts question text, formatting equations for KaTeX rendering.
- The official answer key is extracted independently to build an authoritative `(questionNumber -> letter)` mapping.
- Reconciliation matches answers strictly on `questionNumber`. If a question number was omitted during parsing, no answer is assigned by index unless the total counts match bijectively.

### 3.3 Phase 3: Oracle Audit and Conflict Management
- The line count of the official answer key acts as the completeness oracle (`expectedCount`). If questions are missing, the job status becomes `completed_with_gaps` and the missing numbers are quarantined.
- Items marked with asterisks or annulment footnotes in the answer key are tagged as `annulled: true`.
- When checked against the local database:
  - Questions sharing the same document and question number but containing textual differences are routed to `ImportConflictsModal`.
  - The user explicitly chooses to **Replace**, **Keep Both**, or **Ignore** the incoming record.

### 3.4 Phase 4: Persistence and Batching
- Accepted questions are written to the database with a linked `importBatchId`.
- If an import yields structural extraction issues, the **Undo Last Import** action removes the entire batch atomically without disturbing existing questions or study history.

---

## 4. Persistence and Operational Boundaries

### 4.1 Current Implementation: `localStorage`
- Uses versioned keys (`rotina_ita_questions_v1`, `rotina_ita_sessions_v1`, etc.).
- Writes are guarded by `try/catch` handlers monitoring `QuotaExceededError`.
- Storage failures trigger user alerts while keeping the in-memory state safe from partial write corruption.
- Practical capacity: ~1,600 to ~3,200 full questions (assuming standard 5 MB per-origin limits).

### 4.2 Next Milestone: IndexedDB / Relational Database Migration
- To support decades of ITA and IME exam archives along with page-level figure clippings, storage will migrate to IndexedDB in the browser, followed by a normalized relational database (PostgreSQL).
- The detailed schema design is documented in `docs/QUESTION_ACQUISITION_AND_ORGANIZATION.md`.
