import { describe, expect, it } from 'vitest';
import { auditCoverage, formatRanges } from '../../server/integrity';
import type { ReconciledQuestion } from '../../server/types';

const q = (questionNumber?: number): ReconciledQuestion =>
  ({
    id: `q-${questionNumber ?? 'x'}`,
    subject: 'Matemática',
    topic: 'x',
    difficulty: 'Intermediária',
    statement: 'x',
    alternatives: { A: 'a', B: 'b' },
    source: { label: 'ITA', questionNumber },
    tags: [],
    createdAt: '',
    validationState: 'valida',
    alerts: [],
    hasOfficialKey: false,
    referencedFigures: [],
  }) as ReconciledQuestion;

const numbers = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

describe('auditCoverage — a contagem do gabarito como oráculo', () => {
  it('aprova quando todas as 48 questões foram extraídas', () => {
    const audit = auditCoverage({ questions: numbers(1, 48).map(q), expectedCount: 48 });
    expect(audit.complete).toBe(true);
    expect(audit.verifiable).toBe(true);
    expect(audit.missingNumbers).toEqual([]);
    expect(audit.alerts).toEqual([]);
  });

  it('detecta perda silenciosa: 40 extraídas de 48', () => {
    const extraidas = [...numbers(1, 12), ...numbers(21, 48)].map(q); // faltam 13–20
    const audit = auditCoverage({ questions: extraidas, expectedCount: 48 });

    expect(audit.complete).toBe(false);
    expect(audit.missingNumbers).toEqual([13, 14, 15, 16, 17, 18, 19, 20]);
    expect(audit.alerts).toHaveLength(1);
    expect(audit.alerts[0]).toContain('40 de 48');
    expect(audit.alerts[0]).toContain('13–20');
  });

  it('questão sem número não conta como cobertura', () => {
    const audit = auditCoverage({
      questions: [...numbers(1, 47).map(q), q(undefined)],
      expectedCount: 48,
    });
    expect(audit.missingNumbers).toEqual([48]);
    expect(audit.complete).toBe(false);
  });

  it('sem gabarito, a cobertura é desconhecida — e o aviso diz isso', () => {
    const audit = auditCoverage({ questions: numbers(1, 10).map(q) });
    expect(audit.verifiable).toBe(false);
    expect(audit.complete).toBe(false);
    expect(audit.alerts[0]).toContain('não é possível conferir');
  });

  it('sinaliza mais questões numeradas que o esperado', () => {
    const audit = auditCoverage({ questions: numbers(1, 50).map(q), expectedCount: 48 });
    expect(audit.extraCount).toBe(2);
    expect(audit.complete).toBe(false);
    expect(audit.alerts.some((a) => a.includes('mais que as 48'))).toBe(true);
  });
});

describe('formatRanges', () => {
  it('compacta sequências e isola números soltos', () => {
    expect(formatRanges([13, 14, 15, 20])).toBe('13–15, 20');
    expect(formatRanges([9])).toBe('9');
    expect(formatRanges([])).toBe('');
    expect(formatRanges([3, 1, 2, 7, 9, 8])).toBe('1–3, 7–9');
  });
});
