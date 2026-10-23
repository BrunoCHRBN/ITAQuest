import { ArrowLeft, ArrowRight, GraduationCap, RotateCcw } from 'lucide-react';
import type { Question, StudySession, View } from '../../types';
import { PageHeader } from '../layout/PageHeader';
import { calculateSessionStats, formatDate, formatDuration } from '../../services/scoringService';

interface ResultsPageProps {
  resultSession: StudySession | null;
  questions: Question[];
  onNavigate: (view: View) => void;
  onStartSingleQuestion: (id: string) => void;
  onOpenSessionModal: (ids: string[]) => void;
  onNotify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function ResultsPage({
  resultSession,
  questions,
  onNavigate,
  onStartSingleQuestion,
  onOpenSessionModal,
  onNotify,
}: ResultsPageProps) {
  if (!resultSession) {
    return (
      <div className="empty-state">
        <h3>Nenhum resultado selecionado</h3>
        <p>Finalize uma sessão para consultar o resumo.</p>
        <button className="button button-primary" onClick={() => onNavigate('sessions')}>
          Ver sessões
        </button>
      </div>
    );
  }

  const stats = calculateSessionStats(resultSession, questions);

  const handleReviewErrors = () => {
    const errorQuestionIds = stats.items
      .filter((item) => item.hasKey && item.isWrong)
      .map((item) => item.question.id);

    if (!errorQuestionIds.length) {
      onNotify('Não há respostas incorretas com gabarito nesta sessão.', 'info');
      return;
    }

    onOpenSessionModal(errorQuestionIds);
  };

  return (
    <>
      <PageHeader
        eyebrow="SESSÃO CONCLUÍDA"
        title="Uma etapa a mais."
        subtitle="Revise seu desempenho e transforme os erros em próximos passos."
        actions={
          <button className="button button-secondary" onClick={() => onNavigate('sessions')}>
            <ArrowLeft size={16} /> Voltar às sessões
          </button>
        }
      />

      <div className="result-hero">
        <div className="result-seal">
          <GraduationCap size={27} />
        </div>
        <div className="result-hero-copy">
          <span>
            {resultSession.mode === 'simulado' ? 'SIMULADO' : 'TREINO'} ·{' '}
            {formatDate(resultSession.finishedAt)}
          </span>
          <h2>{resultSession.title}</h2>
          <p>Sessão finalizada. Use este resumo para planejar a próxima revisão.</p>
        </div>
        <div className="result-score">
          <strong>{stats.accuracy}%</strong>
          <span>de acerto entre as respostas corrigíveis</span>
        </div>
      </div>

      <div className="result-stat-grid">
        <div className="result-stat">
          <span>Questões</span>
          <b>{stats.total}</b>
          <small>na sessão</small>
        </div>
        <div className="result-stat correct-stat">
          <span>Acertos</span>
          <b>{stats.correctCount}</b>
          <small>respostas corretas</small>
        </div>
        <div className="result-stat wrong-stat">
          <span>Erros</span>
          <b>{stats.wrongCount}</b>
          <small>vale revisar</small>
        </div>
        <div className="result-stat">
          <span>Em branco</span>
          <b>{stats.unansweredCount}</b>
          <small>sem alternativa registrada</small>
        </div>
        <div className="result-stat">
          <span>Tempo</span>
          <b>{formatDuration(resultSession.elapsedSeconds ?? 0)}</b>
          <small>tempo total</small>
        </div>
      </div>

      <div className="result-content-grid">
        <section className="surface-panel result-review-panel">
          <div className="section-heading">
            <div>
              <div className="eyebrow">QUESTÃO A QUESTÃO</div>
              <h2>Seu resultado</h2>
            </div>
            <span className="count-label">{stats.items.length} itens</span>
          </div>

          <div className="result-question-list">
            {stats.items.map(({ question, response, isCorrect, isWrong }, idx) => (
              <div className="result-question-row" key={question.id}>
                <span
                  className={`result-number ${
                    isCorrect
                      ? 'result-number-correct'
                      : isWrong
                      ? 'result-number-wrong'
                      : ''
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="result-question-copy">
                  <b>
                    {question.subject} · {question.topic}
                  </b>
                  <span>
                    {response.selectedOption
                      ? `Sua resposta: ${response.selectedOption}`
                      : response.notes.trim()
                      ? 'Resolução registrada'
                      : 'Não respondida'}
                    {question.answerKey ? ` · Gabarito: ${question.answerKey}` : ''}
                  </span>
                </div>

                <div
                  className={`result-verdict ${
                    isCorrect ? 'verdict-correct' : isWrong ? 'verdict-wrong' : ''
                  }`}
                >
                  {!response.selectedOption
                    ? response.notes.trim()
                      ? 'Registrada'
                      : 'Em branco'
                    : !question.answerKey
                    ? 'Sem gabarito'
                    : isCorrect
                    ? 'Acerto'
                    : 'Revisar'}
                </div>

                <button
                  className="subtle-icon"
                  onClick={() => onStartSingleQuestion(question.id)}
                  title="Resolver novamente"
                >
                  <RotateCcw size={15} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <aside className="surface-panel next-steps-panel">
          <div className="eyebrow">PRÓXIMO PASSO</div>
          <h2>Aprender também é revisar.</h2>
          <p>Reabra as questões que errou ou salve-as para uma sessão de revisão direcionada.</p>
          <button
            className="button button-primary full-button"
            onClick={handleReviewErrors}
          >
            Revisar erros <ArrowRight size={16} />
          </button>
          <button
            className="button button-secondary full-button"
            onClick={() => onNavigate('bank')}
          >
            Voltar ao banco
          </button>
        </aside>
      </div>
    </>
  );
}
