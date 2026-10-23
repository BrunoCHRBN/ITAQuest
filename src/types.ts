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
  /** Número impresso na prova. Pode faltar — o modelo nem sempre o lê. */
  questionNumber?: number;
  /**
   * Posição ordinal da questão no documento (1-based). Sempre presente quando a questão veio de
   * extração. Existe para nunca confundir "não sei o número" com "é a questão N": usar o ordinal
   * como número fazia duas questões reivindicarem o mesmo número e uma delas herdar o gabarito
   * da outra.
   */
  order?: number;
  fileName?: string;
  page?: number;
  checksum?: string;
  promptVersion?: string;
  model?: string;
  gabaritoOficialSource?: string;
  /** Checksum do documento de gabarito de onde a resposta veio. */
  answerKeyChecksum?: string;
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
  /**
   * Anulada pelo gabarito oficial. Não é o mesmo que "sem gabarito": a questão anulada conta
   * como correta para todos os candidatos, e tratá-la como ausente de dado fazia a nota ser
   * calculada sobre 46 em vez de 48.
   */
  annulled?: boolean;
  /** Lote de importação que trouxe esta questão. É o que permite desfazer uma importação. */
  batchId?: string;
}

/**
 * Registro de uma importação. Sem isso, o banco é write-once: se 90 questões de uma extração
 * ruim entram, a única saída era "Zerar banco".
 *
 * Guarda também as versões substituídas, para que "desfazer" seja completo.
 */
export interface ImportBatch {
  id: string;
  createdAt: string;
  source: 'arquivo' | 'gemini' | 'manual';
  document?: {
    label: string;
    year?: number;
    phase?: string;
    checksum?: string;
  };
  /** Ids das questões criadas por este lote. */
  created: string[];
  /** Questões que este lote substituiu, com a versão anterior preservada. */
  replaced: Array<{ id: string; previous: Question }>;
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

/**
 * Eixo de validação do acervo. Fica separado do estado de resolução de propósito: são perguntas
 * diferentes ("esta questão está correta?" vs "eu já resolvi esta questão?").
 */
export type QuestionValidationFilter =
  | 'todas'
  | 'com_alertas'
  | 'sem_gabarito'
  | 'com_figura'
  | 'incompleta'
  | 'valida';

export interface QuestionFilters {
  query: string;
  subject: string;
  difficulty: string;
  source: string;
  year?: string;
  topic?: string;
  status?: QuestionStatusFilter;
  validation?: QuestionValidationFilter;
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
