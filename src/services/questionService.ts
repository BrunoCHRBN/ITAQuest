import type { Difficulty, Question, QuestionFilters, ResponseRecord, Subject } from '../types';
import { canonicalText, foldText } from './textService';

export const SUBJECTS: Subject[] = ['Matemática', 'Física', 'Química', 'Português', 'Inglês', 'Redação', 'Outra'];
export const DIFFICULTIES: Difficulty[] = ['Básica', 'Intermediária', 'Avançada'];
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];

export function uid(prefix = 'q'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function emptyResponse(): ResponseRecord {
  return { notes: '', markedForReview: false, checked: false };
}

export function normalizeQuestion(raw: any): Question | null {
  if (!raw || typeof raw !== 'object') return null;

  const statement = canonicalText(raw.statement ?? raw.enunciado ?? raw.question ?? '');
  if (!statement) return null;

  const rawAlternatives = raw.alternatives ?? raw.alternativas ?? raw.options;
  const alternatives: Record<string, string> = {};

  if (Array.isArray(rawAlternatives)) {
    rawAlternatives.forEach((value: any, index: number) => {
      const key = OPTION_LETTERS[index] ?? String(index + 1);
      alternatives[key] = canonicalText(
        typeof value === 'object' && value !== null ? value.text ?? value.texto ?? value.value ?? '' : value
      );
    });
  } else if (rawAlternatives && typeof rawAlternatives === 'object') {
    Object.entries(rawAlternatives).forEach(([k, v]) => {
      alternatives[k.toUpperCase().trim()] = canonicalText(v ?? '');
    });
  }

  const subjectInput = canonicalText(raw.subject ?? raw.materia ?? 'Outra');
  const matchedSubject = SUBJECTS.find((v) => foldText(v) === foldText(subjectInput)) ?? 'Outra';

  const diffInput = foldText(raw.difficulty ?? raw.dificuldade ?? 'Intermediária');
  const difficulty: Difficulty =
    diffInput.includes('bás') || diffInput.includes('bas') || diffInput.includes('fácil') || diffInput.includes('facil')
      ? 'Básica'
      : diffInput.includes('avan') || diffInput.includes('difícil') || diffInput.includes('dificil')
      ? 'Avançada'
      : 'Intermediária';

  const sourceRaw = raw.source ?? raw.origem ?? {};
  const source: Question['source'] =
    typeof sourceRaw === 'string'
      ? { label: canonicalText(sourceRaw) || 'Importada' }
      : {
          label: canonicalText(sourceRaw.label ?? sourceRaw.institution ?? sourceRaw.instituicao ?? 'Importada') || 'Importada',
          year: Number(sourceRaw.year ?? sourceRaw.ano) || undefined,
          phase: canonicalText(sourceRaw.phase ?? sourceRaw.fase ?? '') || undefined,
          questionNumber: Number(sourceRaw.questionNumber ?? sourceRaw.numero) || undefined,
          order: Number(sourceRaw.order ?? sourceRaw.ordem) || undefined,
          fileName: canonicalText(sourceRaw.fileName ?? sourceRaw.arquivo ?? '') || undefined,
          page: Number(sourceRaw.page ?? sourceRaw.pagina) || undefined,
        };

  const answer = String(raw.answerKey ?? raw.gabarito ?? raw.resposta ?? '').toUpperCase().trim();

  return {
    id: String(raw.id ?? uid('import')),
    subject: matchedSubject,
    topic: canonicalText(raw.topic ?? raw.assunto ?? 'Sem assunto definido'),
    difficulty,
    statement,
    alternatives,
    answerKey: answer || undefined,
    explanation: canonicalText(raw.explanation ?? raw.resolucao ?? raw.explicacao ?? '') || undefined,
    source,
    tags: Array.isArray(raw.tags) ? raw.tags.map((x: unknown) => canonicalText(x)).filter(Boolean) : [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    annulled: raw.annulled === true,
  };
}

export function validateQuestion(q: Partial<Question>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!q.statement || !q.statement.trim()) {
    errors.push('O enunciado da questão é obrigatório.');
  }

  if (q.subject && !SUBJECTS.includes(q.subject)) {
    errors.push(`Matéria inválida: ${q.subject}.`);
  }

  if (q.difficulty && !DIFFICULTIES.includes(q.difficulty)) {
    errors.push(`Dificuldade inválida: ${q.difficulty}.`);
  }

  if (q.alternatives) {
    const altKeys = Object.keys(q.alternatives);
    if (altKeys.length > 0 && altKeys.length < 2) {
      errors.push('Adicione ao menos duas alternativas ou deixe todas em branco para questão discursiva.');
    }
    if (q.answerKey && !q.alternatives[q.answerKey]) {
      errors.push(`Gabarito "${q.answerKey}" não corresponde a nenhuma alternativa fornecida.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function questionDeduplicationKey(q: Question): string {
  const label = foldText(q.source.label);
  const year = q.source.year ?? '';
  const num = q.source.questionNumber ?? '';
  // `foldText` remove acento, caixa e diferença de espaço: a mesma questão vinda do PDF em NFD
  // e do CSV em NFC tem de colidir aqui.
  const statement = foldText(q.statement);
  return `${label}|${year}|${num}|${statement}`;
}

export function deduplicateQuestions(
  existing: Question[],
  incoming: Question[]
): { fresh: Question[]; duplicatesCount: number } {
  const seenHashes = new Set(existing.map(questionDeduplicationKey));
  const seenIds = new Set(existing.map((q) => q.id));
  const fresh: Question[] = [];
  let duplicatesCount = 0;

  for (const question of incoming) {
    const hash = questionDeduplicationKey(question);
    if (seenHashes.has(hash)) {
      duplicatesCount++;
      continue;
    }
    seenHashes.add(hash);
    const safeId = seenIds.has(question.id) ? uid('import') : question.id;
    seenIds.add(safeId);
    fresh.push({ ...question, id: safeId });
  }

  return { fresh, duplicatesCount };
}

export function filterQuestions(
  questions: Question[],
  filters: QuestionFilters,
  statusMap?: Map<string, { answered: boolean; isCorrect: boolean; isWrong: boolean; markedForReview: boolean }>
): Question[] {
  // `foldText` nos dois lados: sem isto, "algebra" não encontra "Álgebra" e um enunciado em NFD
  // nunca casa com a consulta digitada no teclado (que produz NFC).
  const normalized = foldText(filters.query);

  const filtered = questions.filter((q) => {
    const haystack = foldText(
      [
        q.statement,
        q.topic,
        q.subject,
        q.source.label,
        q.source.year ?? '',
        q.source.questionNumber ? `questão ${q.source.questionNumber}` : '',
        ...(q.tags ?? []),
      ].join(' ')
    );

    // Text query
    if (normalized && !haystack.includes(normalized)) return false;

    // Subject
    if (filters.subject && filters.subject !== 'Todas' && q.subject !== filters.subject) {
      return false;
    }

    // Difficulty
    if (filters.difficulty && filters.difficulty !== 'Todas' && q.difficulty !== filters.difficulty) {
      return false;
    }

    // Source
    if (filters.source && filters.source !== 'Todas' && !q.source.label.toLowerCase().includes(filters.source.toLowerCase())) {
      return false;
    }

    // Year
    if (filters.year && filters.year !== 'Todos' && String(q.source.year) !== filters.year) {
      return false;
    }

    // Topic
    if (filters.topic && filters.topic !== 'Todos' && q.topic.toLowerCase() !== filters.topic.toLowerCase()) {
      return false;
    }

    // Resolution Status (if statusMap is provided)
    if (filters.status && filters.status !== 'todas' && statusMap) {
      const status = statusMap.get(q.id);
      switch (filters.status) {
        case 'nao_resolvidas':
          if (status?.answered) return false;
          break;
        case 'resolvidas':
          if (!status?.answered) return false;
          break;
        case 'acertos':
          if (!status?.isCorrect) return false;
          break;
        case 'erros':
          if (!status?.isWrong) return false;
          break;
        case 'para_revisar':
          if (!status?.markedForReview) return false;
          break;
      }
    }

    return true;
  });

  // Sorting
  const sortBy = filters.sortBy || 'recentes';
  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'antigas':
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case 'numero': {
        const numA = a.source.questionNumber ?? 999999;
        const numB = b.source.questionNumber ?? 999999;
        return numA - numB;
      }
      case 'materia':
        return a.subject.localeCompare(b.subject, 'pt-BR');
      case 'dificuldade': {
        const diffWeight = { Básica: 1, Intermediária: 2, Avançada: 3 };
        return (diffWeight[a.difficulty] ?? 2) - (diffWeight[b.difficulty] ?? 2);
      }
      case 'recentes':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
}
