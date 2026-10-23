import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  FileText,
  FileUp,
  GraduationCap,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type { Question } from '../../types';
import { ModalShell } from '../common/ModalShell';

interface ReconciledQuestionBackend {
  id: string;
  subject: string;
  topic: string;
  difficulty: string;
  statement: string;
  alternatives: Record<string, string>;
  answerKey?: string;
  explanation?: string;
  source: {
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
  };
  tags: string[];
  createdAt: string;
  validationState: 'valida' | 'com_alertas' | 'incompleta';
  alerts: string[];
  hasOfficialKey: boolean;
  referencedFigures: string[];
}

interface ExtractionJobResponse {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'completed_with_gaps' | 'failed' | 'cancelled';
  progress: number;
  step: string;
  examFileName: string;
  examChecksum: string;
  answerKeyFileName?: string;
  answerKeyChecksum?: string;
  metadata: {
    institution: string;
    year?: number;
    phase?: string;
  };
  questions: ReconciledQuestionBackend[];
  reviewQueue: ReconciledQuestionBackend[];
  expectedCount?: number;
  missingNumbers?: number[];
  alerts?: string[];
  error?: string;
}

function formatErrorMessage(err?: string): string {
  if (!err) return 'Ocorreu um erro ao processar o PDF.';
  try {
    const parsed = JSON.parse(err);
    if (parsed.error?.message) {
      if (parsed.error.code === 503 || parsed.error.status === 'UNAVAILABLE') {
        return 'Alta demanda temporária nos servidores do Gemini (código 503). O sistema efetuará novas tentativas com modelos alternativos automaticamente.';
      }
      return parsed.error.message;
    }
  } catch {
    // String is not JSON, return as is
  }
  return err;
}

interface GeminiImportModalProps {
  onClose: () => void;
  onImport: (questions: Question[], warnings: string[]) => void;
  onError: (message: string) => void;
}

