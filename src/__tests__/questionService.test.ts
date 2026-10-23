import { describe, expect, it } from 'vitest';
import {
  deduplicateQuestions,
  filterQuestions,
  normalizeQuestion,
  validateQuestion,
} from '../services/questionService';
import type { Question } from '../types';

describe('questionService', () => {
  it('normalizes raw object to full Question structure', () => {
    const raw = {
      enunciado: 'Resolva a integral.',
      materia: 'Matemática',
      assunto: 'Cálculo',
      dificuldade: 'difícil',
      alternativas: ['1', '2', '3', '4', '5'],
      gabarito: 'C',
    };

    const q = normalizeQuestion(raw);
    expect(q).not.toBeNull();
    expect(q!.statement).toBe('Resolva a integral.');
    expect(q!.subject).toBe('Matemática');
    expect(q!.difficulty).toBe('Avançada');
    expect(q!.alternatives).toEqual({ A: '1', B: '2', C: '3', D: '4', E: '5' });
    expect(q!.answerKey).toBe('C');
  });

  it('validates required statement and alternatives rules', () => {
    const missingStatement = validateQuestion({ statement: '' });
    expect(missingStatement.valid).toBe(false);
    expect(missingStatement.errors[0]).toContain('enunciado');

    const singleAlt = validateQuestion({
      statement: 'Enunciado ok',
      alternatives: { A: 'Unica' },
    });
    expect(singleAlt.valid).toBe(false);
    expect(singleAlt.errors[0]).toContain('duas alternativas');

    const invalidKey = validateQuestion({
      statement: 'Enunciado ok',
      alternatives: { A: 'A', B: 'B' },
      answerKey: 'C',
    });
    expect(invalidKey.valid).toBe(false);
    expect(invalidKey.errors[0]).toContain('Gabarito "C"');

    const validDiscursive = validateQuestion({
      statement: 'Questão discursiva válida.',
      alternatives: {},
    });
    expect(validDiscursive.valid).toBe(true);
  });

  it('deduplicates questions by source label, year, questionNumber and statement', () => {
    const existing: Question[] = [
      {
        id: 'q1',
        subject: 'Física',
        topic: 'Óptica',
        difficulty: 'Intermediária',
        statement: 'Calcule o índice de refração do vidro.',
        alternatives: { A: '1.5', B: '2.0' },
        answerKey: 'A',
        source: { label: 'ITA', year: 2020, questionNumber: 1 },
        tags: [],
        createdAt: '2026-01-01',
      },
    ];

    const incoming: Question[] = [
      {
        id: 'q1-dup',
        subject: 'Física',
        topic: 'Óptica',
        difficulty: 'Intermediária',
        statement: '  CALCULE O ÍNDICE DE REFRAÇÃO DO VIDRO.  ', // casing & whitespace variation
        alternatives: { A: '1.5', B: '2.0' },
        answerKey: 'A',
        source: { label: 'ita', year: 2020, questionNumber: 1 },
        tags: [],
        createdAt: '2026-01-02',
      },
      {
        id: 'q2-fresh',
        subject: 'Física',
        topic: 'Termologia',
        difficulty: 'Básica',
        statement: 'Calcule o calor específico.',
        alternatives: { A: '1 cal/g°C', B: '0.5 cal/g°C' },
        answerKey: 'A',
        source: { label: 'ITA', year: 2020, questionNumber: 2 },
        tags: [],
        createdAt: '2026-01-02',
      },
    ];

    const { fresh, duplicatesCount } = deduplicateQuestions(existing, incoming);
    expect(duplicatesCount).toBe(1);
    expect(fresh).toHaveLength(1);
    expect(fresh[0].statement).toBe('Calcule o calor específico.');
  });

  it('filters questions accurately by query, subject, difficulty, and source', () => {
    const list: Question[] = [
      {
        id: 'q1',
        subject: 'Matemática',
        topic: 'Matrizes',
        difficulty: 'Básica',
        statement: 'Determine o determinante.',
        alternatives: {},
        source: { label: 'ITA' },
        tags: ['álgebra linear'],
        createdAt: '2026-01-01',
      },
      {
        id: 'q2',
        subject: 'Física',
        topic: 'Dinâmica',
        difficulty: 'Avançada',
        statement: 'Segunda lei de Newton.',
        alternatives: {},
        source: { label: 'IME' },
        tags: ['mecânica'],
        createdAt: '2026-01-01',
      },
    ];

    const byQuery = filterQuestions(list, {
      query: 'determinante',
      subject: 'Todas',
      difficulty: 'Todas',
      source: 'Todas',
    });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0].id).toBe('q1');

    const bySubject = filterQuestions(list, {
      query: '',
      subject: 'Física',
      difficulty: 'Todas',
      source: 'Todas',
    });
    expect(bySubject).toHaveLength(1);
    expect(bySubject[0].id).toBe('q2');

    const byDifficulty = filterQuestions(list, {
      query: '',
      subject: 'Todas',
      difficulty: 'Básica',
      source: 'Todas',
    });
    expect(byDifficulty).toHaveLength(1);
    expect(byDifficulty[0].id).toBe('q1');
  });

  it('filters questions by year, topic, and resolution status, and supports sorting', () => {
    const list: Question[] = [
      {
        id: 'q1',
        subject: 'Matemática',
        topic: 'Matrizes',
        difficulty: 'Básica',
        statement: 'Questão 1',
        alternatives: { A: '1', B: '2' },
        answerKey: 'A',
        source: { label: 'ITA', year: 2024, questionNumber: 15 },
        tags: [],
        createdAt: '2026-01-01T10:00:00Z',
      },
      {
        id: 'q2',
        subject: 'Física',
        topic: 'Dinâmica',
        difficulty: 'Avançada',
        statement: 'Questão 2',
        alternatives: { A: '1', B: '2' },
        answerKey: 'B',
        source: { label: 'ITA', year: 2025, questionNumber: 3 },
        tags: [],
        createdAt: '2026-01-02T10:00:00Z',
      },
      {
        id: 'q3',
        subject: 'Física',
        topic: 'Óptica',
        difficulty: 'Intermediária',
        statement: 'Questão 3',
        alternatives: { A: '1', B: '2' },
        answerKey: 'A',
        source: { label: 'ITA', year: 2025, questionNumber: 8 },
        tags: [],
        createdAt: '2026-01-03T10:00:00Z',
      },
    ];

    const statusMap = new Map([
      ['q1', { answered: true, isCorrect: true, isWrong: false, markedForReview: false }],
      ['q2', { answered: true, isCorrect: false, isWrong: true, markedForReview: true }],
      ['q3', { answered: false, isCorrect: false, isWrong: false, markedForReview: false }],
    ]);

    // Filter by year
    const year2025 = filterQuestions(
      list,
      { query: '', subject: 'Todas', difficulty: 'Todas', source: 'Todas', year: '2025' },
      statusMap
    );
    expect(year2025).toHaveLength(2);

    // Filter by status: acertos
    const acertos = filterQuestions(
      list,
      { query: '', subject: 'Todas', difficulty: 'Todas', source: 'Todas', status: 'acertos' },
      statusMap
    );
    expect(acertos).toHaveLength(1);
    expect(acertos[0].id).toBe('q1');

    // Filter by status: erros
    const erros = filterQuestions(
      list,
      { query: '', subject: 'Todas', difficulty: 'Todas', source: 'Todas', status: 'erros' },
      statusMap
    );
    expect(erros).toHaveLength(1);
    expect(erros[0].id).toBe('q2');

    // Filter by status: nao_resolvidas
    const naoResolvidas = filterQuestions(
      list,
      { query: '', subject: 'Todas', difficulty: 'Todas', source: 'Todas', status: 'nao_resolvidas' },
      statusMap
    );
    expect(naoResolvidas).toHaveLength(1);
    expect(naoResolvidas[0].id).toBe('q3');

    // Sort by question number
    const byNumber = filterQuestions(
      list,
      { query: '', subject: 'Todas', difficulty: 'Todas', source: 'Todas', sortBy: 'numero' },
      statusMap
    );
    expect(byNumber.map((q) => q.source.questionNumber)).toEqual([3, 8, 15]);
  });
});
