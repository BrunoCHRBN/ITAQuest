/**
 * Normalização de texto — a base de três garantias distintas.
 *
 * 1. **Armazenamento** (`canonicalText`): uma única forma canônica em NFC, para que a mesma
 *    string não exista em duas codificações. Isso não é teórico: o PDF oficial do ITA 2025
 *    mistura as duas formas — Matemática e Química vêm em NFC, Física e Inglês em NFD
 *    (24 ocorrências de cada). Sem normalizar, metade do acervo fica invisível à busca e
 *    imune à deduplicação.
 *
 * 2. **Comparação e busca** (`foldText`): forma canônica, sem diacríticos e em minúsculas.
 *    `toLocaleLowerCase` sozinho não remove acento, então "algebra" não encontrava "Álgebra".
 *
 * 3. **Deduplicação**: canônica + espaços colapsados, para que a mesma questão não entre duas
 *    vezes por diferença de quebra de linha ou espaço duplo.
 */

/** Marcas diacríticas combinantes (U+0300–U+036F), expostas por NFD. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

/**
 * Forma canônica de armazenamento: NFC, espaços horizontais colapsados, extremidades aparadas.
 * Preserva quebras de linha — enunciados e resoluções podem ter estrutura de parágrafo.
 */
export function canonicalText(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .normalize('NFC')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Forma de comparação: canônica, sem diacríticos, minúscula, todo espaço (inclusive quebra de
 * linha) reduzido a um espaço. Use isto — nunca `toLowerCase` direto — em busca e em chave de
 * deduplicação.
 */
export function foldText(input: unknown): string {
  return canonicalText(input)
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Duas strings são iguais a menos de acento, caixa e espaço? */
export function sameText(a: unknown, b: unknown): boolean {
  return foldText(a) === foldText(b);
}
