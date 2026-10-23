import { describe, expect, it } from 'vitest';
import { reconcileExtractedData } from '../../server/geminiService';
import type { ExtractedAnswerKeyItem, ExtractedQuestionRaw } from '../../server/types';

const base = {
  examFileName: 'ita-2025-1fase.pdf',
  examChecksum: 'sha256-da-prova',
  answerKeyChecksum: 'sha256-do-gabarito',
  metadata: { institution: 'ITA', year: 2025, phase: '1ª fase' },
  promptVersion: 'ita-extractor-v1.2',
  model: 'gemini-3.5-flash',
};

const q = (questionNumber: number | undefined, statement: string): ExtractedQuestionRaw => ({
  ...(questionNumber !== undefined ? { questionNumber } : {}),
  statement,
  alternatives: { A: 'a', B: 'b', C: 'c', D: 'd', E: 'e' },
  confidence: 'alta',
});

const keys = (numbers: number[]): ExtractedAnswerKeyItem[] =>
  numbers.map((n) => ({ questionNumber: n, officialAnswer: 'B' }));

describe('reconciliação — identidade da questão', () => {
  it('não inventa número para questão sem número, e não casa gabarito por posição quando a contagem diverge', () => {
    // A prova tem 4 questões; a extração perdeu uma e não leu o número de outra.
    const { questions } = reconcileExtractedData({
      ...base,
      rawQuestions: [q(1, 'Q1'), q(undefined, 'Q2 sem número'), q(3, 'Q3')],
      answerKeys: keys([1, 2, 3, 4]),
    });

    const semNumero = questions.find((x) => x.statement === 'Q2 sem número')!;

    // O defeito antigo fazia qNum = idx + 1 = 2 e atribuía o gabarito da questão 2.
    expect(semNumero.source.questionNumber).toBeUndefined();
    expect(semNumero.answerKey).toBeUndefined();
    expect(semNumero.hasOfficialKey).toBe(false);
    // O ordinal é preservado como informação, não promovido a número.
    expect(semNumero.source.order).toBe(2);
    expect(semNumero.alerts.some((a) => a.includes('Gabarito não atribuído'))).toBe(true);
  });

  it('duas questões nunca reivindicam o mesmo número; a segunda não herda o gabarito', () => {
    const { questions } = reconcileExtractedData({
      ...base,
      rawQuestions: [q(1, 'Q1'), q(3, 'Q3'), q(3, 'Q3 duplicada')],
      answerKeys: keys([1, 2, 3]),
    });

    const numeros = questions
      .map((x) => x.source.questionNumber)
      .filter((n): n is number => n !== undefined);
    // invariante: um número pertence a uma única questão
    expect(new Set(numeros).size).toBe(numeros.length);

    const duplicada = questions.find((x) => x.statement === 'Q3 duplicada')!;
    expect(duplicada.answerKey).toBeUndefined();
    expect(duplicada.alerts.some((a) => a.includes('duplicado'))).toBe(true);
  });

  it('casa por ordinal quando as contagens batem — aí a correspondência é bijetiva', () => {
    const { questions } = reconcileExtractedData({
      ...base,
      rawQuestions: [q(1, 'Q1'), q(undefined, 'Q2 sem número'), q(3, 'Q3')],
      answerKeys: keys([1, 2, 3]),
    });

    const semNumero = questions.find((x) => x.statement === 'Q2 sem número')!;
    expect(semNumero.answerKey).toBe('B'); // gabarito da questão 2, por ordem
    expect(semNumero.source.questionNumber).toBeUndefined(); // e o número continua não sabido
  });

  it('source.order é 1-based e contíguo em toda a saída', () => {
    const { questions } = reconcileExtractedData({
      ...base,
      rawQuestions: [q(3, 'Q3'), q(1, 'Q1'), q(2, 'Q2')],
      answerKeys: keys([1, 2, 3]),
    });
    expect(questions.map((x) => x.source.order)).toEqual([1, 2, 3]);
    // e a ordenação recuperou a ordem do documento, não a ordem de saída do modelo
    expect(questions.map((x) => x.source.questionNumber)).toEqual([1, 2, 3]);
  });

  it('id é determinístico: reprocessar o mesmo documento produz os mesmos ids', () => {
    const input = {
      ...base,
      rawQuestions: [q(1, 'Q1'), q(2, 'Q2')],
      answerKeys: keys([1, 2]),
    };
    const a = reconcileExtractedData(input).questions.map((x) => x.id);
    const b = reconcileExtractedData(input).questions.map((x) => x.id);
    expect(a).toEqual(b);
    expect(a[0]).toBe('gemini-ita-2025-1-fase-o1');
  });

  it('propaga o checksum do gabarito para a questão (procedência da resposta)', () => {
    const { questions } = reconcileExtractedData({
      ...base,
      rawQuestions: [q(1, 'Q1')],
      answerKeys: keys([1]),
    });
    expect(questions[0].source.answerKeyChecksum).toBe('sha256-do-gabarito');
    expect(questions[0].source.checksum).toBe('sha256-da-prova');
  });
});
