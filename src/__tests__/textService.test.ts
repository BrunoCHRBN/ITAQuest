import { describe, expect, it } from 'vitest';
import { canonicalText, foldText, sameText } from '../services/textService';
import { filterQuestions, normalizeQuestion, questionDeduplicationKey } from '../services/questionService';
import type { Question } from '../types';

// Formas reais extraídas do PDF oficial do ITA 2025: o documento mistura as duas codificações
// (24 ocorrências de cada) porque foi montado a partir de originais distintos.
const NFC = 'Questão 13. Considere uma partícula';
const NFD = 'Questa\u0303o 13. Considere uma parti\u0301cula';

describe('canonicalText', () => {
  it('converte NFD para NFC (a forma canônica de armazenamento)', () => {
    expect(NFD).not.toBe(NFC); // a fixture é realmente decomposta
    expect(canonicalText(NFD)).toBe(NFC);
  });

  it('colapsa espaço horizontal sem destruir quebra de linha', () => {
    expect(canonicalText('  a    b  ')).toBe('a b');
    expect(canonicalText('linha 1\nlinha 2')).toBe('linha 1\nlinha 2');
  });
});

describe('foldText', () => {
  it('remove diacríticos e caixa', () => {
    expect(foldText('Álgebra Linear')).toBe('algebra linear');
    expect(foldText('Função')).toBe('funcao');
  });

  it('reduz quebra de linha a espaço, para comparar enunciado inteiro', () => {
    expect(foldText('a\nb')).toBe('a b');
  });

  it('trata NFC e NFD como o mesmo texto', () => {
    expect(sameText(NFD, NFC)).toBe(true);
  });
});

describe('normalizeQuestion — normalização na ingestão', () => {
  it('grava o enunciado em NFC, mesmo vindo em NFD', () => {
    const q = normalizeQuestion({ statement: NFD, alternatives: { A: 'x', B: 'y' } });
    expect(q).not.toBeNull();
    expect(q!.statement).toBe(NFC);
  });

  it('grava assunto e alternativas em NFC', () => {
    const q = normalizeQuestion({
      statement: 'x',
      topic: 'A\u0301lgebra',
      alternatives: { A: 'Func\u0327a\u0303o' },
    });
    expect(q!.topic).toBe('Álgebra');
    expect(q!.alternatives.A).toBe('Função');
  });
});

describe('questionDeduplicationKey — a mesma questão em codificações diferentes', () => {
  it('produz a mesma chave para NFC e NFD', () => {
    const a = normalizeQuestion({ statement: NFC, source: { label: 'ITA', year: 2025, questionNumber: 13 } })!;
    const b = normalizeQuestion({ statement: NFD, source: { label: 'ITA', year: 2025, questionNumber: 13 } })!;
    expect(questionDeduplicationKey(a)).toBe(questionDeduplicationKey(b));
  });

  it('ignora diferença de acento e de espaço no enunciado', () => {
    const a = normalizeQuestion({ statement: 'Determine a função', source: { label: 'ITA' } })!;
    const b = normalizeQuestion({ statement: 'Determine  a funcao', source: { label: 'ITA' } })!;
    expect(questionDeduplicationKey(a)).toBe(questionDeduplicationKey(b));
  });
});

describe('filterQuestions — busca tolerante a acento', () => {
  const bank = [
    normalizeQuestion({
      statement: 'Seja z um número complexo',
      topic: 'Álgebra',
      subject: 'Matemática',
      source: { label: 'ITA', year: 2025 },
    })!,
  ] as Question[];

  const search = (query: string) =>
    filterQuestions(bank, { query, subject: 'Todas', difficulty: 'Todas', source: 'Todas' });

  it('encontra "Álgebra" buscando "algebra"', () => {
    expect(search('algebra')).toHaveLength(1);
  });

  it('encontra mesmo com caixa e acento trocados', () => {
    expect(search('ALGEBRA')).toHaveLength(1);
    expect(search('álgebra')).toHaveLength(1);
  });

  it('encontra "número" buscando "numero"', () => {
    expect(search('numero')).toHaveLength(1);
  });

  it('não casa o que não existe', () => {
    expect(search('termodinamica')).toHaveLength(0);
  });
});
