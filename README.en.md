# Rotina ITA

[Versão em Português](README.md)

Web application for organizing question archives, assembling study sessions, and solving exam questions targeted at the Instituto Tecnológico de Aeronáutica (ITA) entrance examinations.

The user interface follows an academic editorial design: ivory background, deep teal, terracotta accents, serif typography for titles, high information density, and native mathematical formula rendering via KaTeX.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Implemented Features](#implemented-features)
- [Prerequisites and Installation](#prerequisites-and-installation)
- [Running the Project](#running-the-project)
- [Validation and Tests](#validation-and-tests)
- [Environment Configuration](#environment-configuration)
- [Repository Structure](#repository-structure)
- [Detailed Documentation](#detailed-documentation)

---

## Overview

The application addresses specific constraints of the ITA entrance exam preparation:
- High-complexity questions with complex mathematical notation and dense statements.
- Strict separation between multiple-choice and discursive questions.
- Comprehensive provenance tracking (year, phase, booklet identifier, printed question number).
- Invariant guarantee that official answer keys are never hallucinated or synthesized by artificial intelligence.

---

## Architecture

The system consists of three primary layers:

1. **Frontend (SPA):**
   - React 19 + TypeScript 5.9 + Vite 8.
   - Mathematical formula typesetting via KaTeX (`katex`).
   - SVG iconography via Lucide React (`lucide-react`).
   - Client-side persistence in `localStorage` with quota guards, canonical Unicode normalization (NFC), and schema versioning.

2. **Extraction Backend (Node.js/Express):**
   - Express 5 + TypeScript (`tsx`).
   - Official `@google/genai` SDK (Gemini 3.8 Flash model).
   - In-memory job manager (`server/jobManager.ts`) with cancellation and progress reporting.
   - Deterministic reconciliation between exam booklets and separate official answer keys (`server/geminiService.ts`).
   - Credential isolation: `GEMINI_API_KEY` exists strictly within the server execution context.

3. **Data Integrity Guarantees:**
   - **Stable Identity:** separation between extraction order (`source.order`) and the printed question number (`source.questionNumber`).
   - **Answer Key Oracle:** question counts and official answers are derived directly from the answer key document; mismatches flag a `completed_with_gaps` status and quarantine missing items.
   - **Unicode Normalization:** NFC persistence and diacritic-insensitive search (`foldText`) to prevent identical characters from becoming invisible across different Unicode forms.
   - **Conflict Management:** re-importing updated questions does not silently overwrite or drop changes; an interactive modal presents a side-by-side diff for user resolution (Replace, Keep Both, or Ignore).
   - **Reversibility:** imports generate batch records (`ImportBatch`) tagged with SHA-256 checksums, enabling atomic rollback of the latest batch.

---

## Implemented Features

### Question Archive and Triage
- Diacritic-insensitive and case-insensitive full-text search.
- Filter criteria by subject, difficulty level, source institution, and examination year.
- **Validation Triage Bar (`validationState`):** direct counters and quick filters for clean questions, items with structural alerts, missing answer keys, figure references, incomplete entries, and annulled questions.
- In-place question editing with schema revalidation upon saving.
- Individual question deletion and confirmed archive reset.

### Study Sessions and Mock Exams
- Custom session configuration through manual selection or archive filtering.
- **Practice Mode (`Treino`):** instant verification showing the official answer key and explanation immediately after an answer is submitted.
- **Mock Exam Mode (`Simulado`):** answer keys hidden until completion, countdown timer with automatic submission upon time exhaustion.
- Quick navigation via direct question grid and keyboard shortcuts:
  - `1` to `5` or `A` to `E`: select alternative.
  - `Arrow Left / Arrow Right` or `J / K`: previous and next question.
  - `M`: toggle review flag.
- Integrated official ITA physical and chemical constants sheet with quick search.
- Continuous auto-save of user responses, session state, and discursive work.
- Post-session performance breakdown: time spent per question, accuracy rate, and targeted review shortcuts.

### Exam Ingestion and Parsing
- **Gemini Multimodal Ingestion (PDF):**
  - Independent uploads for the exam question booklet and the official answer key PDF.
  - Multimodal text extraction and schema mapping.
  - Validation against the expected question count reported by the answer key.
  - Automatic detection of annulled questions (`annulled: true`), counted as correct and included in both numerator and denominator for scoring.
  - SHA-256 file hashing to warn against duplicate ingestions.
  - Interactive conflict resolution modal when incoming items overlap with existing records.
- **Structured JSON / CSV Ingestion:**
  - Support for English and Portuguese field names.
  - Strict validation of alternative sets and minimum required fields.
- **Batch Undo:** single-click rollback of the latest imported batch without modifying previously saved data.

### Backup and Restore
- Complete JSON export containing questions, session histories, notes, user responses, and import batches.
- Import support with **Merge** (`merge`) or **Full Replace** (`replace`) strategies.

---

## Prerequisites and Installation

- **Node.js:** version 22.12.0 or higher.
- **npm:** version 10 or higher.

Clone the repository and install dependencies:

```bash
git clone https://github.com/BrunoCHRBN/rotina-ita-app.git
cd rotina-ita-app
npm install
```

---

## Running the Project

### Frontend-Only Mode (Local Archive and Sessions)

Starts the Vite development server on port `5173`:

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

### Full Mode (Frontend + Gemini Extraction Backend)

In separate terminals:

```bash
# Terminal 1: PDF Extraction Backend (port 3001)
npm run server

# Terminal 2: Vite Dev Server (port 5173 with proxy configured for /api)
npm run dev
```

---

## Validation and Tests

The repository maintains an automated suite of 114 tests covering services, UI components, and backend integration:

```bash
# Static type checking
npm run typecheck

# Execute complete test suite (Vitest)
npm test

# Production build
npm run build

# Preview production build
npm run preview
```

To run the data integrity and empirical diagnostic probe:

```bash
npx tsx scripts/probe-diagnostico.ts
```

---

## Environment Configuration

To enable automated PDF extraction using the Gemini API:

1. Create `server/.env` based on the template:
   ```bash
   cp .env.example server/.env
   ```
2. Set required environment variables:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   PORT=3001
   ```

> **Security Note:** `server/.env` is tracked in `.gitignore` and must never be committed. Do not expose API credentials in client-side code (`src/`).

---

## Repository Structure

```text
rotina-ita-app/
├── index.html                  # HTML entry point
├── package.json                # Project dependencies and npm scripts
├── vite.config.ts              # Vite configuration with /api reverse proxy
├── tsconfig.json               # TypeScript configuration
├── .env.example                # Template for server environment variables
├── docs/                       # Technical documentation
│   ├── ARQUITETURA.md          # System architecture and data invariants (PT)
│   ├── ARCHITECTURE.md         # System architecture and data invariants (EN)
│   ├── PROPOSTA_ORGANIZACAO_E_AQUISICAO_DE_QUESTOES.md # Diagnostic & roadmap (PT)
│   ├── QUESTION_ACQUISITION_AND_ORGANIZATION.md        # Technical proposal (EN)
│   ├── GUIA_DESENVOLVIMENTO.md # Developer and agent guidelines (PT)
│   └── DEVELOPMENT_GUIDE.md    # Developer and agent workflow guide (EN)
├── scripts/
│   └── probe-diagnostico.ts    # Integrity diagnostics and empirical probe script
├── server/                     # Multimodal extraction backend
│   ├── index.ts                # Express server and /api routes
│   ├── jobManager.ts           # In-memory processing queue manager
│   ├── geminiService.ts        # Extraction, reconciliation, and answer key oracle
│   ├── integrity.ts            # SHA-256 checksum computation
│   └── types.ts                # Server-specific type contracts
├── src/                        # Client-side React application
│   ├── main.tsx                # Application bootstrap
│   ├── App.tsx                 # Internal routing and top-level state
│   ├── styles.css              # Academic editorial design system styles
│   ├── types.ts                # Core domain types
│   ├── components/             # Modular UI components
│   │   ├── layout/             # Shell, sidebar, header, navigation
│   │   ├── views/              # Views (Bank, Session, Resolver, Overview)
│   │   ├── modals/             # Modals (Gemini Upload, Conflict Diff, Edit)
│   │   ├── question/           # KaTeX renderer, alternatives, status badges
│   │   └── session/            # Stopwatch, constants sheet, question matrix
│   ├── services/               # Business logic and persistence services
│   │   ├── textService.ts      # Canonical NFC normalization and foldText search
│   │   ├── questionService.ts  # Deduplication, validation rules, bank filters
│   │   ├── sessionService.ts   # Session lifecycle and score calculation
│   │   ├── scoringService.ts   # Score math and annulled question logic
│   │   ├── storageService.ts   # Resilient localStorage persistence
│   │   ├── batchService.ts     # Batch management and rollback operations
│   │   ├── backupService.ts    # JSON backup export and restore
│   │   └── importService.ts    # JSON and CSV parsers
│   └── __tests__/              # 18 test suites with 114 automated tests
└── examples/
    └── import-template.json    # Canonical JSON schema template for imports
```

---

## Detailed Documentation

- [System Architecture and Data Invariants](docs/ARCHITECTURE.md)
- [Diagnostic, Technical Proposal, and ITA Exam Audit](docs/QUESTION_ACQUISITION_AND_ORGANIZATION.md)
- [Developer Workflow Guide and Roadmap](docs/DEVELOPMENT_GUIDE.md)
- [Portuguese Documentation Index](README.md)
