export type ExtractionJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type Subject = 'Matemática' | 'Física' | 'Química' | 'Português' | 'Inglês' | 'Redação' | 'Outra';
export type Difficulty = 'Básica' | 'Intermediária' | 'Avançada';

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

export interface ExtractedQuestionRaw {
  questionNumber?: number;
  statement: string;
  alternatives: Record<string, string>;
  suggestedSubject?: string;
  suggestedTopic?: string;
  suggestedDifficulty?: string;
  referencedFigures?: string[];
  page?: number;
  confidence?: 'alta' | 'media' | 'baixa';
  internalNotes?: string;
}

export interface ExtractedAnswerKeyItem {
  questionNumber: number;
  officialAnswer?: string;
  isCancelledOrAnnulled?: boolean;
  notes?: string;
}

export interface ReconciledQuestion {
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
  validationState: 'valida' | 'com_alertas' | 'incompleta';
  alerts: string[];
  hasOfficialKey: boolean;
  referencedFigures: string[];
}

export interface ExtractionJob {
  id: string;
  status: ExtractionJobStatus;
  progress: number;
  step: string;
  createdAt: string;
  updatedAt: string;
  examFileName: string;
  examChecksum: string;
  answerKeyFileName?: string;
  answerKeyChecksum?: string;
  metadata: {
    institution: string;
    year?: number;
    phase?: string;
  };
  questions: ReconciledQuestion[];
  reviewQueue: ReconciledQuestion[];
  error?: string;
}
