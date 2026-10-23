import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResolverPage } from '../components/views/ResolverPage';
import { ConstantsDrawer } from '../components/common/ConstantsDrawer';
import { KeyboardShortcutsModal } from '../components/common/KeyboardShortcutsModal';
import type { Question, ResponseRecord, StudySession } from '../types';

describe('Keyboard Navigation and Tactic 3-Round Triage (Fase 2)', () => {
  const sampleQuestion: Question = {
    id: 'q-mc-1',
    subject: 'Física',
    topic: 'Termodinâmica',
    difficulty: 'Intermediária',
    statement: 'Um ciclo de Carnot opera entre $T_1 = 300\\text{ K}$ e $T_2 = 600\\text{ K}$. Calcule o rendimento $\\eta$.',
    alternatives: {
      A: '$\\eta = 25\\%$',
      B: '$\\eta = 50\\%$',
      C: '$\\eta = 60\\%$',
      D: '$\\eta = 75\\%$',
      E: '$\\eta = 80\\%$',
    },
    answerKey: 'B',
    source: { label: 'ITA', year: 2024 },
    tags: ['termodinâmica', 'carnot'],
    createdAt: '2026-01-01',
  };

  const sampleSession: StudySession = {
    id: 'sess-1',
    title: 'Simulado 1ª Fase',
    mode: 'simulado',
    status: 'em_andamento',
    questionIds: ['q-mc-1', 'q-mc-2'],
    responses: {
      'q-mc-1': { notes: '', markedForReview: false, checked: false },
    },
    currentIndex: 0,
    createdAt: '2026-10-18T10:00:00Z',
    startedAt: '2026-10-18T10:00:00Z',
    timerMinutes: 300,
  };

  it('selects alternative when pressing letter key A-E', () => {
    let currentResponse: ResponseRecord = { notes: '', markedForReview: false, checked: false };
    const handleUpdateResponse = vi.fn((_id, updater) => {
      currentResponse = updater(currentResponse);
    });

    render(
      <ResolverPage
        session={sampleSession}
        questions={[sampleQuestion]}
        tick={1000}
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onUpdateResponse={handleUpdateResponse}
        onNotify={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'b' });
    expect(handleUpdateResponse).toHaveBeenCalled();
    expect(currentResponse.selectedOption).toBe('B');

    fireEvent.keyDown(window, { key: 'C' });
    expect(currentResponse.selectedOption).toBe('C');
  });

  it('sets 3-round triage when pressing keys 1, 2, 3 or clicking triage buttons', () => {
    let currentResponse: ResponseRecord = { notes: '', markedForReview: false, checked: false };
    const handleUpdateResponse = vi.fn((_id, updater) => {
      currentResponse = updater(currentResponse);
    });

    const { rerender } = render(
      <ResolverPage
        session={{
          ...sampleSession,
          responses: { 'q-mc-1': currentResponse },
        }}
        questions={[sampleQuestion]}
        tick={1000}
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onUpdateResponse={handleUpdateResponse}
        onNotify={vi.fn()}
      />
    );

    // Key 1 -> Imediata
    fireEvent.keyDown(window, { key: '1' });
    expect(currentResponse.triage).toBe('imediata');

    // Rerender with triage imediata active
    rerender(
      <ResolverPage
        session={{
          ...sampleSession,
          responses: { 'q-mc-1': currentResponse },
        }}
        questions={[sampleQuestion]}
        tick={1000}
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={vi.fn()}
        onUpdateResponse={handleUpdateResponse}
        onNotify={vi.fn()}
      />
    );

    // Key 2 -> Trabalhosa
    fireEvent.keyDown(window, { key: '2' });
    expect(currentResponse.triage).toBe('trabalhosa');

    // Key 3 -> Combate
    fireEvent.keyDown(window, { key: '3' });
    expect(currentResponse.triage).toBe('combate');
  });

  it('navigates to next and previous questions with arrow keys and J/K', () => {
    const handleUpdateSession = vi.fn();

    render(
      <ResolverPage
        session={sampleSession}
        questions={[sampleQuestion]}
        tick={1000}
        onExit={vi.fn()}
        onFinishSession={vi.fn()}
        onUpdateSession={handleUpdateSession}
        onUpdateResponse={vi.fn()}
        onNotify={vi.fn()}
      />
    );

    // ArrowRight or K advances
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(handleUpdateSession).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'k' });
    expect(handleUpdateSession).toHaveBeenCalledTimes(2);

    // ArrowLeft or J goes back
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(handleUpdateSession).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(window, { key: 'j' });
    expect(handleUpdateSession).toHaveBeenCalledTimes(4);
  });

  it('opens and closes the Constants sheet and filters constants', () => {
    const handleClose = vi.fn();
    const { rerender } = render(<ConstantsDrawer isOpen={false} onClose={handleClose} />);
    expect(screen.queryByText(/FOLHA OFICIAL DE CONSTANTES/)).toBeNull();

    rerender(<ConstantsDrawer isOpen={true} onClose={handleClose} />);
    expect(screen.getByText(/FOLHA OFICIAL DE CONSTANTES/)).toBeTruthy();

    const searchInput = screen.getByPlaceholderText(/Pesquisar por constante/);
    fireEvent.change(searchInput, { target: { value: 'gravidade' } });
    expect(screen.getByText(/Aceleração da gravidade ao nível do mar/)).toBeTruthy();

    // Closing
    const closeBtn = screen.getByLabelText(/Fechar folha de constantes/);
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });

  it('renders the Keyboard Shortcuts modal with complete ITA shortcut catalog', () => {
    const handleClose = vi.fn();
    render(<KeyboardShortcutsModal onClose={handleClose} />);
    expect(screen.getByText('Atalhos de Teclado')).toBeTruthy();
    expect(screen.getByText(/Tática de Prova ITA/)).toBeTruthy();
    expect(screen.getByText(/1ª Volta: Imediata/)).toBeTruthy();
  });
});
