import { useState, useEffect } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Eye,
  EyeOff,
  Flame,
  Keyboard,
  RotateCcw,
  Scale,
  Zap,
} from 'lucide-react';
import type { Question, ResponseRecord, StudySession, TriageRound } from '../../types';
import { formatDuration } from '../../services/scoringService';
import { emptyResponse } from '../../services/questionService';
import { MathRenderer } from '../common/MathRenderer';
import { ConstantsDrawer } from '../common/ConstantsDrawer';
import { KeyboardShortcutsModal } from '../common/KeyboardShortcutsModal';

interface ResolverPageProps {
  session: StudySession;
  questions: Question[];
  tick: number;
  onExit: () => void;
  onFinishSession: (id: string) => void;
  onUpdateSession: (id: string, updater: (s: StudySession) => StudySession) => void;
  onUpdateResponse: (questionId: string, updater: (r: ResponseRecord) => ResponseRecord) => void;
  onNotify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function ResolverPage({
  session,
  questions,
  tick,
  onExit,
  onFinishSession,
  onUpdateSession,
  onUpdateResponse,
  onNotify,
}: ResolverPageProps) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const index = session.currentIndex;
  const total = session.questionIds.length;
  const activeQuestionId = session.questionIds[index];
  const activeQuestion = activeQuestionId ? questionMap.get(activeQuestionId) : null;
  const response = activeQuestionId ? session.responses[activeQuestionId] ?? emptyResponse() : emptyResponse();

  if (!activeQuestion) {
    return (
      <div className="empty-state">
        <h3>Nenhuma questão selecionada</h3>
        <p>Esta sessão não possui questões válidas ou todas foram removidas.</p>
        <button className="button button-primary" onClick={onExit}>
          Voltar às sessões
        </button>
      </div>
    );
  }

  const canReveal = session.mode === 'treino' || session.status === 'concluída';
  const correct = Boolean(activeQuestion.answerKey && response.selectedOption === activeQuestion.answerKey);

  const answeredCount = session.questionIds.filter((id) => {
    const r = session.responses[id];
    return Boolean(r?.selectedOption || (r?.notes && r.notes.trim()));
  }).length;

  const markedCount = session.questionIds.filter((id) => session.responses[id]?.markedForReview).length;
  const progress = total ? ((index + 1) / total) * 100 : 0;

  const elapsed = session.startedAt
    ? Math.floor((tick - new Date(session.startedAt).getTime()) / 1000)
    : 0;

  const remainingSeconds = session.timerMinutes
    ? Math.max(0, session.timerMinutes * 60 - elapsed)
    : null;

  const [showConstants, setShowConstants] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [subtleTimer, setSubtleTimer] = useState(false);

