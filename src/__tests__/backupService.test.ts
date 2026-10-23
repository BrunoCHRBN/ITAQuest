import { describe, expect, it } from 'vitest';
import { createBackup, restoreBackup, validateBackup } from '../services/backupService';
import type { BackupData, Question, StudySession } from '../types';

describe('backupService', () => {
  const dummyQuestions: Question[] = [
    {
      id: 'q1',
      subject: 'Matemática',
      topic: 'Álgebra',
      difficulty: 'Básica',
      statement: 'Questão local existente.',
      alternatives: { A: '1', B: '2' },
      answerKey: 'A',
      source: { label: 'ITA', year: 2024 },
      tags: [],
      createdAt: '2026-01-01',
    },
  ];

  const dummySessions: StudySession[] = [
    {
      id: 's1',
      title: 'Sessão Existente',
      mode: 'treino',
      status: 'concluída',
      questionIds: ['q1'],
      responses: {
        q1: { selectedOption: 'A', notes: 'minha nota', markedForReview: true, checked: true },
      },
      currentIndex: 0,
      createdAt: '2026-01-01',
      elapsedSeconds: 120,
    },
  ];

  it('creates complete backup format with version 1.0 and all entities', () => {
    const backup = createBackup(dummyQuestions, dummySessions);
    expect(backup.version).toBe('1.0');
    expect(backup.app).toBe('rotina-ita');
    expect(backup.exportedAt).toBeDefined();
    expect(backup.questions).toEqual(dummyQuestions);
    expect(backup.sessions).toEqual(dummySessions);
  });

  it('validates backup schema and rejects invalid or corrupted files', () => {
    expect(validateBackup(null).valid).toBe(false);
    expect(validateBackup({ app: 'wrong-app' }).valid).toBe(false);
    expect(validateBackup({ app: 'rotina-ita', version: '99.0' }).valid).toBe(false);
    expect(validateBackup({ app: 'rotina-ita', version: '1.0', questions: 'not-array' }).valid).toBe(false);

    const validRaw = {
      version: '1.0',
      app: 'rotina-ita',
      questions: [
        {
          statement: 'Questão válida no backup',
          subject: 'Física',
          topic: 'Ondulatória',
          difficulty: 'Avançada',
          alternativas: { A: '10 Hz', B: '20 Hz' },
          answerKey: 'A',
        },
      ],
      sessions: [
        {
          id: 's-backup-1',
          title: 'Sessão importada',
          mode: 'simulado',
          status: 'planejada',
          questionIds: ['q-imported-1'],
          responses: {},
        },
      ],
    };

    const result = validateBackup(validRaw);
    expect(result.valid).toBe(true);
    expect(result.backup?.questions).toHaveLength(1);
    expect(result.backup?.sessions).toHaveLength(1);
  });

  it('restores backup using replace strategy overwriting existing database cleanly', () => {
    const backup: BackupData = {
      version: '1.0',
      app: 'rotina-ita',
      exportedAt: '2026-10-18T10:00:00Z',
      questions: [
        {
          id: 'q-new',
          subject: 'Química',
          topic: 'Cinética',
          difficulty: 'Intermediária',
          statement: 'Questão Nova Substituta',
          alternatives: {},
          source: { label: 'ITA' },
          tags: [],
          createdAt: '2026-01-01',
        },
      ],
      sessions: [
        {
          id: 's-new',
          title: 'Nova Sessão Única',
          mode: 'treino',
          status: 'planejada',
          questionIds: ['q-new'],
          responses: {},
          currentIndex: 0,
          createdAt: '2026-01-01',
        },
      ],
    };

    const { questions, sessions, result } = restoreBackup(
      dummyQuestions,
      dummySessions,
      backup,
      'replace'
    );

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('q-new');
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('s-new');
    expect(result.strategy).toBe('replace');
  });

  it('restores backup using merge strategy without erasing local questions or sessions', () => {
    const backup: BackupData = {
      version: '1.0',
      app: 'rotina-ita',
      exportedAt: '2026-10-18T10:00:00Z',
      questions: [
        // Duplicate question
        {
          id: 'q1-copy',
          subject: 'Matemática',
          topic: 'Álgebra',
          difficulty: 'Básica',
          statement: 'Questão local existente.', // same statement & origin as dummyQuestions[0]
          alternatives: { A: '1', B: '2' },
          answerKey: 'A',
          source: { label: 'ITA', year: 2024 },
          tags: [],
          createdAt: '2026-01-01',
        },
        // Fresh question
        {
          id: 'q-fresh',
          subject: 'Física',
          topic: 'Eletromagnetismo',
          difficulty: 'Avançada',
          statement: 'Força de Lorentz sobre carga em movimento.',
          alternatives: { A: 'q(v x B)', B: 'qE' },
          source: { label: 'ITA', year: 2024 },
          tags: [],
          createdAt: '2026-01-01',
        },
      ],
      sessions: [
        // Fresh session
        {
          id: 's-fresh',
          title: 'Sessão Adicionada',
          mode: 'treino',
          status: 'planejada',
          questionIds: ['q-fresh'],
          responses: {},
          currentIndex: 0,
          createdAt: '2026-01-01',
        },
      ],
    };

    const { questions, sessions, result } = restoreBackup(
      dummyQuestions,
      dummySessions,
      backup,
      'merge'
    );

    expect(result.strategy).toBe('merge');
    expect(result.restoredQuestions).toBe(1); // 1 fresh
    expect(result.skippedDuplicates).toBe(1); // 1 duplicate skipped
    expect(result.restoredSessions).toBe(1);

    // Total questions: 1 original + 1 fresh = 2
    expect(questions).toHaveLength(2);
    expect(questions.some((q) => q.id === 'q1')).toBe(true);

    // Total sessions: 1 original + 1 fresh = 2
    expect(sessions).toHaveLength(2);
    expect(sessions.some((s) => s.id === 's1')).toBe(true);
  });
});
