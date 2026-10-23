import { describe, expect, it } from 'vitest';
import { calculateSessionStats, calculateOverviewStats } from '../services/scoringService';
import { reconcileExtractedData } from '../../server/geminiService';
import type { Question, StudySession } from '../types';

const q = (over: Partial<Question>): Question => ({
  id: 'q',
  subject: 'Física',
  topic: 'Mecânica',
  difficulty: 'Avançada',
  statement: 'enunciado',
  alternatives: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
  answerKey: 'A',
  source: { label: 'ITA', year: 2025, questionNumber: 1 },
  tags: [],
  createdAt: '2026-01-01',
  ...over,
});

const session = (questionIds: string[], responses: StudySession['responses']): StudySession => ({
  id: 's1',
  title: 's',
  mode: 'simulado',
  status: 'concluída',
  questionIds,
  responses,
  currentIndex: 0,
  createdAt: '2026-01-01',
  finishedAt: '2026-01-01',
});

describe('anulada — estado próprio, não "sem gabarito"', () => {
  it('a reconciliação marca annulled e não inventa gabarito', () => {
    const { questions } = reconcileExtractedData({
      examFileName: 'ita-2025.pdf',
      examChecksum: 'sha',
      metadata: { institution: 'ITA', year: 2025, phase: '1ª fase' },
      promptVersion: 'v1.2',
      model: 'x',
      rawQuestions: [
        {
          questionNumber: 9,
          statement: 'Questão anulada.',
          alternatives: { A: 'a', B: 'b' },
          confidence: 'alta',
        },
      ],
      answerKeys: [{ questionNumber: 9, isCancelledOrAnnulled: true }],
    });

    expect(questions[0].annulled).toBe(true);
    expect(questions[0].answerKey).toBeUndefined();
    expect(questions[0].alerts[0]).toContain('correta para todos');
  });
});

describe('pontuação da questão anulada', () => {
  const anulada = q({ id: 'anulada', answerKey: undefined, annulled: true, source: { label: 'ITA', questionNumber: 9 } });
  const normal = q({ id: 'normal', answerKey: 'B', source: { label: 'ITA', questionNumber: 10 } });

  it('marcar qualquer alternativa conta como acerto', () => {
    const stats = calculateSessionStats(
      session(['anulada'], { anulada: { selectedOption: 'E', notes: '', markedForReview: false, checked: true } }),
      [anulada]
    );
    expect(stats.correctCount).toBe(1);
    expect(stats.wrongCount).toBe(0);
    expect(stats.withKeyCount).toBe(1);
  });

  it('entra no denominador: a nota é sobre 48, não sobre 46', () => {
    const stats = calculateSessionStats(
      session(['anulada', 'normal'], {
        anulada: { selectedOption: 'C', notes: '', markedForReview: false, checked: true },
        normal: { selectedOption: 'A', notes: '', markedForReview: false, checked: true }, // errou
      }),
      [anulada, normal]
    );
    // 1 acerto (anulada) de 2 questões avaliáveis
    expect(stats.withKeyCount).toBe(2);
    expect(stats.correctCount).toBe(1);
    expect(stats.wrongCount).toBe(1);
    expect(stats.accuracy).toBe(50);
  });

  it('não é contada como erro nem como ausência de gabarito', () => {
    const stats = calculateSessionStats(
      session(['anulada'], { anulada: { selectedOption: 'D', notes: '', markedForReview: false, checked: true } }),
      [anulada]
    );
    expect(stats.items[0].hasKey).toBe(true);
    expect(stats.items[0].isWrong).toBe(false);
  });

  it('o painel geral usa a mesma regra', () => {
    const overview = calculateOverviewStats(
      [
        session(['anulada', 'normal'], {
          anulada: { selectedOption: 'A', notes: '', markedForReview: false, checked: true },
          normal: { selectedOption: 'B', notes: '', markedForReview: false, checked: true },
        }),
      ],
      [anulada, normal]
    );
    expect(overview.totalGraded).toBe(2);
    expect(overview.totalCorrect).toBe(2);
    expect(overview.overallAccuracy).toBe(100);
  });
});
