import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  deduplicateQuestions,
  revalidateQuestion,
} from '../services/questionService';
import { AddQuestionModal } from '../components/modals/AddQuestionModal';
import type { Question } from '../types';

const base: Question = {
  id: 'gemini-ita-2024-1-fase-o12',
  subject: 'Física',
  topic: 'Mecânica',
  difficulty: 'Avançada',
  statement: 'Um bloco desliza sobre um plano inclinado.',
  alternatives: { A: '1 m/s', B: '2 m/s' }, // faltavam C, D, E -> alerta de extração
  answerKey: 'C',
  source: { label: 'ITA', year: 2024, phase: '1ª fase', questionNumber: 12, order: 12 },
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  validationState: 'com_alertas',
  alerts: ['Questão possui apenas 2 alternativa identificada.'],
  hasOfficialKey: true,
};

describe('deduplicateQuestions — correção não é descartada', () => {
  it('a versão corrigida da mesma questão vira CONFLITO, não duplicata ignorada', () => {
    // Exatamente o defeito medido: completar as alternativas não muda
    // label|ano|número|enunciado, então a correção era recusada em silêncio.
    const corrigida: Question = {
      ...base,
      id: 'outro-id',
      alternatives: { A: '1 m/s', B: '2 m/s', C: '3 m/s', D: '4 m/s', E: '5 m/s' },
    };

    const result = deduplicateQuestions([base], [corrigida]);

    expect(result.fresh).toHaveLength(0);
    expect(result.duplicatesCount).toBe(0);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].differences).toContain('alternativas');
    expect(result.conflicts[0].existingId).toBe(base.id);
  });

  it('correção de gabarito também é conflito', () => {
    const result = deduplicateQuestions([base], [{ ...base, id: 'x', answerKey: 'D' }]);
    expect(result.conflicts[0].differences).toContain('gabarito');
  });

  it('questão idêntica é ignorada sem incomodar (nada se perde)', () => {
    const result = deduplicateQuestions([base], [{ ...base, id: 'x' }]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.duplicatesCount).toBe(1);
  });

  it('diferença só de caixa ou de forma Unicode não é conflito', () => {
    const variante: Question = {
      ...base,
      id: 'x',
      statement: 'UM BLOCO DESLIZA SOBRE UM PLANO INCLINADO.',
    };
    const result = deduplicateQuestions([base], [variante]);
    expect(result.conflicts).toHaveLength(0);
    expect(result.duplicatesCount).toBe(1);
  });

  it('correção de acento no enunciado é mudança real e aparece', () => {
    const variante: Question = { ...base, id: 'x', statement: 'Um blóco desliza sobre um plano inclinado.' };
    const result = deduplicateQuestions([base], [variante]);
    expect(result.conflicts[0].differences).toContain('enunciado');
  });

  it('número diferente é questão nova', () => {
    const outra: Question = {
      ...base,
      id: 'y',
      source: { ...base.source, questionNumber: 13, order: 13 },
    };
    const result = deduplicateQuestions([base], [outra]);
    expect(result.fresh).toHaveLength(1);
    expect(result.conflicts).toHaveLength(0);
  });

  it('sem número, a identidade cai no enunciado', () => {
    const semNumero: Question = {
      ...base,
      id: 'a',
      source: { label: 'Cadastro manual' },
    };
    const copia: Question = { ...semNumero, id: 'b' };
    const result = deduplicateQuestions([semNumero], [copia]);
    expect(result.duplicatesCount).toBe(1);
  });
});

describe('revalidateQuestion — o alerta que deixou de valer sai', () => {
  it('completa as alternativas: o alerta estrutural é removido e o estado sobe', () => {
    const corrigida = revalidateQuestion({
      ...base,
      alternatives: { A: '1', B: '2', C: '3', D: '4', E: '5' },
      alerts: ['Questão possui apenas 2 alternativa identificada.'],
    });
    expect(corrigida.alerts).toEqual([]);
    expect(corrigida.validationState).toBe('valida');
    expect(corrigida.id).toBe(base.id); // identidade preservada: sessões apontam para ela
  });

  it('alerta que depende da fonte original é preservado', () => {
    const editada = revalidateQuestion({
      ...base,
      alternatives: { A: '1', B: '2', C: '3' },
      alerts: ['Referencia figura(s): Figura 1. Verifique o diagrama no PDF original.'],
    });
    expect(editada.alerts?.some((a) => a.includes('Figura 1'))).toBe(true);
    expect(editada.validationState).toBe('com_alertas');
  });
});

describe('AddQuestionModal em modo edição', () => {
  it('abre preenchido com a questão existente', () => {
    render(
      <AddQuestionModal
        question={base}
        onClose={() => {}}
        onSave={() => {}}
        onError={() => {}}
      />
    );
    expect(screen.getByText('Editar questão')).toBeTruthy();
    expect((screen.getByLabelText('Enunciado') as HTMLTextAreaElement).value).toBe(base.statement);
  });
});
