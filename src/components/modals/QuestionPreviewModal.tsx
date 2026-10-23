import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Question } from '../../types';
import { ModalShell } from '../common/ModalShell';
import { MathRenderer } from '../common/MathRenderer';

interface QuestionPreviewModalProps {
  question: Question;
  selected: boolean;
  onToggleSelect: () => void;
  onResolve: () => void;
  onClose: () => void;
  studentStatus?: {
    answered: boolean;
    isCorrect: boolean;
    isWrong: boolean;
    markedForReview: boolean;
  };
}

export function QuestionPreviewModal({
  question,
  selected,
  onToggleSelect,
  onResolve,
  onClose,
  studentStatus,
}: QuestionPreviewModalProps) {
  const [showAnswer, setShowAnswer] = useState(false);

  const subjectClass = `dot-${question.subject
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/ê/g, 'e')
    .replace(/í/g, 'i')}`;

  const altEntries = Object.entries(question.alternatives || {}).sort(([a], [b]) =>
    a.localeCompare(b)
  );

  return (
    <ModalShell
      title={`Questão ${question.source.questionNumber ? `nº ${question.source.questionNumber}` : ''}`}
      subtitle={`${question.subject} · ${question.topic} · ${question.source.label} ${
        question.source.year ? question.source.year : ''
      }`}
      onClose={onClose}
    >
      <div className="preview-modal-body">
        {/* Top Badges and Meta Bar */}
        <div className="preview-header-meta">
          <div className="preview-tags-row">
            <span className={`subject-pill ${subjectClass}`}>
              <span className={`subject-dot ${subjectClass}`} />
              {question.subject.toUpperCase()}
            </span>

            <span className="difficulty-badge">{question.difficulty}</span>

            {question.hasOfficialKey && (
              <span className="audit-badge audit-badge-official" title="Conferido contra folha oficial de gabarito">
                <ShieldCheck size={14} /> Gabarito Oficial
              </span>
            )}

            {question.alerts && question.alerts.length > 0 && (
              <span className="audit-badge audit-badge-warning" title={question.alerts.join(' | ')}>
                <AlertTriangle size={14} /> Alerta de Extração
              </span>
            )}

            {studentStatus?.answered && (
              <span
                className={`student-status-badge ${
                  studentStatus.isCorrect
                    ? 'status-correct'
                    : studentStatus.isWrong
                    ? 'status-wrong'
                    : 'status-answered'
                }`}
              >
                {studentStatus.isCorrect
                  ? '✓ Resolvida (Acerto)'
                  : studentStatus.isWrong
                  ? '✗ Resolvida (Erro)'
                  : '✓ Resolvida'}
              </span>
            )}

            {studentStatus?.markedForReview && (
              <span className="student-status-badge status-review">★ Marcada para revisão</span>
            )}
          </div>
        </div>

        {/* Source & File details if available */}
        {(question.source.phase || question.source.page || question.source.fileName || question.source.checksum) && (
          <div className="preview-source-strip">
            <FileText size={14} className="muted-icon" />
            <span>
              {question.source.label} {question.source.year && `· ${question.source.year}`}
              {question.source.phase && ` · ${question.source.phase}`}
              {question.source.questionNumber && ` · Questão ${question.source.questionNumber}`}
              {question.source.page && ` · Página ${question.source.page}`}
              {question.source.fileName && ` · ${question.source.fileName}`}
            </span>
          </div>
        )}

        {/* Alerts Callout if any */}
        {question.alerts && question.alerts.length > 0 && (
          <div className="preview-alert-box">
            <AlertTriangle size={16} />
            <div>
              <b>Atenção na extração desta questão:</b>
              <ul>
                {question.alerts.map((alert, idx) => (
                  <li key={idx}>{alert}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Question Statement */}
        <div className="preview-statement-wrap">
          <div className="preview-label">ENUNCIADO</div>
          <div className="preview-statement">
            <MathRenderer text={question.statement} />
          </div>
        </div>

        {/* Alternatives (if multiple choice) */}
        {altEntries.length > 0 ? (
          <div className="preview-alternatives-wrap">
            <div className="preview-label">ALTERNATIVAS ({altEntries.length})</div>
            <div className="preview-alternatives-list">
              {altEntries.map(([letter, text]) => {
                const isAnswer = showAnswer && question.answerKey === letter;
                return (
                  <div
                    key={letter}
                    className={`preview-alt-card ${isAnswer ? 'preview-alt-correct' : ''}`}
                  >
                    <span className="preview-alt-letter">{letter}</span>
                    <span className="preview-alt-text">
                      <MathRenderer text={text} inline />
                    </span>
                    {isAnswer && (
                      <span className="preview-alt-tag">
                        <Check size={14} /> Gabarito
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="preview-discursive-note">
            <BookOpen size={16} />
            <span>Questão com formato discursivo. Não possui alternativas de múltipla escolha.</span>
          </div>
        )}

        {/* Tags */}
        {question.tags && question.tags.length > 0 && (
          <div className="preview-tags-section">
            <span className="preview-label-inline">Tags:</span>
            <div className="preview-tags-chips">
              {question.tags.map((tag) => (
                <span key={tag} className="tag-chip">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Accordion: Gabarito Oficial e Resolução Comentada */}
        <div className="preview-answer-accordion">
          <button
            type="button"
            className="preview-accordion-header"
            onClick={() => setShowAnswer((prev) => !prev)}
            aria-expanded={showAnswer}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={16} color="var(--green)" />
              <b>Gabarito e Resolução Comentada</b>
            </div>
            {showAnswer ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAnswer && (
            <div className="preview-accordion-content">
              {question.answerKey ? (
                <div className="preview-key-display">
                  <span className="key-badge">Alternativa {question.answerKey}</span>
                  <span className="key-origin">
                    {question.source.gabaritoOficialSource
                      ? `Fonte oficial: ${question.source.gabaritoOficialSource}`
                      : 'Fonte: Gabarito Oficial'}
                  </span>
                </div>
              ) : (
                <p className="no-key-text">Esta questão não possui gabarito cadastrado.</p>
              )}

              {question.explanation ? (
                <div className="preview-explanation">
                  <b>Comentários e resolução:</b>
                  <div className="preview-explanation-body">
                    <MathRenderer text={question.explanation} />
                  </div>
                </div>
              ) : (
                <p className="no-key-text" style={{ marginTop: 8 }}>
                  Nenhuma resolução comentada disponível para esta questão.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="preview-footer-actions">
          <button
            type="button"
            className={`button ${selected ? 'button-primary' : 'button-secondary'}`}
            onClick={onToggleSelect}
          >
            {selected ? (
              <>
                <Check size={16} /> Selecionada para sessão
              </>
            ) : (
              'Selecionar questão'
            )}
          </button>

          <button
            type="button"
            className="button button-primary"
            onClick={() => {
              onClose();
              onResolve();
            }}
          >
            <Play size={16} /> Resolver agora
          </button>

          <button type="button" className="button button-secondary" onClick={onClose}>
            Fechar prévia
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
