import type { ImportBatch, Question } from '../types';

/**
 * Lote de importação: a unidade que faltava para o acervo ser mantível.
 *
 * Sem ele o banco é write-once — se 90 questões de uma extração ruim entram, a única saída era
 * "Zerar banco". Com ele, "desfazer" é uma operação de primeira classe, e o histórico de
 * importações passa a existir ("quais provas já ingeri?").
 */

/** No máximo isto de histórico: o suficiente para desfazer, longe de encher o localStorage. */
export const MAX_BATCHES = 50;

export function makeImportBatch(params: {
  id: string;
  createdAt?: string;
  /** Questões que representam o documento (usadas para rotular o lote). */
  representative: Question[];
  created: string[];
  replaced: Array<{ id: string; previous: Question }>;
}): ImportBatch {
  const { id, representative, created, replaced } = params;
  const first = representative.find((q) => q.source?.label);

  const source: ImportBatch['source'] = representative.some((q) => q.source?.checksum)
    ? 'gemini'
    : first?.source?.label === 'Cadastro manual'
    ? 'manual'
    : 'arquivo';

  return {
    id,
    createdAt: params.createdAt ?? new Date().toISOString(),
    source,
    document: first
      ? {
          label: first.source.label,
          year: first.source.year,
          phase: first.source.phase,
          checksum: first.source.checksum,
        }
      : undefined,
    created,
    replaced,
  };
}

/**
 * Desfaz um lote: remove o que ele criou e devolve as versões que ele substituiu.
 *
 * Função pura para poder ser testada contra o defeito — o modo de falha aqui é silencioso
 * (remover questão a mais, ou não restaurar a anterior).
 */
export function undoBatch(questions: Question[], batch: ImportBatch): Question[] {
  const createdIds = new Set(batch.created);
  const previousById = new Map(batch.replaced.map((r) => [r.id, r.previous]));

  return questions
    .filter((q) => !createdIds.has(q.id))
    .map((q) => previousById.get(q.id) ?? q);
}
