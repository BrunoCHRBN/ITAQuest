import type { ReconciledQuestion } from './types';

export interface CoverageAudit {
  expectedCount?: number;
  extractedCount: number;
  missingNumbers: number[];
  extraCount: number;
  alerts: string[];
  /** true quando a extração cobriu o documento. Sem `expectedCount` não há como afirmar. */
  complete: boolean;
  /** Houve com o que comparar? Sem gabarito, a cobertura é desconhecida — não "completa". */
  verifiable: boolean;
}

/**
 * Confere a cobertura da extração contra a contagem esperada.
 *
 * O gabarito oficial tem uma linha por questão, então é um oráculo de contagem de graça: se o
 * gabarito tem 48 linhas, a prova tem 48 questões. Antes desta função, uma extração que perdia
 * 8 de 48 terminava com status "completed" e uma mensagem de sucesso — a perda era invisível.
 *
 * Função pura, sem I/O: é o que permite testá-la contra o defeito.
 */
export function auditCoverage(params: {
  questions: ReconciledQuestion[];
  expectedCount?: number;
}): CoverageAudit {
  const { questions, expectedCount } = params;
  const extractedCount = questions.length;

  if (!expectedCount || expectedCount <= 0) {
    return {
      expectedCount,
      extractedCount,
      missingNumbers: [],
      extraCount: 0,
      alerts: [
        'Sem gabarito anexado: não é possível conferir se a extração cobriu o documento inteiro.',
      ],
      complete: false,
      verifiable: false,
    };
  }

  const present = new Set(
    questions
      .map((q) => q.source.questionNumber)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
  );

  const missingNumbers: number[] = [];
  for (let n = 1; n <= expectedCount; n++) {
    if (!present.has(n)) missingNumbers.push(n);
  }

  const extraCount = Math.max(0, present.size - expectedCount);
  const alerts: string[] = [];

  if (missingNumbers.length > 0) {
    alerts.push(
      `Extração incompleta: ${present.size} de ${expectedCount} questões identificadas. Faltam as questões ${formatRanges(
        missingNumbers
      )}.`
    );
  }

  if (extraCount > 0) {
    alerts.push(
      `Foram identificadas ${present.size} questões numeradas, mais que as ${expectedCount} esperadas pelo gabarito.`
    );
  }

  return {
    expectedCount,
    extractedCount,
    missingNumbers,
    extraCount,
    alerts,
    complete: missingNumbers.length === 0 && extraCount === 0,
    verifiable: true,
  };
}

/** [13,14,15,20] -> "13–15, 20" */
export function formatRanges(numbers: number[]): string {
  if (numbers.length === 0) return '';
  const sorted = [...numbers].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  parts.push(start === prev ? String(start) : `${start}–${prev}`);
  return parts.join(', ');
}
