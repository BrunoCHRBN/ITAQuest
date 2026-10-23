import { describe, expect, it } from 'vitest';
import {
  calculateOverviewStats,
  calculateSessionStats,
  calculateSubjectStats,
  formatDate,
  formatDuration,
  getQuestionResolutionMap,
} from '../services/scoringService';
import type { Question, StudySession, Subject } from '../types';

describe('scoringService', () => {
  const dummyQuestions: Question[] = [
    {
      id: 'q1',
      subject: 'Matemática',
      topic: 'Álgebra',
      difficulty: 'Básica',
      statement: 'Questão 1',
      alternatives: { A: '1', B: '2' },
      answerKey: 'A',
      source: { label: 'ITA' },
      tags: [],
      createdAt: '2026-01-01',
    },
    {
      id: 'q2',
      subject: 'Matemática',
      topic: 'Álgebra',
      difficulty: 'Básica',
      statement: 'Questão 2',
      alternatives: { A: '1', B: '2' },
      answerKey: 'B',
      source: { label: 'ITA' },
      tags: [],
      createdAt: '2026-01-01',
    },
    {
      id: 'q3-discursive',
      subject: 'Física',
      topic: 'Mecânica',
      difficulty: 'Avançada',
      statement: 'Questão Discursiva',
      alternatives: {},
      source: { label: 'ITA' },
      tags: [],
      createdAt: '2026-01-01',
    },
  ];

  it('calculates session score, acertos, erros e questões discursivas', () => {
    const session: StudySession = {
      id: 's1',
      title: 'Treino Teste',
      mode: 'treino',
      status: 'concluída',
      questionIds: ['q1', 'q2', 'q3-discursive'],
      responses: {
        q1: { selectedOption: 'A', notes: '', markedForReview: false, checked: true }, // Correct
        q2: { selectedOption: 'A', notes: '', markedForReview: true, checked: true }, // Wrong (key is B)
        'q3-discursive': { notes: 'Minha resolução discursiva passo a passo', markedForReview: false, checked: false }, // Answered discursive
      },
      currentIndex: 0,
      createdAt: '2026-01-01',
      elapsedSeconds: 150,
    };

    const stats = calculateSessionStats(session, dummyQuestions);
    expect(stats.total).toBe(3);
    expect(stats.answeredCount).toBe(3);
    expect(stats.unansweredCount).toBe(0);
    expect(stats.withKeyCount).toBe(2);
    expect(stats.correctCount).toBe(1);
    expect(stats.wrongCount).toBe(1);
    expect(stats.accuracy).toBe(50); // 1 / 2 = 50%
    expect(stats.markedCount).toBe(1);
  });

  it('handles unanswered and missing keys gracefully', () => {
    const session: StudySession = {
      id: 's2',
      title: 'Em branco',
      mode: 'treino',
      status: 'concluída',
      questionIds: ['q1', 'q2'],
      responses: {},
      currentIndex: 0,
      createdAt: '2026-01-01',
    };

    const stats = calculateSessionStats(session, dummyQuestions);
    expect(stats.answeredCount).toBe(0);
    expect(stats.unansweredCount).toBe(2);
    expect(stats.correctCount).toBe(0);
    expect(stats.accuracy).toBe(0);
  });

  it('formats durations in hh:mm:ss format', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration(65)).toBe('00:01:05');
    expect(formatDuration(3661)).toBe('01:01:01');
  });

  it('formats dates in pt-BR locale', () => {
    expect(formatDate(undefined)).toBe('—');
    const formatted = formatDate('2026-10-18T12:00:00.000Z');
    expect(formatted).toContain('2026');
  });

  it('calculates overview statistics across completed sessions', () => {
    const completedSession: StudySession = {
      id: 's-comp',
      title: 'Sessão Concluída',
      mode: 'treino',
      status: 'concluída',
      questionIds: ['q1', 'q2'],
      responses: {
        q1: { selectedOption: 'A', notes: '', markedForReview: false, checked: true },
        q2: { selectedOption: 'B', notes: '', markedForReview: true, checked: true },
      },
      currentIndex: 1,
      createdAt: '2026-10-18T10:00:00.000Z',
      finishedAt: new Date().toISOString(),
    };

    const stats = calculateOverviewStats([completedSession], dummyQuestions);
    expect(stats.completedSessionsCount).toBe(1);
    expect(stats.todayQuestionCount).toBe(2);
    expect(stats.overallAccuracy).toBe(100);
    expect(stats.totalAnswered).toBe(2);
    expect(stats.reviewItemsCount).toBe(1);
  });

  it('calculates subject stats accurately', () => {
    const session: StudySession = {
      id: 's-subj',
      title: 'Por matéria',
      mode: 'treino',
      status: 'concluída',
      questionIds: ['q1', 'q2', 'q3-discursive'],
      responses: {
        q1: { selectedOption: 'A', notes: '', markedForReview: false, checked: true },
        q2: { selectedOption: 'A', notes: '', markedForReview: false, checked: true },
      },
      currentIndex: 0,
      createdAt: '2026-01-01',
    };

    const subjects: Subject[] = ['Matemática', 'Física'];
    const stats = calculateSubjectStats([session], dummyQuestions, subjects);

    const mat = stats.find((s) => s.subject === 'Matemática');
    expect(mat?.count).toBe(2);
    expect(mat?.accuracy).toBe(50); // 1 correct of 2
  });

  it('builds question resolution map accurately from sessions', () => {
    const session: StudySession = {
      id: 's-res',
      title: 'Mapeamento',
      mode: 'treino',
      status: 'concluída',
      questionIds: ['q1', 'q2'],
      responses: {
        q1: { selectedOption: 'A', notes: '', markedForReview: false, checked: true },
        q2: { selectedOption: 'A', notes: '', markedForReview: true, checked: true },
      },
      currentIndex: 0,
      createdAt: '2026-01-01',
    };

    const statusMap = getQuestionResolutionMap([session], dummyQuestions);
    const q1Status = statusMap.get('q1');
    const q2Status = statusMap.get('q2');

    expect(q1Status?.answered).toBe(true);
    expect(q1Status?.isCorrect).toBe(true);
    expect(q1Status?.isWrong).toBe(false);

    expect(q2Status?.answered).toBe(true);
    expect(q2Status?.isCorrect).toBe(false);
    expect(q2Status?.isWrong).toBe(true); // AnswerKey is 'B', student chose 'A'
    expect(q2Status?.markedForReview).toBe(true);
  });
});
