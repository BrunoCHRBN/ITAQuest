import { Bookmark, BookmarkCheck, Play } from 'lucide-react';
import type { Question, StudySession, View } from '../../types';
import { PageHeader } from '../layout/PageHeader';
import { QuestionRow } from '../question/QuestionRow';

interface ReviewsPageProps {
  questions: Question[];
  sessions: StudySession[];
  onNavigate: (view: View) => void;
  onStartSingleQuestion: (id: string) => void;
  onOpenSessionModal: (ids: string[]) => void;
  onNotify: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export function ReviewsPage({
  questions,
  sessions,
  onNavigate,
  onStartSingleQuestion,
  onOpenSessionModal,
  onNotify,
}: ReviewsPageProps) {
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const reviewItems = sessions.flatMap((s) =>
    s.questionIds
      .filter((id) => s.responses[id]?.markedForReview)
      .map((id) => ({ session: s, question: questionMap.get(id) }))
  ).filter((item): item is { session: StudySession; question: Question } => Boolean(item.question));

  const unique = Array.from(
    new Map(reviewItems.map((item) => [item.question.id, item])).values()
  );

  const handleStartReviewSession = () => {
    const ids = unique.map((item) => item.question.id);
    if (ids.length) {
      onOpenSessionModal(ids);
    } else {
      onNotify('Nenhuma questão marcada para revisão.', 'info');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="REVISÃO DELIBERADA"
        title="Questões para revisar"
        subtitle="Retome os pontos que você decidiu revisitar durante a resolução."
        actions={
          <button className="button button-secondary" onClick={handleStartReviewSession}>
            <Play size={16} /> Revisar lista
          </button>
        }
      />

      <div className="review-summary">
        <div className="review-summary-icon">
          <BookmarkCheck size={20} />
        </div>
        <div>
          <strong>{unique.length} questão(ões) marcadas</strong>
          <p>As marcações são preservadas por sessão e armazenadas localmente.</p>
        </div>
      </div>

      {unique.length ? (
        <div className="question-list">
          {unique.map(({ question }) => (
            <QuestionRow
              key={question.id}
              question={question}
              onResolve={() => onStartSingleQuestion(question.id)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-illustration">
            <Bookmark size={24} />
          </div>
          <h3>Sua lista está vazia</h3>
          <p>Durante uma sessão, use “Marcar para revisar” nas questões que deseja retomar.</p>
          <button className="button button-secondary" onClick={() => onNavigate('bank')}>
            Explorar questões
          </button>
        </div>
      )}
    </>
  );
}
