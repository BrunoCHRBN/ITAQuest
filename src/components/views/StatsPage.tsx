import {
  BookOpen,
  Bookmark,
  CheckCircle2,
  Download,
  Target,
} from 'lucide-react';
import type { Question, StudySession } from '../../types';
import { PageHeader } from '../layout/PageHeader';
import {
  calculateOverviewStats,
  calculateSubjectStats,
} from '../../services/scoringService';
import { SUBJECTS } from '../../services/questionService';

interface StatsPageProps {
  questions: Question[];
  sessions: StudySession[];
  onExportQuestions: () => void;
}

export function StatsPage({ questions, sessions, onExportQuestions }: StatsPageProps) {
  const overviewStats = calculateOverviewStats(sessions, questions);
  const subjectStats = calculateSubjectStats(sessions, questions, SUBJECTS.slice(0, 6));

  return (
    <>
      <PageHeader
        eyebrow="ACOMPANHAMENTO"
        title="Desempenho"
        subtitle="Use seus registros para perceber tendências — não apenas uma nota isolada."
        actions={
          <button className="button button-secondary" onClick={onExportQuestions}>
            <Download size={16} /> Exportar questões
          </button>
        }
      />

      <div className="performance-hero">
        <div>
          <span className="eyebrow">VISÃO GERAL</span>
          <h2>Aprendizado acumulado</h2>
          <p>Os indicadores são calculados a partir das sessões concluídas neste navegador.</p>
        </div>
        <div className="performance-big">
          <strong>{overviewStats.overallAccuracy}%</strong>
          <span>taxa de acerto</span>
        </div>
      </div>

      <div className="stat-grid stats-four">
        <div className="stat-card">
          <div className="stat-top">
            <span>Sessões concluídas</span>
            <CheckCircle2 size={17} />
          </div>
          <div className="stat-value">{overviewStats.completedSessionsCount}</div>
          <div className="stat-foot">Treinos e simulados</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Questões respondidas</span>
            <BookOpen size={17} />
          </div>
          <div className="stat-value">{overviewStats.totalAnswered}</div>
          <div className="stat-foot">Com alternativa selecionada</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Respostas corretas</span>
            <Target size={17} />
          </div>
          <div className="stat-value">{overviewStats.totalCorrect}</div>
          <div className="stat-foot">Conforme gabarito disponível</div>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Para revisar</span>
            <Bookmark size={17} />
          </div>
          <div className="stat-value">{overviewStats.uniqueReviewedQuestionsCount}</div>
          <div className="stat-foot">Questões únicas marcadas</div>
        </div>
      </div>

      <section className="surface-panel subject-performance">
        <div className="section-heading">
          <div>
            <div className="eyebrow">DISTRIBUIÇÃO POR MATÉRIA</div>
            <h2>Onde você está praticando</h2>
          </div>
        </div>

        {subjectStats.map((s) => (
          <div className="subject-performance-row" key={s.subject}>
            <div className="subject-performance-label">
              <span>{s.subject}</span>
              <small>{s.count} resposta(s)</small>
            </div>
            <div className="performance-track">
              <div className="performance-fill" style={{ width: `${s.accuracy}%` }} />
            </div>
            <strong>{s.count ? `${s.accuracy}%` : '—'}</strong>
          </div>
        ))}

        <p className="disclaimer">
          Amostras pequenas podem distorcer a porcentagem. O protótipo ainda não calcula dificuldade
          adaptativa nem tendências por período.
        </p>
      </section>
    </>
  );
}
