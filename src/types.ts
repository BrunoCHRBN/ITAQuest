export type Subject = 'Matemática' | 'Física' | 'Química' | 'Português' | 'Inglês' | 'Redação' | 'Outra';
export type Difficulty = 'Básica' | 'Intermediária' | 'Avançada';
export type StudyMode = 'treino' | 'simulado';
export type SessionStatus = 'planejada' | 'em_andamento' | 'concluída';

export type View = 'overview' | 'bank' | 'sessions' | 'stats' | 'reviews' | 'resolver' | 'results';
export type NoticeType = 'success' | 'error' | 'info';

export interface Notice {
  type: NoticeType;
  text: string;
}

export interface QuestionSource {
  label: string;
  year?: number;
  phase?: string;
  questionNumber?: number;
  fileName?: string;
  page?: number;
  checksum?: string;
  promptVersion?: string;
  model?: string;
  gabaritoOficialSource?: string;
}

export interface Question {
  id: string;
  subject: Subject;
  topic: string;
  difficulty: Difficulty;
  statement: string;
  alternatives: Record<string, string>;
  answerKey?: string;
  explanation?: string;
  source: QuestionSource;
  tags: string[];
  createdAt: string;
  validationState?: 'valida' | 'com_alertas' | 'incompleta';
  alerts?: string[];
  hasOfficialKey?: boolean;
  referencedFigures?: string[];
}

export type TriageRound = 'imediata' | 'trabalhosa' | 'combate';

export interface ResponseRecord {
  selectedOption?: string;
  notes: string;
  markedForReview: boolean;
  checked: boolean;
  triage?: TriageRound;
}

export interface StudySession {
  id: string;
  title: string;
  mode: StudyMode;
  status: SessionStatus;
  questionIds: string[];
  responses: Record<string, ResponseRecord>;
  currentIndex: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  timerMinutes?: number;
  elapsedSeconds?: number;
}

export type QuestionStatusFilter =
  | 'todas'
  | 'nao_resolvidas'
  | 'resolvidas'
  | 'acertos'
  | 'erros'
  | 'para_revisar';

export type QuestionSortOption =
  | 'recentes'
  | 'antigas'
  | 'numero'
  | 'materia'
  | 'dificuldade';

export interface QuestionFilters {
  query: string;
  subject: string;
  difficulty: string;
  source: string;
  year?: string;
  topic?: string;
  status?: QuestionStatusFilter;
  sortBy?: QuestionSortOption;
}

export interface BackupData {
  version: '1.0';
  app: 'rotina-ita';
  exportedAt: string;
  questions: Question[];
  sessions: StudySession[];
}

export type RestoreStrategy = 'merge' | 'replace';

export interface RestoreResult {
  restoredQuestions: number;
  restoredSessions: number;
  skippedDuplicates: number;
  strategy: RestoreStrategy;
}
