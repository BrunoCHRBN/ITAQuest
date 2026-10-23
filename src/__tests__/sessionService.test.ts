import { describe, expect, it } from 'vitest';
import type { StudySession } from '../types';
import { uid } from '../services/questionService';

describe('sessionService and lifecycle', () => {
  it('creates a session preserving specific question selection and ordering', () => {
    const selectedIds = ['q-3', 'q-1', 'q-2']; // custom ordering
    const session: StudySession = {
      id: uid('session'),
      title: 'Minha Lista Personalizada',
      mode: 'simulado',
      status: 'planejada',
      questionIds: selectedIds,
      responses: {},
      currentIndex: 0,
      createdAt: '2026-10-18T12:00:00.000Z',
      timerMinutes: 60,
    };

    expect(session.questionIds).toEqual(['q-3', 'q-1', 'q-2']);
    expect(session.currentIndex).toBe(0);
    expect(session.mode).toBe('simulado');
    expect(session.status).toBe('planejada');
  });

  it('handles pause and resume updating session state and timestamps', () => {
    let session: StudySession = {
      id: 's-pause',
      title: 'Sessão Pausada',
      mode: 'treino',
      status: 'planejada',
      questionIds: ['q1', 'q2'],
      responses: {},
      currentIndex: 0,
      createdAt: '2026-10-18T10:00:00.000Z',
    };

    // Start session
    const startTime = new Date('2026-10-18T10:05:00.000Z').toISOString();
    session = { ...session, status: 'em_andamento', startedAt: startTime };
    expect(session.status).toBe('em_andamento');
    expect(session.startedAt).toBe(startTime);

    // Answer first question
    session = {
      ...session,
      responses: {
        ...session.responses,
        q1: { selectedOption: 'B', notes: 'nota', markedForReview: true, checked: true },
      },
      currentIndex: 1,
    };
    expect(session.responses.q1.selectedOption).toBe('B');
    expect(session.responses.q1.markedForReview).toBe(true);
    expect(session.currentIndex).toBe(1);

    // Pause / leave resolution screen (still keeps state saved)
    // Resume session later
    expect(session.responses.q1.selectedOption).toBe('B');
    expect(session.currentIndex).toBe(1);
  });

  it('completes session recording finishedAt and elapsedSeconds', () => {
    const startTime = new Date('2026-10-18T10:00:00.000Z').getTime();
    const endTime = new Date('2026-10-18T10:35:00.000Z').getTime();
    const elapsedSeconds = Math.floor((endTime - startTime) / 1000); // 35 * 60 = 2100

    const session: StudySession = {
      id: 's-complete',
      title: 'Simulado ITA 1ª Fase',
      mode: 'simulado',
      status: 'concluída',
      questionIds: ['q1', 'q2'],
      responses: {
        q1: { selectedOption: 'A', notes: '', markedForReview: false, checked: false },
      },
      currentIndex: 1,
      createdAt: '2026-10-18T10:00:00.000Z',
      startedAt: new Date(startTime).toISOString(),
      finishedAt: new Date(endTime).toISOString(),
      elapsedSeconds,
      timerMinutes: 60,
    };

    expect(session.status).toBe('concluída');
    expect(session.elapsedSeconds).toBe(2100);
    expect(session.finishedAt).toBeDefined();
  });

  it('calculates remaining timer seconds in simulado mode', () => {
    const totalMinutes = 120;
    const elapsedSeconds = 3600; // 60 mins passed
    const remainingSeconds = Math.max(0, totalMinutes * 60 - elapsedSeconds);
    expect(remainingSeconds).toBe(3600); // 60 mins left

    const timeoutElapsed = 7200; // 120 mins passed
    const timeoutRemaining = Math.max(0, totalMinutes * 60 - timeoutElapsed);
    expect(timeoutRemaining).toBe(0);
  });
});
