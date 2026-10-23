import { ArrowRight, BookOpen, CheckCircle2, Play, Timer } from 'lucide-react';
import type { StudySession } from '../../types';
import { formatDate } from '../../services/scoringService';

interface SessionRowProps {
  session: StudySession;
  onResume: (session: StudySession) => void;
}

export function SessionRow({ session, onResume }: SessionRowProps) {
  const isCompleted = session.status === 'concluída';
  const isInProgress = session.status === 'em_andamento';

  const label = isCompleted
    ? 'Concluída'
    : isInProgress
    ? 'Em andamento'
    : 'Planejada';

  const totalQuestions = session.questionIds.length;
  const answeredCount = session.questionIds.filter((qId) => {
    const r = session.responses[qId];
    return Boolean(r?.selectedOption || (r?.notes && r.notes.trim()));
  }).length;

  const progressPct = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  return (
    <div className={`session-row ${isInProgress ? 'session-row-active' : ''}`}>
      <div className={`session-symbol ${session.mode === 'simulado' ? 'session-symbol-clay' : ''}`}>
        {session.mode === 'simulado' ? <Timer size={18} /> : <BookOpen size={18} />}
      </div>

      <div className="session-row-main">
        <div className="session-row-title">{session.title}</div>
        <div className="session-row-meta">
          <span className="meta-mode">{session.mode === 'simulado' ? 'Simulado' : 'Treino'}</span>
          <span>·</span>
          <span>{totalQuestions} {totalQuestions === 1 ? 'questão' : 'questões'}</span>
          <span>·</span>
          <span>{formatDate(session.createdAt)}</span>
        </div>

        {/* Small progress bar */}
        <div className="session-mini-progress" title={`${answeredCount} de ${totalQuestions} respondidas (${progressPct}%)`}>
          <div className="mini-progress-track">
            <div
              className={`mini-progress-fill ${isCompleted ? 'fill-completed' : ''}`}
              style={{ width: `${isCompleted ? 100 : progressPct}%` }}
            />
          </div>
          <span className="mini-progress-label">
            {isCompleted ? (
              <span style={{ color: 'var(--green)' }}>✓ Concluída</span>
            ) : (
              `${answeredCount}/${totalQuestions} respondidas`
            )}
          </span>
        </div>
      </div>

      <span className={`status-pill status-${session.status}`}>{label}</span>

      <div className="session-action">
        <button
          type="button"
          className={`button button-small ${isInProgress ? 'button-primary' : 'button-secondary'}`}
          onClick={() => onResume(session)}
          aria-label={
            isCompleted
              ? `Ver resultado da sessão ${session.title}`
              : isInProgress
              ? `Continuar sessão ${session.title}`
              : `Iniciar sessão ${session.title}`
          }
        >
          {isCompleted ? (
            <>
              <CheckCircle2 size={13} /> Resultado
            </>
          ) : isInProgress ? (
            <>
              <Play size={13} /> Continuar
            </>
          ) : (
            <>
              <Play size={13} /> Iniciar
            </>
          )}
        </button>
      </div>
    </div>
  );
}
