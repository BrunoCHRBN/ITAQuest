import { deduplicateQuestions, filterQuestions, questionDeduplicationKey } from '/home/bruno-vsantos/rotina-ita-app/src/services/questionService.ts';
import { csvToRows } from '/home/bruno-vsantos/rotina-ita-app/src/services/importService.ts';
import { reconcileExtractedData } from '/home/bruno-vsantos/rotina-ita-app/server/geminiService.ts';

const line = (t: string) => console.log('\n=== ' + t + ' ===');

// ---------- A: a correção de uma questão com alerta é recusada como duplicata ----------
line('A) reimportar versão CORRIGIDA da mesma questão');
const original: any = {
  id: 'gemini-ita-2024-q12-a',
  subject: 'Física',
  topic: 'Mecânica',
  difficulty: 'Avançada',
  statement: 'Um bloco desliza sobre um plano inclinado...',
  alternatives: { A: '1 m/s', B: '2 m/s' }, // faltavam C, D, E -> alerta
  answerKey: 'C',
  source: { label: 'ITA', year: 2024, questionNumber: 12, phase: '1ª fase' },
  tags: [],
  createdAt: new Date().toISOString(),
};
const corrigida: any = {
  ...original,
  id: 'gemini-ita-2024-q12-b',
  alternatives: { A: '1 m/s', B: '2 m/s', C: '3 m/s', D: '4 m/s', E: '5 m/s' }, // correção: completar alternativas
};
const bank = [original];
const r = deduplicateQuestions(bank, [corrigida]);
console.log('chave original :', questionDeduplicationKey(original));
console.log('chave corrigida:', questionDeduplicationKey(corrigida));
console.log(
  `aceitas como novas: ${r.fresh.length} | idênticas ignoradas: ${r.duplicatesCount} | conflitos p/ decisão: ${r.conflicts.length}`
);
console.log(
  '-> a correção entrou?',
  r.fresh.length === 1
    ? 'SIM, como questão nova (errado: duplicaria)'
    : r.conflicts.length === 1
    ? `SIM, como conflito a decidir (diferenças: ${r.conflicts[0].differences.join(', ')})`
    : 'NAO (descartada em silêncio)'
);

// ---------- B: numeração ausente -> duas questões com o mesmo número -> gabarito trocado ----------
line('B) questão sem questionNumber desloca o número e rouba o gabarito');
const rawQuestions: any[] = [
  { questionNumber: 1, statement: 'Q1', alternatives: { A: 'a', B: 'b' }, confidence: 'alta' },
  { statement: 'Q2 sem numero (o modelo nao leu o numero)', alternatives: { A: 'a', B: 'b' }, confidence: 'alta' },
  { questionNumber: 3, statement: 'Q3', alternatives: { A: 'a', B: 'b' }, confidence: 'alta' },
];
const answerKeys: any[] = [
  { questionNumber: 1, officialAnswer: 'A' },
  { questionNumber: 2, officialAnswer: 'B' },
  { questionNumber: 3, officialAnswer: 'C' },
];
const rec = reconcileExtractedData({
  rawQuestions,
  answerKeys,
  examFileName: 'ita-2024.pdf',
  examChecksum: 'abc',
  metadata: { institution: 'ITA', year: 2024, phase: '1ª fase' },
  promptVersion: 'v1.1',
  model: 'x',
});
rec.questions.forEach((q) => console.log(`  nº${q.source.questionNumber} | ${q.statement.slice(0, 40)} | gabarito=${q.answerKey}`));
const nums = rec.questions.map((q) => q.source.questionNumber);
console.log('números duplicados?', new Set(nums).size !== nums.length ? 'SIM -> ' + JSON.stringify(nums) : 'nao');

// ---------- C: busca sem acento ----------
line('C) busca por "algebra" numa questão com "Álgebra"');
const q1: any = { ...original, statement: 'Resolva a equação', topic: 'Álgebra', subject: 'Matemática' };
const found = filterQuestions([q1], { query: 'algebra', subject: 'Todas', difficulty: 'Todas', source: 'Todas' });
const foundAccent = filterQuestions([q1], { query: 'álgebra', subject: 'Todas', difficulty: 'Todas', source: 'Todas' });
console.log('"algebra"  ->', found.length, 'resultado(s)');
console.log('"álgebra"  ->', foundAccent.length, 'resultado(s)');

// ---------- D: CSV exportado por Excel pt-BR (separador ;) ----------
line('D) CSV com ponto-e-vírgula (padrão do Excel pt-BR)');
const csv = 'enunciado;materia;gabarito;A;B\n"Qual a forca?";Fisica;C;1N;2N';
const rows = csvToRows(csv);
console.log('colunas detectadas:', JSON.stringify(Object.keys(rows[0] ?? {})));

// ---------- E: tamanho de uma questão no localStorage ----------
line('E) custo de armazenamento por questão');
const real: any = {
  ...original,
  statement: 'x'.repeat(700), // enunciado típico de ITA com fórmula
  alternatives: { A: 'y'.repeat(60), B: 'y'.repeat(60), C: 'y'.repeat(60), D: 'y'.repeat(60), E: 'y'.repeat(60) },
  explanation: 'z'.repeat(300),
};
const bytes = Buffer.byteLength(JSON.stringify(real), 'utf8');
console.log('bytes/questão (enunciado 700 chars + 5 alt + resolução):', bytes);
console.log('questões que cabem em 5 MB:', Math.floor((5 * 1024 * 1024) / bytes));
console.log('questões que cabem em 5 MB (UTF-16 real do Chrome, 2 bytes/char):', Math.floor((5 * 1024 * 1024) / (bytes * 2)));
