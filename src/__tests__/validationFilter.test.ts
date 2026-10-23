import { describe, expect, it } from 'vitest';
import { filterQuestions } from '../services/questionService';
import type { Question, QuestionValidationFilter } from '../types';

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
  validationState: 'valida',
  alerts: [],
  ...over,
});

const bank: Question[] = [
  q({ id: 'limpa', source: { label: 'ITA', year: 2025, questionNumber: 1 } }),
  q({
    id: 'com-alerta',
    source: { label: 'ITA', year: 2025, questionNumber: 2 },
    validationState: 'com_alertas',
    alerts: ['Questão possui apenas 1 alternativa identificada.'],
  }),
  q({
    id: 'sem-gabarito',
    source: { label: 'ITA', year: 2025, questionNumber: 3 },
    answerKey: undefined,
    validationState: 'com_alertas',
    alerts: ['Não foi encontrado gabarito oficial para esta questão no arquivo de gabarito.'],
  }),
  q({
    id: 'com-figura',
    source: { label: 'ITA', year: 2025, questionNumber: 4 },
    referencedFigures: ['Figura 1'],
    validationState: 'com_alertas',
    alerts: ['Referencia figura(s): Figura 1.'],
  }),
  q({
    id: 'incompleta',
    source: { label: 'ITA', year: 2025, questionNumber: 5 },
    statement: '',
    validationState: 'incompleta',
  }),
];

const ids = (validation: QuestionValidationFilter) =>
  filterQuestions(bank, {
    query: '',
    subject: 'Todas',
    difficulty: 'Todas',
    source: 'Todas',
    validation,
  }).map((x) => x.id);

describe('filtro por estado de validação', () => {
  it('"com alertas" isola o que a extração sinalizou', () => {
    expect(ids('com_alertas').sort()).toEqual(['com-alerta', 'com-figura', 'sem-gabarito']);
  });

  it('"sem gabarito" isola o que não pode ser corrigido automaticamente', () => {
    expect(ids('sem_gabarito')).toEqual(['sem-gabarito']);
  });

  it('"referenciam figura" isola o que depende do PDF original', () => {
    expect(ids('com_figura')).toEqual(['com-figura']);
  });

  it('"incompletas" e "validadas" separam os extremos', () => {
    expect(ids('incompleta')).toEqual(['incompleta']);
    expect(ids('valida')).toEqual(['limpa']);
  });

  it('"todas" não filtra nada', () => {
    expect(ids('todas')).toHaveLength(bank.length);
  });

  it('compõe com os outros filtros (matéria)', () => {
    const result = filterQuestions(bank, {
      query: '',
      subject: 'Física',
      difficulty: 'Todas',
      source: 'Todas',
      validation: 'com_alertas',
    });
    expect(result).toHaveLength(0);
  });
});
