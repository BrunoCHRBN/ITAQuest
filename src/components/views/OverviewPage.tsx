import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Clock,
  ListChecks,
  Play,
  Plus,
  Search,
  Sparkles,
  Target,
} from 'lucide-react';
import type { Question, StudySession, View } from '../../types';
import { PageHeader } from '../layout/PageHeader';
import { SessionRow } from '../session/SessionRow';
import { calculateOverviewStats } from '../../services/scoringService';

interface OverviewPageProps {
  questions: Question[];
  sessions: StudySession[];
  onNavigate: (view: View) => void;
  onOpenSessionModal: () => void;
  onResumeSession: (session: StudySession) => void;
}

export function OverviewPage({
  questions,
  sessions,
  onNavigate,
  onOpenSessionModal,
  onResumeSession,
}: OverviewPageProps) {
  const stats = calculateOverviewStats(sessions, questions);
  const activeSession = sessions.find((s) => s.status === 'em_andamento') ?? null;

  // Calculate active session progress
  const activeSessionProgress = activeSession
    ? {
        total: activeSession.questionIds.length,
        answered: activeSession.questionIds.filter((qId) => {
          const r = activeSession.responses[qId];
          return Boolean(r?.selectedOption || (r?.notes && r.notes.trim()));
        }).length,
      }
    : null;

  return (
    <>
      <PageHeader
        eyebrow="SEU ESPAÇO DE PREPARAÇÃO"
        title="Estude com intenção."
        subtitle="Um ambiente sóbrio para resolver, revisar e consolidar cada etapa da preparação."
        actions={
          activeSession ? (
            <>
              <button
                type="button"
                className="button button-primary"
                onClick={() => onResumeSession(activeSession)}
                title={`Retomar "${activeSession.title}"`}
              >
                <Play size={16} /> Continuar sessão
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={onOpenSessionModal}
                title="Planejar ou iniciar nova sessão"
              >
                <Plus size={16} /> Nova sessão
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="button button-primary"
                onClick={onOpenSessionModal}
                title="Criar uma sessão de treino ou simulado"
              >
                <Plus size={16} /> Montar sessão
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => onNavigate('bank')}
                title="Explorar o banco de questões"
              >
                <Search size={16} /> Banco de questões
              </button>
            </>
          )
        }
      />

      {/* Prominent Active Session Callout if session is in progress */}
      {activeSession && activeSessionProgress && (
        <section
          className="active-session-banner"
          aria-label="Sessão de estudo em andamento"
        >
          <div className="active-session-content">
            <div className="active-session-eyebrow">
              <span className="live-indicator" />
              SESSÃO EM ANDAMENTO
            </div>
            <h2 className="active-session-title">{activeSession.title}</h2>
            <div className="active-session-meta">
              <span className="meta-badge">
                {activeSession.mode === 'simulado' ? 'Simulado cronometrado' : 'Treino com gabarito imediato'}
              </span>
              <span>·</span>
              <span>
                {activeSessionProgress.answered} de {activeSessionProgress.total} questões respondidas
              </span>
              {activeSession.timerMinutes && (
                <>
                  <span>·</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={13} /> {activeSession.timerMinutes} min limite
                  </span>
                </>
              )}
            </div>

            <div className="active-session-bar-wrap">
              <div
                className="active-session-bar-fill"
                style={{
                  width: `${
                    activeSessionProgress.total > 0
                      ? Math.round((activeSessionProgress.answered / activeSessionProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>

          <button
            type="button"
            className="button button-primary active-session-btn"
            onClick={() => onResumeSession(activeSession)}
          >
            <Play size={16} /> Continuar resolução
          </button>
        </section>
      )}

      {/* Stat indicators derived strictly from real data */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Questões no acervo</span>
            <BookOpen size={17} />
          </div>
          <div className="stat-value">{questions.length.toLocaleString('pt-BR')}</div>
          <div className="stat-foot">
            {questions.length === 0
              ? 'Nenhuma questão cadastrada ainda'
              : `${questions.length} questões prontas para treino`}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Resolvidas hoje</span>
            <CheckCircle2 size={17} />
          </div>
          <div className="stat-value">{stats.todayResolvedCount.toLocaleString('pt-BR')}</div>
          <div className="stat-foot">
            {stats.todayResolvedCount === 0
              ? 'Nenhuma resolução registrada hoje'
              : 'Em sessões concluídas hoje'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Taxa de acerto</span>
            <Target size={17} />
          </div>
          <div className="stat-value">
            {stats.overallAccuracy}
            <span className="stat-unit">%</span>
          </div>
          <div className="stat-foot">
            {stats.totalGraded > 0
              ? `${stats.totalCorrect} acertos em ${stats.totalGraded} com gabarito`
              : 'Sem questões com gabarito respondidas'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Para revisar</span>
            <Bookmark size={17} />
          </div>
          <div className="stat-value">{stats.uniqueReviewedQuestionsCount}</div>
          <div className="stat-foot">
            {stats.uniqueReviewedQuestionsCount === 0
              ? 'Nenhuma questão com dúvida marcada'
              : `${stats.reviewItemsCount} marcações em sessões`}
          </div>
        </div>
      </div>

      <div className="overview-grid">
        <section className="surface-panel recent-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">HISTÓRICO RECENTE</div>
              <h2>Suas sessões</h2>
            </div>
            {sessions.length > 0 && (
              <button
                type="button"
                className="text-button"
                onClick={() => onNavigate('sessions')}
              >
                Ver todas ({sessions.length}) <ArrowRight size={15} />
              </button>
            )}
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state compact-empty">
              <div className="empty-illustration">
                <BookMarked size={25} />
              </div>
              <h3>Seu caderno começa aqui</h3>
              <p>Monte uma sessão com questões do banco e acompanhe seu desempenho a cada resolução.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 12 }}>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={onOpenSessionModal}
                >
                  <Plus size={16} /> Montar primeira sessão
                </button>
                {questions.length === 0 && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => onNavigate('bank')}
                  >
                    <Search size={16} /> Inserir questões
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="session-list">
              {sessions.slice(0, 4).map((s) => (
                <SessionRow key={s.id} session={s} onResume={onResumeSession} />
              ))}
            </div>
          )}
        </section>

        <section className="surface-panel pace-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">RITMO DE ESTUDO</div>
              <h2>Progresso de metas</h2>
            </div>
            <Target size={18} className="muted-icon" />
          </div>

          <div className="weekly-number">
            <strong>{stats.totalCompletedQuestions}</strong>
            <span>questões concluídas em sessões</span>
          </div>

          <div className="progress-track" title={`${stats.goalProgressPct}% da meta concluída`}>
            <div
              className="progress-fill"
              style={{ width: `${stats.goalProgressPct}%` }}
            />
          </div>

          <div className="progress-ends">
            <span>0</span>
            <span>
              Meta: <b>{stats.goal} questões</b> ({stats.goalProgressPct}%)
            </span>
          </div>

          <div className="pace-divider" />
          <p className="editorial-quote">“A clareza vem da prática deliberada.”</p>
          <span className="quote-caption">UM DIA DE CADA VEZ · DISCIPLINA E CONSTÂNCIA</span>
        </section>
      </div>

      <div className="section-heading section-heading-lower">
        <div>
          <div className="eyebrow">NAVEGAÇÃO RÁPIDA</div>
          <h2>Atalhos de estudo</h2>
        </div>
      </div>

      <div className="shortcut-grid">
        <button
          type="button"
          className="shortcut-card"
          onClick={() => onNavigate('bank')}
        >
          <div className="shortcut-icon moss">
            <BookOpen size={20} />
          </div>
          <span>
            <b>Explorar banco de questões</b>
            <small>Filtre por matéria, ano, assunto, dificuldade ou status de resolução.</small>
          </span>
          <ArrowRight size={17} />
        </button>

        <button
          type="button"
          className="shortcut-card"
          onClick={onOpenSessionModal}
        >
          <div className="shortcut-icon clay">
            <ListChecks size={20} />
          </div>
          <span>
            <b>Montar sessão ou simulado</b>
            <small>Defina questões, modalidade treino ou prova cronometrada.</small>
          </span>
          <ArrowRight size={17} />
        </button>

        <button
          type="button"
          className="shortcut-card"
          onClick={() => onNavigate('reviews')}
        >
          <div className="shortcut-icon sand">
            <Bookmark size={20} />
          </div>
          <span>
            <b>Caderno de revisões</b>
            <small>
              {stats.uniqueReviewedQuestionsCount > 0
                ? `${stats.uniqueReviewedQuestionsCount} questão(ões) marcada(s) para revisitar.`
                : 'Revise erros e questões marcadas com dúvida.'}
            </small>
          </span>
          <ArrowRight size={17} />
        </button>
      </div>
    </>
  );
}
