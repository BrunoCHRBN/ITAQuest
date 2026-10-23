import { describe, expect, it } from 'vitest';
import { makeImportBatch, undoBatch } from '../services/batchService';
import type { Question } from '../types';

const q = (id: string, over: Partial<Question> = {}): Question => ({
  id,
  subject: 'Física',
  topic: 'Mecânica',
  difficulty: 'Avançada',
  statement: `enunciado de ${id}`,
  alternatives: { A: 'a', B: 'b' },
  answerKey: 'A',
  source: { label: 'ITA', year: 2025, questionNumber: 1, checksum: 'sha-prova' },
  tags: [],
  createdAt: '2026-01-01',
  ...over,
});

describe('makeImportBatch', () => {
  it('infere a origem pelo checksum e guarda o documento', () => {
    const batch = makeImportBatch({
      id: 'b1',
      representative: [q('a')],
      created: ['a'],
      replaced: [],
    });
    expect(batch.source).toBe('gemini');
    expect(batch.document?.checksum).toBe('sha-prova');
    expect(batch.document?.label).toBe('ITA');
  });

  it('origem manual quando não há checksum nem documento de prova', () => {
    const manual = q('m', { source: { label: 'Cadastro manual' } });
    const batch = makeImportBatch({ id: 'b2', representative: [manual], created: ['m'], replaced: [] });
    expect(batch.source).toBe('manual');
  });
});

describe('undoBatch — desfazer é desfazer', () => {
  it('remove o que o lote criou e mantém o que já existia', () => {
    const antes = [q('antiga')];
    const batch = makeImportBatch({
      id: 'b',
      representative: [q('nova1'), q('nova2')],
      created: ['nova1', 'nova2'],
      replaced: [],
    });

    const depois = undoBatch([q('nova1'), q('nova2'), ...antes], batch);

    expect(depois.map((x) => x.id)).toEqual(['antiga']);
  });

  it('restaura a versão anterior das questões que o lote substituiu', () => {
    const anterior = q('mesma-id', { answerKey: 'B', alternatives: { A: 'a', B: 'b' } });
    const substituida = q('mesma-id', { answerKey: 'C', alternatives: { A: 'a', B: 'b', C: 'c' } });

    const batch = makeImportBatch({
      id: 'b',
      representative: [substituida],
      created: [],
      replaced: [{ id: 'mesma-id', previous: anterior }],
    });

    const depois = undoBatch([substituida], batch);

    expect(depois).toHaveLength(1);
    expect(depois[0].answerKey).toBe('B');
    expect(Object.keys(depois[0].alternatives)).toHaveLength(2);
  });

  it('não toca em questão que o lote não criou nem substituiu', () => {
    const alheia = q('alheia', { statement: 'intocada' });
    const batch = makeImportBatch({ id: 'b', representative: [q('x')], created: ['x'], replaced: [] });
    const depois = undoBatch([alheia, q('x')], batch);
    expect(depois).toEqual([alheia]);
  });

  it('desfazer um lote vazio é inofensivo', () => {
    const batch = makeImportBatch({ id: 'b', representative: [], created: [], replaced: [] });
    const banco = [q('a'), q('b')];
    expect(undoBatch(banco, batch)).toEqual(banco);
  });
});
