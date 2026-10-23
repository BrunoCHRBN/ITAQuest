import { ClipboardList, Play, Plus } from 'lucide-react';
import type { StudySession } from '../../types';
import { PageHeader } from '../layout/PageHeader';
import { SessionRow } from '../session/SessionRow';

interface SessionsPageProps {
  sessions: StudySession[];
  onOpenSessionModal: () => void;
  onResumeSession: (session: StudySession) => void;
}

export function SessionsPage({ sessions, onOpenSessionModal, onResumeSession }: SessionsPageProps) {
  const planned = sessions.filter((s) => s.status !== 'concluída');
  const finished = sessions.filter((s) => s.status === 'concluída');

  return (
    <>
      <PageHeader
        eyebrow="PLANEJAMENTO E PRÁTICA"
        title="Sessões e simulados"
        subtitle="Organize uma sequência de questões e resolva uma por vez, sem distrações."
        actions={
          <button className="button button-primary" onClick={onOpenSessionModal}>
            <Plus size={17} /> Nova sessão
          </button>
        }
      />

      <div className="session-intro">
        <div className="session-intro-icon">
          <ClipboardList size={21} />
        </div>
        <div>
          <b>Da seleção à resolução</b>
          <p>
            Escolha questões do banco, defina o modo de estudo e avance em uma tela individual. Suas
            respostas ficam salvas neste navegador.
          </p>
        </div>
      </div>

      <section className="sessions-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">AGORA</div>
            <h2>Em andamento ou planejadas</h2>
          </div>
          <span className="count-label">{planned.length} sessão(ões)</span>
        </div>

        {planned.length ? (
          <div className="surface-panel sessions-card-list">
            {planned.map((s) => (
              <SessionRow key={s.id} session={s} onResume={onResumeSession} />
            ))}
          </div>
        ) : (
          <div className="empty-state smaller-empty">
            <div className="empty-illustration">
              <Play size={21} />
            </div>
            <h3>Nenhuma sessão ativa</h3>
            <p>Crie uma sessão nova ou selecione questões no banco.</p>
            <button className="button button-secondary" onClick={onOpenSessionModal}>
              <Plus size={16} /> Criar sessão
            </button>
          </div>
        )}
      </section>

      <section className="sessions-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">HISTÓRICO</div>
            <h2>Sessões concluídas</h2>
          </div>
          <span className="count-label">{finished.length} concluída(s)</span>
        </div>

        {finished.length ? (
          <div className="surface-panel sessions-card-list">
            {finished.map((s) => (
              <SessionRow key={s.id} session={s} onResume={onResumeSession} />
            ))}
          </div>
        ) : (
          <div className="quiet-empty">
            Seus resultados aparecerão aqui depois da primeira sessão concluída.
          </div>
        )}
      </section>
    </>
  );
}
