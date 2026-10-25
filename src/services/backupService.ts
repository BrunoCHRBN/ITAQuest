import type { BackupData, Question, RestoreResult, RestoreStrategy, StudySession } from '../types';
import { deduplicateQuestions, normalizeQuestion } from './questionService';

export function createBackup(questions: Question[], sessions: StudySession[]): BackupData {
  return {
    version: '1.0',
    app: 'itaquest',
    exportedAt: new Date().toISOString(),
    questions,
    sessions,
  };
}

export function validateBackup(raw: unknown): { valid: boolean; errors: string[]; backup?: BackupData } {
  const errors: string[] = [];

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['O arquivo de backup não contém um objeto JSON válido.'] };
  }

  const data = raw as Partial<BackupData>;

  if (data.app !== 'itaquest' && data.app !== 'rotina-ita') {
    errors.push('O arquivo não foi reconhecido como um backup válido do ITAQuest.');
  }

  if (!data.version) {
    errors.push('Versão do formato de backup ausente.');
  } else if (data.version !== '1.0') {
    errors.push(`Versão de backup não suportada: "${data.version}". Apenas versão 1.0 é suportada no momento.`);
  }

  if (!Array.isArray(data.questions)) {
    errors.push('O campo "questions" deve ser uma lista de questões.');
  }

  if (!Array.isArray(data.sessions)) {
    errors.push('O campo "sessions" deve ser uma lista de sessões.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate individual questions and sessions
  const validQuestions: Question[] = [];
  data.questions!.forEach((q, idx) => {
    const normalized = normalizeQuestion(q);
    if (!normalized) {
      errors.push(`Questão no índice ${idx} é inválida (sem enunciado).`);
    } else {
      validQuestions.push(normalized);
    }
  });

  const validSessions: StudySession[] = [];
  data.sessions!.forEach((s, idx) => {
    if (!s || typeof s !== 'object' || !s.id || !Array.isArray(s.questionIds)) {
      errors.push(`Sessão no índice ${idx} é inválida (id ou lista de questões ausente).`);
    } else {
      validSessions.push({
        id: String(s.id),
        title: String(s.title || 'Sessão restaurada'),
        mode: s.mode === 'simulado' ? 'simulado' : 'treino',
        status: s.status === 'concluída' ? 'concluída' : s.status === 'em_andamento' ? 'em_andamento' : 'planejada',
        questionIds: s.questionIds.map(String),
        responses: typeof s.responses === 'object' && s.responses !== null ? s.responses : {},
        currentIndex: Number(s.currentIndex) || 0,
        createdAt: String(s.createdAt || new Date().toISOString()),
        startedAt: s.startedAt ? String(s.startedAt) : undefined,
        finishedAt: s.finishedAt ? String(s.finishedAt) : undefined,
        timerMinutes: s.timerMinutes ? Number(s.timerMinutes) : undefined,
        elapsedSeconds: s.elapsedSeconds ? Number(s.elapsedSeconds) : undefined,
      });
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    backup: {
      version: '1.0',
      app: 'rotina-ita',
      exportedAt: String(data.exportedAt || new Date().toISOString()),
      questions: validQuestions,
      sessions: validSessions,
    },
  };
}

export function restoreBackup(
  currentQuestions: Question[],
  currentSessions: StudySession[],
  backup: BackupData,
  strategy: RestoreStrategy
): { questions: Question[]; sessions: StudySession[]; result: RestoreResult } {
  if (strategy === 'replace') {
    return {
      questions: backup.questions,
      sessions: backup.sessions,
      result: {
        restoredQuestions: backup.questions.length,
        restoredSessions: backup.sessions.length,
        skippedDuplicates: 0,
        strategy: 'replace',
      },
    };
  }

  // Merge strategy
  const { fresh: newQuestions, duplicatesCount } = deduplicateQuestions(currentQuestions, backup.questions);
  const mergedQuestions = [...newQuestions, ...currentQuestions];

  const existingSessionIds = new Set(currentSessions.map((s) => s.id));
  const newSessions = backup.sessions.filter((s) => !existingSessionIds.has(s.id));
  const mergedSessions = [...newSessions, ...currentSessions];

  return {
    questions: mergedQuestions,
    sessions: mergedSessions,
    result: {
      restoredQuestions: newQuestions.length,
      restoredSessions: newSessions.length,
      skippedDuplicates: duplicatesCount,
      strategy: 'merge',
    },
  };
}

export function downloadJsonFile(data: unknown, filename: string) {
  if (typeof window === 'undefined') return;
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
