import { AlertTriangle, ArrowRight, Check, Eye, ShieldCheck } from 'lucide-react';
import type { Question } from '../../types';
import { MathRenderer } from '../common/MathRenderer';

interface QuestionRowProps {
  question: Question;
  selected?: boolean;
  onToggle?: () => void;
  onResolve: () => void;
  onPreview?: () => void;
  compact?: boolean;
  studentStatus?: {
    answered: boolean;
    isCorrect: boolean;
    isWrong: boolean;
    markedForReview: boolean;
  };
}

export function QuestionRow({
  question,
  selected,
  onToggle,
  onResolve,
  onPreview,
  compact = false,
  studentStatus,
}: QuestionRowProps) {
  const subjectClass = `dot-${question.subject
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/ê/g, 'e')
    .replace(/í/g, 'i')}`;

  const difficultyClass = `difficulty-${question.difficulty.toLowerCase().replace('á', 'a')}`;
  const altCount = Object.keys(question.alternatives || {}).length;

  return (
    <article
      className={`question-row ${compact ? 'question-row-compact' : ''} ${
        selected ? 'question-row-selected' : ''
      }`}
    >
      {onToggle && (
        <button
          type="button"
          className={`select-box ${selected ? 'checked' : ''}`}
          onClick={onToggle}
          aria-label={selected ? `Desmarcar questão ${question.source.questionNumber || question.id}` : `Selecionar questão ${question.source.questionNumber || question.id}`}
        >
          {selected && <Check size={14} />}
        </button>
      )}

      <div
        className="question-main"
        onClick={onPreview || onResolve}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onResolve();
          }
        }}
        aria-label={`Questão sobre ${question.topic}: ${question.statement}`}
      >
        <div className="question-meta">
          <span className={`subject-dot ${subjectClass}`} />
          <span className="question-meta-subject">{question.subject.toUpperCase()}</span>
          <span className="meta-separator">·</span>
          <span>{question.topic}</span>
          <span className="meta-separator">·</span>
          <span>
            {question.source.label}
            {question.source.year ? ` ${question.source.year}` : ''}
            {question.source.phase ? ` (${question.source.phase})` : ''}
          </span>

          {/* Badges */}
          {question.hasOfficialKey && (
            <span className="row-badge badge-official" title="Conferido com gabarito oficial">
              <ShieldCheck size={12} /> Oficial
            </span>
          )}

          {question.alerts && question.alerts.length > 0 && (
            <span className="row-badge badge-warning" title={question.alerts[0]}>
              <AlertTriangle size={12} /> Alerta
            </span>
          )}

          {studentStatus?.answered && (
            <span
              className={`row-badge ${
                studentStatus.isCorrect
                  ? 'badge-correct'
                  : studentStatus.isWrong
                  ? 'badge-wrong'
                  : 'badge-neutral'
              }`}
            >
              {studentStatus.isCorrect
                ? 'Acerto ✓'
                : studentStatus.isWrong
                ? 'Incorreta ✗'
                : 'Resolvida ✓'}
            </span>
          )}

          {studentStatus?.markedForReview && (
            <span className="row-badge badge-review" title="Marcada para revisão">
              ★ Revisar
            </span>
          )}
        </div>

        <h3>
          <MathRenderer text={question.statement} inline />
        </h3>

        <div className="question-foot">
          <span className={`difficulty ${difficultyClass}`}>{question.difficulty}</span>
          <span>{altCount ? `${altCount} alternativas` : 'Discursiva'}</span>
          {question.source.questionNumber && <span>Questão {question.source.questionNumber}</span>}
          {question.source.page && <span>Pág. {question.source.page}</span>}
        </div>
      </div>

      <div className="question-actions">
        {onPreview && (
          <button
            type="button"
            className="subtle-icon"
            title="Prévia ampla com alternativas e gabarito"
            onClick={(e) => {
              e.stopPropagation();
              onPreview();
            }}
            aria-label="Visualizar prévia completa"
          >
            <Eye size={17} />
          </button>
        )}
        <button
          type="button"
          className="subtle-icon"
          title="Resolver questão individualmente"
          onClick={(e) => {
            e.stopPropagation();
            onResolve();
          }}
          aria-label="Resolver questão"
        >
          <ArrowRight size={17} />
        </button>
      </div>
    </article>
  );
}
