import type { Question, ResponseRecord, StudySession, Subject } from '../types';

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return [hours, minutes, seconds].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatDate(date?: string): string {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  } catch {
    return date;
  }
}

export interface SessionItemStat {
  question: Question;
  response: ResponseRecord;
  isAnswered: boolean;
  hasKey: boolean;
  isCorrect: boolean;
  isWrong: boolean;
}

export interface SessionStats {
  total: number;
  items: SessionItemStat[];
  answeredCount: number;
  unansweredCount: number;
  markedCount: number;
  withKeyCount: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  elapsedSeconds: number;
}

export function calculateSessionStats(session: StudySession, questions: Question[]): SessionStats {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const items: SessionItemStat[] = session.questionIds
    .map((id) => {
      const q = questionMap.get(id);
      if (!q) return null;
      const r = session.responses[id] ?? { notes: '', markedForReview: false, checked: false };
      const isAnswered = Boolean(r.selectedOption || (r.notes && r.notes.trim()));
      // Questão anulada conta como correta para todos os candidatos (regra do gabarito oficial).
      // Antes, ela caía em "sem gabarito" e saía do numerador E do denominador: a nota era
      // calculada sobre 46 em vez de 48.
      const isAnnulled = q.annulled === true;
      const hasKey = Boolean(q.answerKey) || isAnnulled;
      const isCorrect = isAnnulled || Boolean(q.answerKey && r.selectedOption && q.answerKey === r.selectedOption);
      const isWrong = !isAnnulled && Boolean(q.answerKey && r.selectedOption && q.answerKey !== r.selectedOption);

      return {
        question: q,
        response: r,
        isAnswered,
        hasKey,
        isCorrect,
        isWrong,
      };
    })
    .filter((item): item is SessionItemStat => Boolean(item));

  const total = items.length;
  const answeredCount = items.filter((i) => i.isAnswered).length;
  const unansweredCount = total - answeredCount;
  const markedCount = items.filter((i) => i.response.markedForReview).length;
  const withKeyCount = items.filter(
    (i) => i.hasKey && (i.response.selectedOption || i.question.annulled === true)
  ).length;
  const correctCount = items.filter((i) => i.isCorrect).length;
  const wrongCount = withKeyCount - correctCount;
  const accuracy = withKeyCount > 0 ? Math.round((correctCount / withKeyCount) * 100) : 0;

  return {
    total,
    items,
    answeredCount,
    unansweredCount,
    markedCount,
    withKeyCount,
    correctCount,
    wrongCount,
    accuracy,
    elapsedSeconds: session.elapsedSeconds ?? 0,
  };
}

export interface OverviewStats {
  completedSessionsCount: number;
  todayQuestionCount: number;
  todayResolvedCount: number;
  overallAccuracy: number;
  totalAnswered: number;
  totalCorrect: number;
  totalWrong: number;
  totalGraded: number;
  reviewItemsCount: number;
  uniqueReviewedQuestionsCount: number;
  weeklyCompleted: number;
  totalCompletedQuestions: number;
  totalSessions: number;
  inProgressCount: number;
  plannedCount: number;
  goal: number;
  goalProgressPct: number;
}

export interface QuestionResolutionStatus {
  answered: boolean;
  isCorrect: boolean;
  isWrong: boolean;
  markedForReview: boolean;
  lastSessionId?: string;
  lastAnsweredAt?: string;
}

export function getQuestionResolutionMap(
  sessions: StudySession[],
  questions: Question[]
): Map<string, QuestionResolutionStatus> {
  const statusMap = new Map<string, QuestionResolutionStatus>();
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Traverse sessions in chronological order so latest state takes precedence
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const session of sortedSessions) {
    for (const qId of session.questionIds) {
      const resp = session.responses[qId];
      const q = questionMap.get(qId);
      const isAnswered = Boolean(resp?.selectedOption || (resp?.notes && resp.notes.trim()));
      const isAnnulled = q?.annulled === true;
      const hasKey = Boolean(q?.answerKey) || isAnnulled;
      const isCorrect =
        isAnnulled || Boolean(q?.answerKey && resp?.selectedOption && q?.answerKey === resp.selectedOption);
      const isWrong =
        !isAnnulled && Boolean(q?.answerKey && resp?.selectedOption && q?.answerKey !== resp.selectedOption);
      const markedForReview = Boolean(resp?.markedForReview);

      const existing = statusMap.get(qId);
      statusMap.set(qId, {
        answered: isAnswered || (existing?.answered ?? false),
        isCorrect: isCorrect || (existing?.isCorrect ?? false),
        isWrong: isWrong || (existing?.isWrong ?? false),
        markedForReview: markedForReview || (existing?.markedForReview ?? false),
        lastSessionId: isAnswered ? session.id : existing?.lastSessionId,
        lastAnsweredAt: isAnswered ? (session.finishedAt || session.startedAt || session.createdAt) : existing?.lastAnsweredAt,
      });
    }
  }

  return statusMap;
}

