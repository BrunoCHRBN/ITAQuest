import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResolverPage } from '../components/views/ResolverPage';
import { CreateSessionModal } from '../components/modals/CreateSessionModal';
import { AddQuestionModal } from '../components/modals/AddQuestionModal';
import { QuestionRow } from '../components/question/QuestionRow';
import type { Question, ResponseRecord, StudySession } from '../types';

describe('Component Focus and Keyboard Navigation (Requirement 7)', () => {
  const discursiveQuestion: Question = {
    id: 'q-disc-1',
    subject: 'Física',
    topic: 'Mecânica',
    difficulty: 'Avançada',
    statement: 'Calcule a aceleração do bloco no plano inclinado com atrito.',
    alternatives: {}, // Discursive question
    source: { label: 'ITA', year: 2024 },
    tags: ['mecânica', 'atrito'],
    createdAt: '2026-01-01',
  };

  it('keeps focus on the discursive textarea while typing during state updates and timer ticks', () => {
    let responseState: ResponseRecord = { notes: '', markedForReview: false, checked: false };
    const session: StudySession = {
      id: 'sess-1',
      title: 'Treino Discursivo',
      mode: 'treino',
      status: 'em_andamento',
      questionIds: ['q-disc-1'],
      responses: { 'q-disc-1': responseState },
      currentIndex: 0,
      createdAt: '2026-10-18T10:00:00Z',
      startedAt: '2026-10-18T10:00:00Z',
    };

    const handleUpdateResponse = vi.fn((qId, updater) => {
      responseState = updater(responseState);
    });

    const { rerender } = render(
      <ResolverPage
        session={session}
        questions={[discursiveQuestion]}
        tick={1000}
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onUpdateResponse={handleUpdateResponse}
        onNotify={vi.fn()}
      />
    );

    const textarea = screen.getByPlaceholderText('Registre aqui seu raciocínio, cálculos e resposta...') as HTMLTextAreaElement;
    expect(textarea).not.toBeNull();

    // Focus on textarea
    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Type text into the textarea
    fireEvent.change(textarea, { target: { value: 'Passo 1: diagrama de forças.' } });
    expect(handleUpdateResponse).toHaveBeenCalled();

    // Re-render with new state (as React does on update)
    const updatedSession = {
      ...session,
      responses: { 'q-disc-1': { ...responseState, notes: 'Passo 1: diagrama de forças.' } },
    };

    rerender(
      <ResolverPage
        session={updatedSession}
        questions={[discursiveQuestion]}
        tick={2000} // Next second tick
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onUpdateResponse={handleUpdateResponse}
        onNotify={vi.fn()}
      />
    );

    // Verify the textarea has NOT lost focus and content is updated!
    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe('Passo 1: diagrama de forças.');

    // Simulate another timer tick (e.g. 1 second later) without user interaction
    rerender(
      <ResolverPage
        session={updatedSession}
        questions={[discursiveQuestion]}
        tick={3000}
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onUpdateResponse={handleUpdateResponse}
        onNotify={vi.fn()}
      />
    );

    // Focus remains strictly intact
    expect(document.activeElement).toBe(textarea);
  });

  it('keeps focus on modal text inputs when typing in CreateSessionModal', () => {
    render(
      <CreateSessionModal
        questions={[discursiveQuestion]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />
    );

    const titleInput = screen.getByPlaceholderText('Ex.: Revisão de mecânica') as HTMLInputElement;
    titleInput.focus();
    expect(document.activeElement).toBe(titleInput);

    fireEvent.change(titleInput, { target: { value: 'Nova Sessão de Treino' } });
    expect(titleInput.value).toBe('Nova Sessão de Treino');
    expect(document.activeElement).toBe(titleInput);
  });

  it('keeps focus on textarea when typing in AddQuestionModal', () => {
    render(
      <AddQuestionModal
        onClose={vi.fn()}
        onSave={vi.fn()}
        onError={vi.fn()}
      />
    );

    const statementInput = screen.getByPlaceholderText('Digite o enunciado completo...') as HTMLTextAreaElement;
    statementInput.focus();
    expect(document.activeElement).toBe(statementInput);

    fireEvent.change(statementInput, { target: { value: 'Enunciado de física quântica...' } });
    expect(statementInput.value).toBe('Enunciado de física quântica...');
    expect(document.activeElement).toBe(statementInput);
  });

  it('handles Escape key to close modal accessible behavior', () => {
    const handleClose = vi.fn();
    render(
      <CreateSessionModal
        questions={[discursiveQuestion]}
        onClose={handleClose}
        onCreate={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('supports Enter key on QuestionRow for keyboard accessibility', () => {
    const handleResolve = vi.fn();
    render(
      <QuestionRow
        question={discursiveQuestion}
        onResolve={handleResolve}
      />
    );

    const row = screen.getByRole('button', { name: /Calcule a aceleração/i });
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(handleResolve).toHaveBeenCalledTimes(1);
  });
});
