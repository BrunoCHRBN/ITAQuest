# Technical Diagnostics, Data Model, and Question Acquisition Proposal

[Versão em Português](PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md)

**Scope:** ITAQuest (React 19 + TypeScript + Vite + Express/Gemini).  
Technical diagnostic covering question archive organization, examination ingestion, normalized relational schema, empirical audit against the official ITA exam, and historical implementation logs.

To reproduce the diagnostic measurements in this document:

```bash
npx tsx scripts/probe-diagnostico.ts
```

All findings marked with **[measured]** were validated directly against the codebase and real exam data.

---

## Table of Contents

1. [System Location and Modules](#1-system-location-and-modules)
2. [Technical Baseline](#2-technical-baseline)
3. [Acquisition Diagnostics (F1 to F9)](#3-acquisition-diagnostics-f1-to-f9)
4. [Archive Organization Diagnostics (O1 to O9)](#4-archive-organization-diagnostics-o1-to-o9)
5. [Normalized Data Model](#5-normalized-data-model)
6. [Three-Wave Implementation Plan](#6-three-wave-implementation-plan)
7. [Automated Acceptance Criteria](#7-automated-acceptance-criteria)
8. [Real Examination Audit: ITA 2025 (Phase 1)](#8-real-examination-audit-ita-2025-phase-1)
9. [Execution Log and Test Results](#9-execution-log-and-test-results)
10. [Pending Items and Roadmap](#10-pending-items-and-roadmap)

---

## 1. System Location and Modules

The live application is hosted at `rotina-ita-app`:

| Path | Description |
|---|---|
| `rotina-ita-app` | Complete application (React frontend, Express backend in `server/`, business logic in `src/services/`). |
| `rotina-ita` | Legacy prototype repository (single 145 KB HTML file). Kept for historical reference. |

Core module map:

```text
src/types.ts                        # Type contracts for Question, QuestionSource, StudySession
src/services/questionService.ts     # Normalization, validation, deduplication, filters
src/services/importService.ts       # CSV and JSON parsers
src/services/storageService.ts      # localStorage persistence with quota handling
src/services/batchService.ts        # Import batch tracking and rollback service
server/geminiService.ts             # Multimodal extraction and deterministic reconciliation
server/jobManager.ts                # In-memory background job queue
server/index.ts                     # REST API routes (/api/extract/jobs)
src/components/views/BankPage.tsx   # Archive table, triage filters, selection
src/components/modals/GeminiImportModal.tsx  # Upload, monitoring, and review
src/components/modals/ImportConflictsModal.tsx # Import conflict resolution
```

---

## 2. Technical Baseline

- **Static Type Checking (`tsc --noEmit`):** zero errors.
- **Automated Test Suite (`vitest`):** 114 tests across 18 suites, all passing.
- **Version Control:** Git repository with atomic commits covering every implemented fix.

---

## 3. Acquisition Diagnostics (F1 to F9)

### F1 [Critical] Missing Printed Question Number Displaces Answer Keys **[measured]**
- **Issue:** When the model failed to detect a question number due to two-column formatting, the code defaulted to `idx + 1`. If an intermediate question was missed, subsequent questions inherited displaced keys, causing silent data corruption with an "official verified" appearance.
- **Implemented Fix:** Strict decoupling of `source.order` (reading sequence) from `source.questionNumber` (printed number on booklet). Without a printed number, questions receive no automatic key and enter quarantine (`validationState: 'incompleta'`), enforcing a uniqueness check (`Set(numbers).size === numbers.length`).

### F2 [Critical] Missing Total Question Count Verification
- **Issue:** The official answer key contains the exact question count. If the model extracted fewer questions than expected (e.g., 40 out of 48), the job concluded with apparent success, hiding missing questions.
- **Implemented Fix:** Use the official answer key as a count oracle (`expectedCount`). Discrepancies mark the job as `completed_with_gaps` and compute the exact list of missing numbers (`missing`).

### F3 [Critical] Inability to Edit and Silent Drop of Corrected Questions **[measured]**
- **Issue:** The app operated as write-once (no edit UI). Furthermore, the deduplication key included the full question statement; fixing missing alternatives did not change the key, so the corrected version was dropped silently as an existing duplicate.
- **Implemented Fix:** Added in-place editing (`AddQuestionModal` in edit mode) and upgraded the deduplication engine to detect version conflicts, presenting `ImportConflictsModal` for explicit human resolution (*Replace*, *Keep Both*, or *Ignore*).

### F4 [High] JSON Response Truncation on Large Booklets
- **Issue:** Sending an entire 30-to-60-page PDF in a single API call risks token exhaustion or invalid truncated JSON outputs.
- **Planned Mitigation:** Page-windowed chunking (e.g., 6 to 8 pages per request), incremental job persistence, and deterministic final merging.

### F5 [High] Immediate Deletion of Source PDF Files
- **Issue:** Synchronous file deletion during job cleanup prevented visual inspection of questions referencing diagrams and figures.
- **Planned Mitigation:** Local PDF retention and per-page PNG rasterization for side-by-side verification during triage.

### F6 [High] Loss of Answer Key Checksum Provenance **[measured]**
- **Issue:** The answer key SHA-256 checksum was computed in the job but never persisted on the `Question` entity.
- **Implemented Fix:** Added `answerKeyChecksum` to `QuestionSource` on all reconciled questions.

### F7 [Medium] Brazilian Excel Semicolon Delimiter Support
- **Issue:** Portuguese Excel exports CSV files with semicolons (`;`). Splitting solely on commas treated the entire row as a single column, failing the import.
- **Planned Mitigation:** Header-line delimiter detection (comma, semicolon, tab) and native `.xlsx` file ingestion.

### F8 [Low] Freeform Phase Naming Inconsistency
- **Issue:** Variations such as `'1ª fase'`, `'Primeira fase'`, and `'1a fase'` fragmented UI filters.
- **Solution:** Canonical enum representation (`1a_fase`, `2a_fase`, `caderno_unico`), preserving original text in a secondary label.

### F9 [Low] Placeholder Text in Discursive Explanations
- **Issue:** Inserting generic strings (such as `"Questão discursiva"`) into the `explanation` field.
- **Solution:** Explicit question type field (`type: 'objetiva' | 'discursiva'`), leaving `explanation` empty unless a genuine solution exists.

---

## 4. Archive Organization Diagnostics (O1 to O9)

### O1 [Critical] Validation State Ignored by User Interface **[measured]**
- **Issue:** Metadata such as `alerts` and `validationState` were stored on import but omitted from archive filter controls.
- **Implemented Fix:** Added the triage filter bar in `BankPage`, providing instant counters and filters for clean items, items with alerts, missing answer keys, figure references, incomplete entries, and annulled questions.

### O2 [Critical] Absence of In-Place Question Editing
- **Issue:** Without update capabilities, minor typos or formatting fixes required resetting and re-importing the entire database.
- **Implemented Fix:** Full edit action on the archive table, allowing corrections to statements, alternatives, keys, and metadata with schema validation upon save.

### O3 [Critical] Missing Import Batch Identity
- **Issue:** Without batch tracking, an accidental import of an incomplete booklet could not be cleanly rolled back.
- **Implemented Fix:** Created `batchService` and the `ImportBatch` model. Every import gets a batch ID, enabling single-click atomic rollback via "Undo Last Import".

### O4 [High] Topic Taxonomy Fragmentation
- **Issue:** Freeform `topic` strings produced fragmented filters (`"Álgebra"`, `"algebra"`, `"Álgebra Linear"`).
- **Planned Mitigation:** Controlled hierarchical catalog matching the official ITA syllabus, enabling syllabus coverage reporting.

### O5 [High] Diacritic-Sensitive Search Pitfalls **[measured]**
- **Issue:** Substring searches failed on non-accented user input (`"algebra"` did not match `"Álgebra"`).
- **Implemented Fix:** Built `textService` with `foldText` (NFD decomposition, diacritic stripping, lowercasing) for symmetrical query matching.

### O6 [High] False Positives and Negatives in Deduplication
- **Issue:** Deduplication keys based on raw statement text failed when mathematical symbols had minor formatting variations (e.g. `$v_0$` vs `v₀`), duplicating entries.
- **Implemented Fix:** Primary identity is defined by `(document, printedNumber)`. Statement text acts as a secondary conflict trigger, displaying the conflict modal instead of blindly dropping or duplicating.

### O7 [High] Storage Ceilings and Failure Modes in `localStorage` **[measured]**
- **Issue:** A complete ITA question averages 1,620 bytes. The 5 MB browser limit fits between 1,600 and 3,200 questions. Storage quota errors previously threatened state synchronization.
- **Implemented Fix:** Defended writes in `storageService` with quota catching and rollback. IndexedDB migration scheduled to support multiple full exam years with images.

### O8 [Medium] Uncalibrated Difficulty Estimates
- **Issue:** Basic/Intermediate/Advanced ratings were subjective estimates from language models.
- **Planned Mitigation:** Calibrate observed difficulty using real historical user accuracy across study sessions.

### O9 [Medium] Discursive Notes Locked to Individual Sessions
- **Issue:** User notes were isolated to individual `StudySession` records, preventing a unified question-level notebook.
- **Planned Mitigation:** Extract `QuestionNote` as a global entity tied to the question, showing all past attempts.

---

## 5. Normalized Data Model

The target schema for the relational database migration (Sprint 3 / PostgreSQL) is defined as follows:

```sql
CREATE TABLE documents (
  id VARCHAR(64) PRIMARY KEY,
  institution VARCHAR(32) NOT NULL,
  year INT NOT NULL,
  phase VARCHAR(32) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  checksum CHAR(64) UNIQUE NOT NULL,
  page_count INT,
  expected_count INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE import_batches (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) REFERENCES documents(id) ON DELETE CASCADE,
  job_id VARCHAR(64),
  prompt_version VARCHAR(32),
  model VARCHAR(64),
  status VARCHAR(32) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE topics (
  id VARCHAR(64) PRIMARY KEY,
  subject VARCHAR(32) NOT NULL,
  parent_id VARCHAR(64) REFERENCES topics(id),
  name VARCHAR(128) NOT NULL,
  aliases TEXT[]
);

CREATE TABLE questions (
  id VARCHAR(64) PRIMARY KEY,
  document_id VARCHAR(64) REFERENCES documents(id) ON DELETE CASCADE,
  question_number INT,
  source_order INT NOT NULL,
  batch_id VARCHAR(64) REFERENCES import_batches(id) ON DELETE SET NULL,
  type VARCHAR(16) NOT NULL DEFAULT 'objetiva',
  subject VARCHAR(32) NOT NULL,
  topic_id VARCHAR(64) REFERENCES topics(id),
  topic_raw VARCHAR(128),
  difficulty_suggested VARCHAR(16),
  difficulty_observed NUMERIC(3, 2),
  statement TEXT NOT NULL,
  explanation TEXT,
  validation_state VARCHAR(32) NOT NULL DEFAULT 'limpa',
  annulled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_document_question_number UNIQUE (document_id, question_number)
);

CREATE TABLE alternatives (
  id SERIAL PRIMARY KEY,
  question_id VARCHAR(64) REFERENCES questions(id) ON DELETE CASCADE,
  letter CHAR(1) NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT uq_question_letter UNIQUE (question_id, letter)
);

CREATE TABLE answer_keys (
  question_id VARCHAR(64) PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  letter CHAR(1) NOT NULL,
  source_file VARCHAR(255) NOT NULL,
  source_checksum CHAR(64) NOT NULL,
  item_number INT NOT NULL
);
```

---

## 6. Three-Wave Implementation Plan

### Wave 1: Structural Integrity and Corruption Prevention (COMPLETED)
1. Decoupled `source.order` from `source.questionNumber`; quarantined missing numbers (F1).
2. Audited coverage against official answer key counts (`expectedCount`, `missing`) (F2).
3. Added interactive deduplication conflict modal with diff resolution (F3).
4. Canonical search normalization via `foldText` (O5).
5. Propagated answer key SHA-256 checksums to question records (F6).
6. Added triage filter bar for `validationState` in the question bank (O1).
7. Added in-place question editing with schema revalidation (O2).
8. Implemented atomic batch rollback with `ImportBatch` (O3).
9. Full support for annulled questions (`annulled: true`) in scoring (A4).

### Wave 2: Maintainability and Storage Scalability
1. Client storage migration to IndexedDB, removing the 5 MB `localStorage` boundary (O7).
2. Support semicolon delimiter in CSV and parse native `.xlsx` files (F7).
3. Implement controlled topic taxonomy based on the ITA syllabus (O4).
4. Retain original PDFs and render per-page PNGs for diagram inspection (F5).

### Wave 3: Chunked Ingestion and Performance Calibration
1. Page-windowed PDF extraction with incremental job state persistence (F4).
2. Calculate observed difficulty from user performance statistics (O8).
3. Global question notebook (`QuestionNote`) decoupled from sessions (O9).

---

## 7. Automated Acceptance Criteria

Each integrity item is backed by regression tests:

| ID | Verified Condition |
|---|---|
| **F1** | Questions without printed numbers do not borrow adjacent numbers; duplicates are rejected by `Set`. |
| **F2** | Answer key with 48 items vs extraction of 40 yields `completed_with_gaps` and populated `missing` array. |
| **F3** | Re-importing a question with corrected alternatives returns 1 conflict and 0 fresh items in deduplication. |
| **F6** | `source.answerKeyChecksum` matches the answer key file hash exactly. |
| **O1** | Triage bar properly isolates clean items, alerts, and missing keys. |
| **O5** | Non-accented query (`"algebra"`) matches accented question topic (`"Álgebra"`). |
| **A4** | Questions flagged `annulled: true` count as correct answers and are included in score denominators. |

---

## 8. Real Examination Audit: ITA 2025 (Phase 1)

Audit conducted using official exam documents: `2025_fase1.pdf` (28 pages, 1.8 MB) and `gabarito_2025.pdf` (1 page).

### A1. Official Question Count
The exam booklet declares **48 multiple-choice questions** (12 Mathematics, 12 Physics, 12 Chemistry, 12 English), numbered 1 to 48. A ten-year archive of Phase 1 exams contains approximately 480 to 576 questions, comfortably within local capacity limits.

### A2. Unicode Normalization Fragmentation in Official PDF **[measured]**
The official PDF mixes two distinct Unicode normalization forms:
- Precomposed `"Questão"` occurrences (NFC): **24** (Mathematics and Chemistry).
- Decomposed `"Questão"` occurrences (NFD): **24** (Physics and English).

A standard `grep "Questão"` query discards 50% of the exam. The mandatory NFC normalization in `textService` eliminates this failure mode completely.

### A3. Limits of Plain-Text Extraction for Mathematical Notation
Direct text extraction fragments mathematical notation (exponents, radicals, and fractions collapse or lose operators). Multimodal visual structuring via Gemini is required to preserve formula syntax.

### A4. Authoritative Information in Official Answer Keys
The official answer key delivers three structural guarantees:
1. Exact count of 48 questions.
2. Subject boundaries strictly defined by question number (1–12 Math, 13–24 Physics, 25–36 Chemistry, 37–48 English).
3. Identification of annulled items: questions 9 and 18 were tagged with `(*)` and awarded as correct to all candidates.

### A5. Figure and Diagram Prevalence
**8 of the 48 questions (~17%)** explicitly reference diagrams, charts, or circuits. While critical for solving those 8 items, their presence does not block ingestion and triage of the remaining 40 questions.

---

## 9. Execution Log and Test Results

Historical commits addressing data integrity and feature additions:

| Commit | Scope | Description |
|---|---|---|
| `f2d5831` | Baseline | Git repository initialization and baseline test snapshot. |
| `9e0b44b` | Normalization | `textService`: NFC storage and diacritic-folded search (`foldText`). |
| `83fe28c` | Identity | Separation of `source.order` from `source.questionNumber`; answer key checksum propagation. |
| `ad87aa0` | Coverage | Answer key oracle audit with `completed_with_gaps` status reporting. |
| `32bc4e7` | Conflicts/Edit | Interactive conflict resolution modal and direct question editing. |
| `af8dad9` | Triage | Quick triage filter bar for `validationState` in the question bank. |
| `56e63c5` | Batches | `ImportBatch` entity, duplicate PDF warnings, and atomic batch rollback. |
| `4bd92e7` | Annulled | Annulled question support (`annulled: true`) scored as correct. |
| `387d5cd` | Documentation | Empirical diagnostics and verification logs. |

**Current Test Suite Status:** 114 passing tests (18 suites), static type checking clean, production build passing.

---

## 10. Pending Items and Roadmap

1. **F4 (Page-Chunked Extraction):** Segment PDF processing into 6-to-8 page windows with incremental state saves.
2. **F5 (Source File Retention):** Store uploaded PDFs locally and generate per-page PNG previews for diagram triage.
3. **F7 (Semicolon Delimiters and XLSX):** Support Brazilian CSV semicolon separators and direct `.xlsx` parsing.
4. **O4 (Syllabus Taxonomy):** Implement controlled topic taxonomy based on the official ITA entrance syllabus.
5. **O7 (IndexedDB Migration):** Transition client storage to IndexedDB to overcome browser `localStorage` quotas.