export function calculateOverviewStats(sessions: StudySession[], questions: Question[]): OverviewStats {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const completedSessions = sessions.filter((s) => s.status === 'concluída');
  const inProgressSessions = sessions.filter((s) => s.status === 'em_andamento');
  const plannedSessions = sessions.filter((s) => s.status === 'planejada');

  const todayStr = new Date().toDateString();

  // Questions resolved in completed sessions today or in active sessions today
  const todayCompletedCount = completedSessions
    .filter((s) => s.finishedAt && new Date(s.finishedAt).toDateString() === todayStr)
    .reduce((sum, s) => sum + s.questionIds.length, 0);

  // Distinct questions resolved in completed sessions
  const totalCompletedQuestions = completedSessions.reduce((sum, s) => sum + s.questionIds.length, 0);

  const allResponses = completedSessions.flatMap((s) =>
    s.questionIds
      .map((id) => ({
        q: questionMap.get(id),
        r: s.responses[id],
      }))
      .filter((x) => x.q && (x.r?.selectedOption || (x.r?.notes && x.r.notes.trim())))
  );

  const gradedResponses = allResponses.filter(
    ({ q, r }) => Boolean(q && ((q.answerKey && r?.selectedOption) || q.annulled))
  );
  const correctCount = gradedResponses.filter(
    ({ q, r }) => q?.annulled === true || q?.answerKey === r?.selectedOption
  ).length;
  const wrongCount = gradedResponses.length - correctCount;
  const overallAccuracy = gradedResponses.length ? Math.round((correctCount / gradedResponses.length) * 100) : 0;

  const reviewItems = sessions.flatMap((s) =>
    s.questionIds
      .filter((id) => s.responses[id]?.markedForReview)
      .map((id) => ({ session: s, question: questionMap.get(id) }))
  ).filter((item): item is { session: StudySession; question: Question } => Boolean(item.question));

  const uniqueReviewedIds = new Set(reviewItems.map((item) => item.question.id));
  const goal = 100;
  const goalProgressPct = goal > 0 ? Math.min(100, Math.round((totalCompletedQuestions / goal) * 100)) : 0;
  const weeklyCompleted = Math.min(100, totalCompletedQuestions);

  return {
    completedSessionsCount: completedSessions.length,
    todayQuestionCount: todayCompletedCount,
    todayResolvedCount: todayCompletedCount,
    overallAccuracy,
    totalAnswered: allResponses.length,
    totalCorrect: correctCount,
    totalWrong: wrongCount,
    totalGraded: gradedResponses.length,
    reviewItemsCount: reviewItems.length,
    uniqueReviewedQuestionsCount: uniqueReviewedIds.size,
    weeklyCompleted,
    totalCompletedQuestions,
    totalSessions: sessions.length,
    inProgressCount: inProgressSessions.length,
    plannedCount: plannedSessions.length,
    goal,
    goalProgressPct,
  };
}

export interface SubjectStat {
  subject: Subject;
  count: number;
  accuracy: number;
}

export function calculateSubjectStats(
  sessions: StudySession[],
  questions: Question[],
  subjects: Subject[]
): SubjectStat[] {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const completedSessions = sessions.filter((s) => s.status === 'concluída');

  const allResponses = completedSessions.flatMap((s) =>
    s.questionIds
      .map((id) => ({
        q: questionMap.get(id),
        r: s.responses[id],
      }))
      .filter((x) => x.q && (x.r?.selectedOption || (x.r?.notes && x.r.notes.trim())))
  );

  return subjects.map((subject) => {
    const rows = allResponses.filter(({ q }) => q?.subject === subject);
    const correct = rows.filter(
      ({ q, r }) => q?.annulled === true || (q?.answerKey && q.answerKey === r?.selectedOption)
    ).length;
    const graded = rows.filter(({ q }) => Boolean(q?.answerKey || q?.annulled)).length;
    return {
      subject,
      count: rows.length,
      accuracy: graded ? Math.round((correct / graded) * 100) : 0,
    };
  });
}