export function GeminiImportModal({ onClose, onImport, onError }: GeminiImportModalProps) {
  const [examFile, setExamFile] = useState<File | null>(null);
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [institution, setInstitution] = useState('ITA');
  const [year, setYear] = useState('2024');
  const [phase, setPhase] = useState('1ª fase');

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<ExtractionJobResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'exceptions'>('all');

  const pollIntervalRef = useRef<number | null>(null);

  // Poll job status
  useEffect(() => {
    if (!jobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/extract/jobs/${jobId}`);
        if (!res.ok) throw new Error('Não foi possível verificar status da extração.');
        const data: ExtractionJobResponse = await res.json();
        setJobData(data);

        if (
          data.status === 'completed' ||
          data.status === 'completed_with_gaps' ||
          data.status === 'failed' ||
          data.status === 'cancelled'
        ) {
          if (pollIntervalRef.current) {
            window.clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    poll();
    pollIntervalRef.current = window.setInterval(poll, 1500);

    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [jobId]);

  const handleStartExtraction = async () => {
    if (!examFile) {
      onError('Selecione o arquivo PDF da prova.');
      return;
    }

    setLoading(true);
    setJobData(null);

    const formData = new FormData();
    formData.append('examPdf', examFile);
    if (answerKeyFile) {
      formData.append('answerKeyPdf', answerKeyFile);
    }
    formData.append('institution', institution.trim() || 'ITA');
    if (year.trim()) formData.append('year', year.trim());
    if (phase.trim()) formData.append('phase', phase.trim());

    try {
      const res = await fetch('/api/extract/jobs', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Falha ao iniciar processo de extração.');
      }

      const json = await res.json();
      setJobId(json.jobId);
    } catch (err) {
      setLoading(false);
      onError(err instanceof Error ? err.message : 'Falha na conexão com o servidor de extração.');
    }
  };

  const handleCancelExtraction = async () => {
    if (!jobId) return;
    try {
      await fetch(`/api/extract/jobs/${jobId}/cancel`, { method: 'POST' });
      setLoading(false);
    } catch (err) {
      console.error('Cancel error:', err);
    }
  };

  const handleConfirmImport = () => {
    if (!jobData || !jobData.questions.length) return;

    const mappedQuestions: Question[] = jobData.questions.map((q) => ({
      id: q.id,
      subject: q.subject as any,
      topic: q.topic,
      difficulty: q.difficulty as any,
      statement: q.statement,
      alternatives: q.alternatives,
      answerKey: q.answerKey,
      explanation: q.explanation,
      source: {
        label: q.source.label,
        year: q.source.year,
        phase: q.source.phase,
        questionNumber: q.source.questionNumber,
        fileName: q.source.fileName,
        page: q.source.page,
        checksum: q.source.checksum,
        promptVersion: q.source.promptVersion,
        model: q.source.model,
        gabaritoOficialSource: q.source.gabaritoOficialSource,
      },
      tags: q.tags,
      createdAt: q.createdAt,
      validationState: q.validationState,
      alerts: q.alerts,
      hasOfficialKey: q.hasOfficialKey,
      referencedFigures: q.referencedFigures,
    }));

    const allAlerts = jobData.questions.flatMap((q) =>
      q.alerts.map((a) => `Questão ${q.source.questionNumber || '—'}: ${a}`)
    );

    onImport(mappedQuestions, allAlerts);
  };

  const questionsToShow =
    jobData && activeTab === 'exceptions' ? jobData.reviewQueue : jobData?.questions ?? [];

  return (
    <ModalShell
      title="Importar Prova via Gemini"
      subtitle="Extração multimodal de cadernos de prova em PDF com reconciliação determinística de gabarito."
      onClose={onClose}
    >
      <div className="modal-form">
        {!jobData ||
        (jobData.status !== 'completed' &&
          jobData.status !== 'completed_with_gaps' &&
          jobData.status !== 'failed') ? (
          <>
            <div className="form-grid-two">
              <label className="field-label">
                Instituição
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Ex.: ITA"
                  disabled={loading}
                />
              </label>

              <label className="field-label">
                Ano da Prova
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="Ex.: 2024"
                  disabled={loading}
                />
              </label>
            </div>

            <label className="field-label">
              Fase ou Caderno
              <input
                value={phase}
                onChange={(e) => setPhase(e.target.value)}
                placeholder="Ex.: 1ª fase, 2ª fase, Caderno A"
                disabled={loading}
              />
            </label>

            <div className="import-dropzone" style={{ margin: '14px 0 10px', padding: '20px 14px' }}>
              <div className="import-file-icon">
                <FileText size={22} />
              </div>
              <h3>Caderno de Prova (PDF) *</h3>
              <p style={{ margin: '4px 0 10px' }}>
                {examFile ? `Selecionado: ${examFile.name} (${(examFile.size / 1024 / 1024).toFixed(1)} MB)` : 'Selecione o arquivo PDF oficial contendo as questões.'}
              </p>
              <label className="button button-primary import-browse">
                <FileUp size={15} /> {examFile ? 'Alterar prova PDF' : 'Escolher PDF da prova'}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={loading}
                  onChange={(e) => setExamFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            <div className="import-dropzone" style={{ margin: '0 0 14px', padding: '16px 14px', background: 'rgba(255,254,250,.45)' }}>
              <div className="import-file-icon" style={{ background: '#f2ecdc', color: '#8a744c' }}>
                <GraduationCap size={20} />
              </div>
              <h3 style={{ fontSize: 16 }}>Gabarito Oficial (PDF opcional)</h3>
              <p style={{ margin: '4px 0 10px' }}>
                {answerKeyFile
                  ? `Selecionado: ${answerKeyFile.name}`
                  : 'Fonte separada de gabarito para vincular as respostas oficiais sem presunção.'}
              </p>
              <label className="button button-secondary import-browse">
                <FileUp size={15} /> {answerKeyFile ? 'Alterar gabarito' : 'Anexar gabarito oficial'}
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={loading}
                  onChange={(e) => setAnswerKeyFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>

            {loading && jobData && (
              <div
                style={{
                  background: '#f2f6f3',
                  border: '1px solid #c9dccb',
                  borderRadius: 10,
                  padding: '14px',
                  marginBottom: 14,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: '#274b37' }}>
                    <Loader2 size={16} className="animate-spin" /> {jobData.step}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#436852' }}>
                    {jobData.progress}%
                  </span>
                </div>
                <div className="progress-track" style={{ height: 6 }}>
                  <div className="progress-fill" style={{ width: `${jobData.progress}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button type="button" className="text-button" onClick={handleCancelExtraction}>
                    Cancelar extração
                  </button>
                </div>
              </div>
            )}

            <div className="import-warning">
              <Sparkles size={17} />
              <p>
                Processado via <b>Gemini Flash</b> no servidor com fallback automático e extração estruturada. Nenhum gabarito
                é inferido como oficial a menos que esteja no documento oficial anexado.
              </p>
            </div>

            <div className="modal-footer">
              <button type="button" className="button button-secondary" onClick={onClose} disabled={loading}>
                Cancelar
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleStartExtraction}
                disabled={!examFile || loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? 'Extraindo questões...' : 'Iniciar Extração com Gemini'}
              </button>
            </div>
          </>
        ) : jobData.status === 'failed' ? (
          <div className="empty-state">
            <div className="empty-illustration" style={{ background: '#fbece8', color: '#a85b44' }}>
              <AlertCircle size={24} />
            </div>
            <h3>Falha na extração</h3>
            <p style={{ color: '#9a4c38', maxWidth: 480, margin: '8px auto 16px', lineHeight: 1.5 }}>
              {formatErrorMessage(jobData.error)}
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => {
                setJobData(null);
                setJobId(null);
              }}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          /* Job Completed - Results and Exception Review */
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div className="stat-card" style={{ padding: '10px 12px' }}>
                <span style={{ fontSize: 9, color: '#83887f' }}>Total extraído</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#273c30' }}>
                  {jobData.questions.length}
                </div>
                <small style={{ fontSize: 8, color: '#91968e' }}>questões identificadas</small>
              </div>

              <div className="stat-card" style={{ padding: '10px 12px' }}>
                <span style={{ fontSize: 9, color: '#83887f' }}>Gabarito oficial</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#2d6749' }}>
                  {jobData.questions.filter((q) => q.hasOfficialKey).length}
                </div>
                <small style={{ fontSize: 8, color: '#91968e' }}>reconciliadas da fonte</small>
              </div>

              <div className="stat-card" style={{ padding: '10px 12px' }}>
                <span style={{ fontSize: 9, color: '#83887f' }}>Revisão por exceção</span>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: jobData.reviewQueue.length ? '#a85b44' : '#2d6749',
                  }}
                >
                  {jobData.reviewQueue.length}
                </div>
                <small style={{ fontSize: 8, color: '#91968e' }}>com alertas/figuras</small>
              </div>

              <div className="stat-card" style={{ padding: '10px 12px' }}>
                <span style={{ fontSize: 9, color: '#83887f' }}>Checksum SHA-256</span>
                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#566057', marginTop: 4 }}>
                  {jobData.examChecksum.slice(0, 10)}...
                </div>
                <small style={{ fontSize: 8, color: '#91968e' }}>rastreabilidade do PDF</small>
              </div>
            </div>

            {jobData.alerts && jobData.alerts.length > 0 && (
              <div
                style={{
                  background: '#fbece8',
                  border: '1px solid #e4c4be',
                  borderRadius: 10,
                  padding: '10px 12px',
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#9a4c38',
                    marginBottom: 4,
                  }}
                >
                  <AlertCircle size={14} />
                  {jobData.status === 'completed_with_gaps'
                    ? 'A extração não cobriu o documento inteiro'
                    : 'Aviso de integridade'}
                </div>
                {jobData.alerts.map((a, i) => (
                  <p key={i} style={{ margin: '2px 0', fontSize: 11, color: '#7d4030', lineHeight: 1.5 }}>
                    {a}
                  </p>
                ))}
              </div>
            )}

            {/* Tab filter for exception queue */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, borderBottom: '1px solid #e5e2d8', paddingBottom: 8 }}>
              <button
                type="button"
                className={`text-button ${activeTab === 'all' ? 'filter-active' : ''}`}
                style={{ fontWeight: activeTab === 'all' ? 700 : 500 }}
                onClick={() => setActiveTab('all')}
              >
                Todas as questões ({jobData.questions.length})
              </button>
              <button
                type="button"
                className={`text-button ${activeTab === 'exceptions' ? 'filter-active' : ''}`}
                style={{ fontWeight: activeTab === 'exceptions' ? 700 : 500, color: '#a85b44' }}
                onClick={() => setActiveTab('exceptions')}
              >
                Fila de revisão por exceção ({jobData.reviewQueue.length})
              </button>
            </div>

            {/* Question preview list */}
            <div
              style={{
                maxHeight: '340px',
                overflowY: 'auto',
                border: '1px solid #e5e2d8',
                borderRadius: 10,
                padding: '8px 12px',
                background: '#faf9f5',
              }}
            >
              {questionsToShow.map((q, idx) => (
                <div
                  key={q.id || idx}
                  style={{
                    padding: '10px 0',
                    borderTop: idx === 0 ? 'none' : '1px solid #eeeae1',
                    fontSize: 11,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: '#273b30' }}>
                      Questão {q.source.questionNumber || idx + 1} <i>·</i> {q.subject} ({q.topic})
                    </span>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 5,
                        fontSize: 9,
                        background: q.hasOfficialKey ? '#e3ece3' : '#f4eee1',
                        color: q.hasOfficialKey ? '#2b583f' : '#8a744c',
                        fontWeight: 600,
                      }}
                    >
                      {q.hasOfficialKey ? `Gabarito Oficial: ${q.answerKey}` : 'Sem gabarito oficial'}
                    </span>
                  </div>

                  <p style={{ margin: '4px 0', color: '#485249', lineHeight: 1.5 }}>{q.statement}</p>

                  {Object.keys(q.alternatives).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0', fontSize: 10, color: '#687269' }}>
                      {Object.entries(q.alternatives).map(([letter, text]) => (
                        <span key={letter}>
                          <b>{letter})</b> {text.slice(0, 40)}
                          {text.length > 40 ? '...' : ''}
                        </span>
                      ))}
                    </div>
                  )}

                  {q.alerts.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {q.alerts.map((alert, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: '#fbece8',
                            color: '#9a4c38',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 9,
                          }}
                        >
                          <AlertCircle size={11} /> {alert}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setJobData(null);
                  setJobId(null);
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className="button button-primary"
                onClick={handleConfirmImport}
              >
                <CheckCircle2 size={16} /> Importar {jobData.questions.length} questões para o Banco
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}
