import type { Question } from '../types';
import { normalizeQuestion, OPTION_LETTERS } from './questionService';

export interface ParseResult {
  questions: Question[];
  warnings: string[];
}

export function csvToRows(text: string): Record<string, string>[] {
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, ''); // Strip BOM

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"' && quoted && source[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if (char === '\n' && !quoted) {
      row.push(cell);
      lines.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    lines.push(row);
  }

  if (lines.length < 2) return [];

  const header = lines[0].map((h) => h.trim().toLowerCase());
  return lines
    .slice(1)
    .filter((r) => r.some((v) => v.trim()))
    .map((values) => Object.fromEntries(header.map((h, i) => [h, values[i] ?? ''])));
}

export function resolveImportedFile(text: string, filename: string): ParseResult {
  const warnings: string[] = [];
  let rawItems: any[];

  if (filename.toLowerCase().endsWith('.csv')) {
    const rows = csvToRows(text);
    if (rows.length === 0) {
      throw new Error('O arquivo CSV está vazio ou não possui cabeçalhos válidos.');
    }

    rawItems = rows.map((row, index) => {
      const alternatives: Record<string, string> = {};
      OPTION_LETTERS.forEach((l) => {
        const val = row[l.toLowerCase()] ?? row[l];
        if (val && val.trim()) {
          alternatives[l] = val.trim();
        }
      });

      return {
        statement: row.statement ?? row.enunciado ?? row.pergunta,
        subject: row.subject ?? row.materia ?? row.disciplina,
        topic: row.topic ?? row.assunto ?? row.conteudo,
        difficulty: row.difficulty ?? row.dificuldade,
        answerKey: row.answerkey ?? row.gabarito ?? row.resposta,
        explanation: row.explanation ?? row.resolucao ?? row.explicacao,
        alternatives,
        source: {
          label: row.source ?? row.origem ?? row.instituicao ?? filename,
          year: row.year ? Number(row.year) : row.ano ? Number(row.ano) : undefined,
          phase: row.phase ?? row.fase,
          questionNumber: row.questionnumber ? Number(row.questionnumber) : row.numero ? Number(row.numero) : undefined,
          fileName: filename,
          page: row.page ? Number(row.page) : row.pagina ? Number(row.pagina) : undefined,
        },
        _rowNumber: index + 2,
      };
    });
  } else {
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error('JSON inválido. Verifique a sintaxe do arquivo enviado.');
    }

    const list = Array.isArray(parsed)
      ? parsed
      : parsed?.questions ?? parsed?.questoes ?? parsed?.itens ?? parsed?.items;

    if (!Array.isArray(list)) {
      throw new Error('O arquivo deve conter uma lista de questões ou um objeto com a propriedade "questions".');
    }
    rawItems = list;
  }

  const questions: Question[] = [];

  rawItems.forEach((raw, idx) => {
    const indexLabel = raw._rowNumber ? `linha ${raw._rowNumber}` : `item ${idx + 1}`;

    if (!raw || typeof raw !== 'object') {
      warnings.push(`Item ignorado (${indexLabel}): não é um objeto válido.`);
      return;
    }

    const normalized = normalizeQuestion(raw);
    if (!normalized) {
      warnings.push(`Item ignorado (${indexLabel}): enunciado ausente ou vazio.`);
      return;
    }

    // Attach file name if not present
    if (!normalized.source.fileName) {
      normalized.source.fileName = filename;
    }

    // Validate alternatives and answer key
    const altKeys = Object.keys(normalized.alternatives);
    if (altKeys.length > 0 && altKeys.length < 2) {
      warnings.push(`Aviso na ${indexLabel}: possui apenas uma alternativa. Recomenda-se no mínimo 2 ou nenhuma (discursiva).`);
    }

    if (normalized.answerKey && altKeys.length > 0 && !normalized.alternatives[normalized.answerKey]) {
      warnings.push(`Aviso na ${indexLabel}: gabarito "${normalized.answerKey}" não está entre as alternativas.`);
    }

    questions.push(normalized);
  });

  return { questions, warnings };
}

export function generateTemplateJson(): string {
  const example = [
    {
      subject: 'Matemática',
      topic: 'Álgebra',
      difficulty: 'Intermediária',
      statement: 'Enunciado da questão...',
      alternatives: {
        A: 'Alternativa A',
        B: 'Alternativa B',
        C: 'Alternativa C',
        D: 'Alternativa D',
        E: 'Alternativa E',
      },
      answerKey: 'C',
      explanation: 'Resolução comentada...',
      source: {
        label: 'ITA',
        year: 2024,
        phase: '1ª fase',
        questionNumber: 1,
        fileName: 'ita-2024.pdf',
        page: 1,
      },
      tags: ['álgebra'],
    },
  ];

  return JSON.stringify({ questions: example }, null, 2);
}