  const formatSubtleDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `~${hours}h ${minutes}m restantes`;
    }
    return `~${minutes}m restantes`;
  };

  const handleSelectOption = (letter: string) => {
    if (session.status === 'concluída') return;
    onUpdateResponse(activeQuestion.id, (r) => ({
      ...r,
      selectedOption: letter,
      checked: false,
    }));
  };

  const handleToggleReview = () => {
    onUpdateResponse(activeQuestion.id, (r) => ({
      ...r,
      markedForReview: !r.markedForReview,
    }));
  };

  const handleSetTriage = (round: TriageRound) => {
    onUpdateResponse(activeQuestion.id, (r) => ({
      ...r,
      triage: r.triage === round ? undefined : round,
    }));
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onUpdateResponse(activeQuestion.id, (r) => ({
      ...r,
      notes: val,
    }));
  };

  const handleCheckAnswer = () => {
    if (!response.selectedOption) {
      onNotify('Selecione uma alternativa antes de conferir.', 'info');
      return;
    }
    onUpdateResponse(activeQuestion.id, (r) => ({ ...r, checked: true }));
  };

  const handleHideAnswer = () => {
    onUpdateResponse(activeQuestion.id, (r) => ({ ...r, checked: false }));
  };

  const handleGoToQuestion = (i: number) => {
    onUpdateSession(session.id, (s) => ({ ...s, currentIndex: i }));
  };

  const handlePrevious = () => {
    onUpdateSession(session.id, (s) => ({
      ...s,
      currentIndex: Math.max(0, s.currentIndex - 1),
    }));
  };

  const handleNext = () => {
    onUpdateSession(session.id, (s) => ({
      ...s,
      currentIndex: Math.min(s.questionIds.length - 1, s.currentIndex + 1),
    }));
  };

  const handleConfirmFinish = () => {
    if (window.confirm('Deseja finalizar esta sessão agora?')) {
      onFinishSession(session.id);
    }
  };

  const handleConfirmExit = () => {
    if (
      window.confirm(
        'Sair da tela de resolução? O progresso atual está salvo e você poderá continuar depois.'
      )
    ) {
      onExit();
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in inputs or textareas
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (showConstants) {
          setShowConstants(false);
          return;
        }
        if (showShortcuts) {
          setShowShortcuts(false);
          return;
        }
      }

      // Shift+C or Alt+C: toggle Constants sheet
      if ((e.shiftKey || e.altKey) && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        setShowConstants((prev) => !prev);
        return;
      }

      // ? or Shift+/: toggle Shortcuts modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // S or s: toggle subtle timer mode
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setSubtleTimer((prev) => !prev);
        return;
      }

      // ArrowRight, K: Next question
      if (e.key === 'ArrowRight' || e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleNext();
        return;
      }

      // ArrowLeft, J: Previous question
      if (e.key === 'ArrowLeft' || e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handlePrevious();
        return;
      }

      // M: Mark for review
      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        handleToggleReview();
        return;
      }

      // Triage rounds: 1, 2, 3
      if (e.key === '1') {
        e.preventDefault();
        handleSetTriage('imediata');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        handleSetTriage('trabalhosa');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        handleSetTriage('combate');
        return;
      }

      // Space: Check/Hide answer in treino mode
      if (e.code === 'Space' || e.key === ' ') {
        if (session.mode === 'treino' && activeQuestion.answerKey) {
          e.preventDefault();
          if (response.checked) {
            handleHideAnswer();
          } else {
            handleCheckAnswer();
          }
        }
        return;
      }

      // Option selection: A, B, C, D, E
      const upperKey = e.key.toUpperCase();
      if (
        ['A', 'B', 'C', 'D', 'E'].includes(upperKey) &&
        activeQuestion.alternatives[upperKey] !== undefined
      ) {
        e.preventDefault();
        handleSelectOption(upperKey);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeQuestion,
    session,
    response,
    showConstants,
    showShortcuts,
    index,
    total,
  ]);

  const subjectClass = `dot-${activeQuestion.subject
    .toLowerCase()
    .replace(/á/g, 'a')
    .replace(/ê/g, 'e')
    .replace(/í/g, 'i')}`;

  const altKeys = Object.keys(activeQuestion.alternatives);

  return (
    <div className="resolver-page">
      <div className="resolver-top">
        <button className="back-link" onClick={handleConfirmExit}>
          <ArrowLeft size={16} /> Sair da resolução
        </button>
        <div className="resolver-session-title">
          <span>{session.mode === 'simulado' ? 'SIMULADO' : 'SESSÃO DE TREINO'}</span>
          <b>{session.title}</b>
        </div>
        <div className="resolver-top-actions">
          <button
            type="button"
            className="resolver-aux-btn"
            onClick={() => setShowConstants(true)}
            title="Abrir folha oficial de constantes (Shift+C)"
          >
            <BookOpen size={14} /> Constantes <kbd>Shift+C</kbd>
          </button>
          <button
            type="button"
            className="resolver-aux-btn"
            onClick={() => setShowShortcuts(true)}
            title="Ver mapa de atalhos de teclado (?)"
          >
            <Keyboard size={14} /> Atalhos <kbd>?</kbd>
          </button>
          <button className="button button-outline-danger" onClick={handleConfirmFinish}>
            Finalizar sessão
          </button>
        </div>
      </div>

      <div className="resolver-progress">
        <div className="resolver-progress-copy">
          <span>
            QUESTÃO <b>{String(index + 1).padStart(2, '0')}</b>{' '}
            <em>DE {String(total).padStart(2, '0')}</em>
          </span>
          <span>
            {answeredCount} respondida(s) <span className="tiny-dot">·</span> {markedCount} para
            revisar
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="resolver-meta-line">
        <div className="question-meta">
          <span className={`subject-dot ${subjectClass}`} />
          <span>{activeQuestion.subject.toUpperCase()}</span>
          <span className="meta-separator">·</span>
          <span>{activeQuestion.topic}</span>
          <span className="meta-separator">·</span>
          <span>{activeQuestion.source.year ?? activeQuestion.source.label}</span>
        </div>
        <div className="resolver-clock">
          <Clock3 size={15} />
          {session.mode === 'simulado' && remainingSeconds !== null ? (
            subtleTimer ? (
              <span className="clock-text-subtle">{formatSubtleDuration(remainingSeconds)}</span>
            ) : (
              <span className="clock-text">{formatDuration(remainingSeconds)}</span>
            )
          ) : (
            <span className="clock-text">{formatDuration(elapsed)}</span>
          )}
          {session.mode === 'simulado' && (
            <button
              type="button"
              className="clock-subtle-toggle"
              onClick={() => setSubtleTimer((prev) => !prev)}
              title={subtleTimer ? 'Exibir segundos detalhados (Atalho: S)' : 'Modo sutil (sem segundos piscando) (Atalho: S)'}
              aria-label="Alternar modo sutil do cronômetro"
            >
              {subtleTimer ? <EyeOff size={13} /> : <Eye size={13} />}
              <kbd>S</kbd>
            </button>
          )}
        </div>
      </div>

      <div className="resolver-body">
        <main className="resolver-main">
          <article className="resolver-question">
            {/* Tática de Prova ITA: Triagem em 3 Voltas */}
            <div className="triage-control-bar" role="group" aria-label="Triagem Tática ITA">
              <span className="triage-label">Triagem:</span>
              <button
                type="button"
                className={`triage-btn ${response.triage === 'imediata' ? 'triage-active-imediata' : ''}`}
                onClick={() => handleSetTriage('imediata')}
                title="1ª Volta: Resolução imediata sem risco (Atalho: 1)"
              >
                <Zap size={13} /> 1ª Volta: Imediata <kbd>1</kbd>
              </button>
              <button
                type="button"
                className={`triage-btn ${response.triage === 'trabalhosa' ? 'triage-active-trabalhosa' : ''}`}
                onClick={() => handleSetTriage('trabalhosa')}
                title="2ª Volta: Método dominado, cálculo extenso (Atalho: 2)"
              >
                <Scale size={13} /> 2ª Volta: Trabalhosa <kbd>2</kbd>
              </button>
              <button
                type="button"
                className={`triage-btn ${response.triage === 'combate' ? 'triage-active-combate' : ''}`}
                onClick={() => handleSetTriage('combate')}
                title="3ª Volta: Alta complexidade ou combate tático (Atalho: 3)"
              >
                <Flame size={13} /> 3ª Volta: Combate <kbd>3</kbd>
              </button>
            </div>

            <div className="question-label">ENUNCIADO</div>
            <div className="statement-text">
              <MathRenderer text={activeQuestion.statement} />
            </div>
            {activeQuestion.tags.length > 0 && (
              <div className="tag-row">
                {activeQuestion.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {altKeys.length > 0 ? (
              <div className="alternatives-wrap">
                <div className="question-label">SELECIONE UMA ALTERNATIVA</div>
                <div className="alternatives-list">
                  {Object.entries(activeQuestion.alternatives)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([letter, text]) => {
                      const isSelected = response.selectedOption === letter;
                      const reveal = canReveal && response.checked;
                      const isCorrectAnswer = reveal && activeQuestion.answerKey === letter;
                      const isWrongChoice = reveal && isSelected && !correct;

                      return (
                        <button
                          key={letter}
                          className={`alternative ${isSelected ? 'alternative-selected' : ''} ${
                            isCorrectAnswer ? 'alternative-correct' : ''
                          } ${isWrongChoice ? 'alternative-wrong' : ''}`}
                          onClick={() => handleSelectOption(letter)}
                          disabled={session.status === 'concluída'}
                        >
                          <span className="alternative-letter">{letter}</span>
                          <span className="alternative-text">
                            <MathRenderer text={text} inline />
                          </span>
                          {isCorrectAnswer && (
                            <CheckCircle2 className="alternative-status" size={18} />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="essay-wrap">
                <label className="question-label" htmlFor="response-notes">
                  SUA RESOLUÇÃO
                </label>
                <textarea
                  id="response-notes"
                  className="essay-textarea"
                  placeholder="Registre aqui seu raciocínio, cálculos e resposta..."
                  value={response.notes}
                  onChange={handleNotesChange}
                />
              </div>
            )}

            <div className="resolver-question-actions">
              <button
                className={`text-button review-toggle ${
                  response.markedForReview ? 'review-toggle-active' : ''
                }`}
                onClick={handleToggleReview}
              >
                {response.markedForReview ? (
                  <BookmarkCheck size={17} />
                ) : (
                  <Bookmark size={17} />
                )}
                {response.markedForReview ? 'Marcada para revisão' : 'Marcar para revisar'}
              </button>
              <span className="autosave-label">
                <Check size={14} /> Salvamento automático
              </span>
            </div>

            {canReveal && response.checked && activeQuestion.answerKey && (
              <div
                className={`answer-feedback ${
                  correct ? 'answer-feedback-correct' : 'answer-feedback-wrong'
                }`}
              >
                <div className="feedback-heading">
                  {correct ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <b>
                    {correct
                      ? 'Resposta correta'
                      : `Resposta incorreta · gabarito ${activeQuestion.answerKey}`}
                  </b>
                </div>
                {activeQuestion.explanation && (
                  <div className="feedback-explanation">
                    <MathRenderer text={activeQuestion.explanation} />
                  </div>
                )}
              </div>
            )}
          </article>
        </main>

        <aside className="resolver-aside">
          <section className="resolver-side-panel">
            <div className="side-panel-title">Navegação</div>
            <p className="side-panel-subtitle">Selecione um número para ir direto à questão.</p>
            <div className="question-number-grid">
              {session.questionIds.map((id, i) => {
                const r = session.responses[id];
                const triageClass = r?.triage ? `number-triage-${r.triage}` : '';
                return (
                  <button
                    key={id}
                    title={`Questão ${i + 1}${
                      r?.selectedOption ? ` · resposta ${r.selectedOption}` : ''
                    }${r?.triage ? ` · volta: ${r.triage}` : ''}`}
                    className={`question-number ${i === index ? 'number-current' : ''} ${
                      r?.selectedOption ? 'number-answered' : ''
                    } ${r?.markedForReview ? 'number-flagged' : ''} ${triageClass}`}
                    onClick={() => handleGoToQuestion(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="legend-list">
              <span>
                <i className="legend-dot answered" /> Respondida
              </span>
              <span>
                <i className="legend-dot flagged" /> Para revisar
              </span>
              <span>
                <i className="legend-dot current" /> Atual
              </span>
              <span>
                <i className="legend-dot legend-triage-imediata" /> Imediata (1)
              </span>
              <span>
                <i className="legend-dot legend-triage-trabalhosa" /> Trabalhosa (2)
              </span>
              <span>
                <i className="legend-dot legend-triage-combate" /> Combate (3)
              </span>
            </div>

            <div className="side-panel-divider" />
            <div className="side-stats">
              <div>
                <span>Respondidas</span>
                <b>
                  {answeredCount} <small>/ {total}</small>
                </b>
              </div>
              <div>
                <span>Em branco</span>
                <b>{total - answeredCount}</b>
              </div>
            </div>
          </section>

          <section className="resolver-side-note">
            <div className="note-icon">
              <CircleHelp size={17} />
            </div>
            <div>
              <b>Resolva no seu ritmo.</b>
              <p>
                {session.mode === 'simulado'
                  ? 'No modo simulado, o gabarito e a explicação ficam ocultos até o encerramento.'
                  : 'No treino, você pode conferir a resposta depois de registrar sua tentativa.'}
              </p>
            </div>
          </section>
        </aside>
      </div>

      <div className="resolver-bottom">
        <button
          className="button button-secondary"
          onClick={handlePrevious}
          disabled={index === 0}
        >
          <ChevronLeft size={17} /> Anterior
        </button>

        <div className="resolver-bottom-center">
          {session.mode === 'treino' && !response.checked && activeQuestion.answerKey && (
            <button className="text-button" onClick={handleCheckAnswer}>
              Conferir resposta
            </button>
          )}
          {session.mode === 'treino' && response.checked && (
            <button className="text-button" onClick={handleHideAnswer}>
              <RotateCcw size={15} /> Ocultar resultado
            </button>
          )}
        </div>

        {index < total - 1 ? (
          <button className="button button-primary" onClick={handleNext}>
            Próxima questão <ChevronRight size={17} />
          </button>
        ) : (
          <button
            className="button button-primary"
            onClick={() => {
              if (window.confirm('Finalizar esta sessão e visualizar o resultado?')) {
                onFinishSession(session.id);
              }
            }}
          >
            Finalizar e ver resultado <CheckCheck size={17} />
          </button>
        )}
      </div>
      <ConstantsDrawer
        isOpen={showConstants}
        onClose={() => setShowConstants(false)}
      />

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}
    </div>
  );
}
