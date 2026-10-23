import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BankPage } from '../components/views/BankPage';
import type { ImportBatch, Question } from '../types';

const q = (over: Partial<Question>): Question => ({
  id: 'q',
  subject: 'Matemática',
  topic: 'Álgebra',
  difficulty: 'Intermediária',
  statement: 'enunciado',
  alternatives: { A: 'a', B: 'b' },
  answerKey: 'A',
  source: { label: 'ITA', year: 2025, questionNumber: 1 },
  tags: [],
  createdAt: '2026-01-01',
  ...over,
});

const baseProps = {
  selectedQuestionIds: [],
  onToggleSelect: vi.fn(),
  onClearSelection: vi.fn(),
  onStartSingleQuestion: vi.fn(),
  onOpenSessionModal: vi.fn(),
  onOpenImportModal: vi.fn(),
  onOpenGeminiModal: vi.fn(),
  onOpenAddQuestionModal: vi.fn(),
  onExportQuestions: vi.fn(),
  onClearQuestions: vi.fn(),
  onEditQuestion: vi.fn(),
  sessions: [],
};

const bank: Question[] = [
  q({ id: 'limpa', source: { label: 'ITA', year: 2025, questionNumber: 1 } }),
  q({
    id: 'com-alerta',
    statement: 'questão com alerta de extração',
    source: { label: 'ITA', year: 2025, questionNumber: 2 },
    validationState: 'com_alertas',
    alerts: ['Questão possui apenas 1 alternativa identificada.'],
  }),
  q({
    id: 'sem-gabarito',
    statement: 'questão sem gabarito',
    source: { label: 'ITA', year: 2025, questionNumber: 3 },
    answerKey: undefined,
  }),
];

describe('Banco — faixa de triagem', () => {
  it('mostra as pendências com contagem', () => {
    render(<BankPage {...baseProps} questions={bank} />);
    expect(screen.getByText('Triagem pendente')).toBeTruthy();
    expect(screen.getByText('1 com alerta de extração')).toBeTruthy();
    expect(screen.getByText('1 sem gabarito')).toBeTruthy();
  });

  it('clicar no chip filtra o acervo para as pendências', () => {
    render(<BankPage {...baseProps} questions={bank} />);
    // antes: 3 questões
    expect(screen.getByText('3')).toBeTruthy();

    fireEvent.click(screen.getByText('1 com alerta de extração'));

    expect(screen.getByText('questão com alerta de extração')).toBeTruthy();
    expect(screen.queryByText('questão sem gabarito')).toBeNull();
  });

  it('não aparece quando não há pendência', () => {
    render(<BankPage {...baseProps} questions={[q({ id: 'ok' })]} />);
    expect(screen.queryByText('Triagem pendente')).toBeNull();
  });
});

describe('Banco — desfazer importação', () => {
  const batch: ImportBatch = {
    id: 'b1',
    createdAt: '2026-01-01T10:00:00.000Z',
    source: 'gemini',
    document: { label: 'ITA', year: 2025, phase: '1ª fase' },
    created: ['limpa'],
    replaced: [],
  };

  it('só oferece desfazer quando existe um lote', () => {
    render(<BankPage {...baseProps} questions={bank} />);
    expect(screen.queryByText('Desfazer última importação')).toBeNull();

    render(<BankPage {...baseProps} questions={bank} lastBatch={batch} onUndoImport={vi.fn()} />);
    expect(screen.getByText('Desfazer última importação')).toBeTruthy();
  });

  it('pede confirmação antes de remover', () => {
    const onUndoImport = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <BankPage {...baseProps} questions={bank} lastBatch={batch} onUndoImport={onUndoImport} />
    );
    fireEvent.click(screen.getByText('Desfazer última importação'));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onUndoImport).not.toHaveBeenCalled(); // recusou: nada acontece

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByText('Desfazer última importação'));
    expect(onUndoImport).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });
});
