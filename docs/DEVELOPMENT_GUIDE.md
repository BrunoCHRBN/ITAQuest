# Developer and Contribution Guide

[Versão em Português](GUIA_DESENVOLVIMENTO.md)

This document provides operational guidelines for developers and autonomous agents working on the **ITAQuest** codebase.

---

## 1. Engineering and Design Rules

1. **Academic Editorial Design System:**
   - Color palette: ivory background (`#faf8f5`), deep teal (`#1a3a3a`), controlled terracotta accents (`#c85a32`), and neutral gray borders.
   - Typography: serif fonts for primary section headings, neutral and legible sans-serif for statements and tables.
   - UI density: prioritize information density, omit decorative cards, avoid bright neon gradients, and omit glassmorphism effects.

2. **Automated Verification and Regression Safety:**
   - Before committing any changes, run:
     ```bash
     npm run typecheck
     npm test
     ```
   - The test suite comprises 114 automated tests across 18 files. All tests must pass. Any new feature or bugfix requires corresponding unit tests.

3. **Input Focus Retention:**
   - Form inputs, discursive textareas, and modal fields must never lose cursor focus or reset internal state during user typing or re-renders (`componentsFocus.test.tsx`).

4. **Credential Isolation:**
   - Never import environment variables containing API credentials in client-side code (`src/`).
   - All AI interactions run exclusively through the Express backend (`server/`), reading secrets from `server/.env`.

5. **Canonical Data Integrity:**
   - Ingested statements and alternatives must be stored in Unicode NFC canonical form (`normalize('NFC')`).
   - Searches must use `foldText` to guarantee diacritic-insensitive matching.
   - Official answer keys are immutable and authoritative; language models must never hallucinate or override official answers.

---

## 2. Developer Workflow and Commands

### Dependency Installation

```bash
npm install
```

### Local Development

```bash
# Start frontend in development mode (port 5173 with proxy to backend)
npm run dev

# Start backend PDF extraction service (port 3001)
npm run server
```

### Type Checking and Tests

```bash
# TypeScript static validation
npm run typecheck

# Full Vitest test suite execution
npm test

# Continuous watch mode
npm run test:watch

# Empirical diagnostic probe
npx tsx scripts/probe-diagnostico.ts
```

### Production Build and Preview

```bash
npm run build
npm run preview
```

---

## 3. Prioritized Technical Backlog

### Priority 1: Ingestion and Formats (Wave 2)
- **F7: Semicolon CSV Delimiters and Excel (.xlsx) Support:**
  - Update `importService.ts` to auto-detect header delimiters (`,`, `;`, `\t`).
  - Add lightweight parsing for `.xlsx` spreadsheets commonly used in exam prep courses.
- **F5: Local PDF Retention and PNG Page Previews:**
  - Persist source PDFs in a dedicated directory (`server/documents/`).
  - Render page thumbnails for side-by-side verification of questions referencing figures.

### Priority 2: Storage Scalability
- **O7: IndexedDB Engine Migration:**
  - Replace the `localStorage` backend in `storageService.ts` with an asynchronous IndexedDB adapter.
  - Eliminate browser 5 MB storage limits, accommodating full exam decades.

### Priority 3: Syllabus and Taxonomy
- **O4: Structured ITA Syllabus Taxonomy:**
  - Create a hierarchical syllabus catalog (`src/data/itaTopics.ts`) based on the official ITA exam notice.
  - Map incoming topics to canonical IDs to generate coverage reports.

### Priority 4: Chunked Extraction (Wave 3)
- **F4: Windowed PDF Ingestion:**
  - Segment 30-to-60 page booklets into 6-to-8 page chunks per API call.
  - Store partial extractions in `jobManager` to support error recovery and resumes.
