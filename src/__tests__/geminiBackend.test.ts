import { describe, expect, it } from 'vitest';
import { reconcileExtractedData } from '../../server/geminiService';
import { cancelJob, createJob, getJob } from '../../server/jobManager';
import type { ExtractedQuestionRaw } from '../../server/types';
import fs from 'fs';
import path from 'path';

describe('Gemini Exam Extractor and Reconciliation (Sprint 2)', () => {
  it('reconciles extracted exam questions with separate official answer keys deterministically', () => {
    const rawQuestions: ExtractedQuestionRaw[] = [
      {
        questionNumber: 1,
        statement: 'Calcule a velocidade de escape da Terra.',
        alternatives: { A: '11.2 km/s', B: '7.9 km/s', C: '3.0 km/s', D: '1.5 km/s', E: '0.5 km/s' },
        suggestedSubject: 'Física',
        suggestedTopic: 'Gravitação',
        suggestedDifficulty: 'Intermediária',
        referencedFigures: [],
        page: 2,
        confidence: 'alta' as const,
      },
      {
        questionNumber: 2,
        statement: 'Conforme a Figura 1 abaixo, determine a corrente elétrica.',
        alternatives: { A: '1 A', B: '2 A', C: '3 A', D: '4 A', E: '5 A' },
        suggestedSubject: 'Física',
        suggestedTopic: 'Circuitos',
        suggestedDifficulty: 'Avançada',
        referencedFigures: ['Figura 1'],
        page: 2,
        confidence: 'alta' as const,
      },
      {
        questionNumber: 3,
        statement: 'Questão anulada pela banca examinadora.',
        alternatives: { A: 'Opção A', B: 'Opção B' },
        suggestedSubject: 'Matemática',
        page: 3,
      },
      {
        questionNumber: 4,
        statement: 'Questão sem gabarito oficial fornecido.',
        alternatives: { A: 'X', B: 'Y' },
        suggestedSubject: 'Química',
        page: 4,
      },
    ];

    const answerKeys = [
      { questionNumber: 1, officialAnswer: 'A', isCancelledOrAnnulled: false },
      { questionNumber: 2, officialAnswer: 'C', isCancelledOrAnnulled: false },
      { questionNumber: 3, isCancelledOrAnnulled: true, notes: 'Recurso deferido' },
      // questionNumber 4 has no key in the official key doc
    ];

    const { questions, reviewQueue } = reconcileExtractedData({
      rawQuestions,
      answerKeys,
      examFileName: 'ita-2024-1fase.pdf',
      examChecksum: 'abc123sha256',
      metadata: { institution: 'ITA', year: 2024, phase: '1ª fase' },
      promptVersion: 'ita-extractor-v1.0',
      model: 'gemini-3.8-flash',
    });

    expect(questions).toHaveLength(4);

    // Question 1: clean with official key
    const q1 = questions.find((q) => q.source.questionNumber === 1);
    expect(q1?.hasOfficialKey).toBe(true);
    expect(q1?.answerKey).toBe('A');
    expect(q1?.validationState).toBe('valida');
    expect(q1?.source.gabaritoOficialSource).toBe('Gabarito Oficial');
    expect(q1?.source.checksum).toBe('abc123sha256');

    // Question 2: has referenced figure alert -> should be in reviewQueue
    const q2 = questions.find((q) => q.source.questionNumber === 2);
    expect(q2?.hasOfficialKey).toBe(true);
    expect(q2?.answerKey).toBe('C');
    expect(q2?.validationState).toBe('com_alertas');
    expect(q2?.alerts.some((a) => a.includes('Figura 1'))).toBe(true);
    expect(reviewQueue.some((q) => q.source.questionNumber === 2)).toBe(true);

    // Question 3: cancelled in answer key -> has alert
    const q3 = questions.find((q) => q.source.questionNumber === 3);
    expect(q3?.answerKey).toBeUndefined();
    expect(q3?.alerts.some((a) => a.includes('anulada no gabarito oficial'))).toBe(true);
    expect(reviewQueue.some((q) => q.source.questionNumber === 3)).toBe(true);

    // Question 4: missing in answer key -> alert generated, answerKey is NOT inferred!
    const q4 = questions.find((q) => q.source.questionNumber === 4);
    expect(q4?.hasOfficialKey).toBe(false);
    expect(q4?.answerKey).toBeUndefined();
    expect(q4?.alerts.some((a) => a.includes('Não foi encontrado gabarito oficial'))).toBe(true);
  });

  it('manages jobs, tracking lifecycle and cancellation', () => {
    // Create temporary dummy file for job checksum calculation
    const tmpDir = path.resolve(__dirname, '../../server/uploads');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const dummyPath = path.join(tmpDir, `test-dummy-${Date.now()}.pdf`);
    fs.writeFileSync(dummyPath, '%PDF-1.4 dummy test content');

    const job = createJob({
      examFilePath: dummyPath,
      examFileName: 'dummy.pdf',
      metadata: { institution: 'ITA', year: 2024 },
    });

    expect(job.id).toBeDefined();
    expect(['queued', 'processing']).toContain(job.status);
    expect(job.examChecksum).toBeDefined();

    const retrieved = getJob(job.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(job.id);

    // Cancel job
    const cancelled = cancelJob(job.id);
    expect(cancelled).toBe(true);
    expect(getJob(job.id)?.status).toBe('cancelled');
  });
});
