import { useState } from 'react';
import { Save } from 'lucide-react';
import type { Difficulty, Question, Subject } from '../../types';
import { ModalShell } from '../common/ModalShell';
import {
  DIFFICULTIES,
  OPTION_LETTERS,
  SUBJECTS,
  revalidateQuestion,
  uid,
  validateQuestion,
} from '../../services/questionService';

interface AddQuestionModalProps {
  /** Quando presente, o modal edita esta questão em vez de criar uma nova. */
  question?: Question;
  onClose: () => void;
  onSave: (question: Question) => void;
  onError: (message: string) => void;
}

export function AddQuestionModal({ question, onClose, onSave, onError }: AddQuestionModalProps) {
  const isEdit = Boolean(question);

  const [subject, setSubject] = useState<Subject>(question?.subject ?? 'Matemática');
  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? 'Intermediária');
  const [topic, setTopic] = useState(
    question && question.topic !== 'Sem assunto definido' ? question.topic : ''
  );
  const [statement, setStatement] = useState(question?.statement ?? '');
  const [alternatives, setAlternatives] = useState<string[]>(() =>
    OPTION_LETTERS.map((letter) => question?.alternatives?.[letter] ?? '')
  );
  const [answerKey, setAnswerKey] = useState(question?.answerKey ?? 'A');
  const [explanation, setExplanation] = useState(question?.explanation ?? '');

  const handleSubmit = () => {
    if (!statement.trim()) {
      onError('Preencha o enunciado da questão.');
      return;
    }

    const alternativesObj = Object.fromEntries(
      OPTION_LETTERS.map((letter, i): [string, string] => [letter, alternatives[i].trim()]).filter(
        ([, value]) => Boolean(value)
      )
    ) as Record<string, string>;

    const finalAnswerKey = alternativesObj[answerKey] ? answerKey : undefined;

    const validation = validateQuestion({
      statement: statement.trim(),
      subject,
      difficulty,
      alternatives: alternativesObj,
      answerKey: finalAnswerKey,
    });

    if (!validation.valid) {
      onError(validation.errors[0]);
      return;
    }

    const keyChanged = isEdit && question!.answerKey !== finalAnswerKey;

    const edited: Question = {
      id: question?.id ?? uid('q'),
      subject,
      topic: topic.trim() || 'Sem assunto definido',
      difficulty,
      statement: statement.trim(),
      alternatives: alternativesObj,
      answerKey: finalAnswerKey,
      explanation: explanation.trim() || undefined,
      source: question
        ? {
            ...question.source,
            // Gabarito alterado à mão deixa de ser "oficial": a procedência é do revisor.
            gabaritoOficialSource: keyChanged ? undefined : question.source.gabaritoOficialSource,
          }
        : { label: 'Cadastro manual' },
      tags: question?.tags ?? [],
      createdAt: question?.createdAt ?? new Date().toISOString(),
      hasOfficialKey: keyChanged ? false : question?.hasOfficialKey,
      referencedFigures: question?.referencedFigures,
      annulled: question?.annulled,
      alerts: keyChanged
        ? [
            ...(question?.alerts ?? []),
            `Gabarito alterado manualmente${
              question?.answerKey ? ` (a fonte oficial indicava ${question.answerKey})` : ''
            }.`,
          ]
        : question?.alerts,
      validationState: question?.validationState,
    };

    onSave(isEdit ? revalidateQuestion(edited) : edited);
  };

  return (
    <ModalShell
      title={isEdit ? 'Editar questão' : 'Adicionar questão'}
      subtitle={
        isEdit
          ? 'Corrija o conteúdo. Os alertas estruturais são recalculados ao salvar.'
          : 'Inclua uma questão ao banco local.'
      }
      onClose={onClose}
    >
      <div className="modal-form add-question-form">
        <div className="form-grid-two">
          <label className="field-label" htmlFor="new-subject-select">
            Matéria
            <select
              id="new-subject-select"
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
            >
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="field-label" htmlFor="new-difficulty-select">
            Dificuldade
            <select
              id="new-difficulty-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field-label" htmlFor="new-topic-input">
          Assunto
          <input
            id="new-topic-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ex.: Geometria analítica"
          />
        </label>

        <label className="field-label" htmlFor="new-statement-textarea">
          Enunciado
          <textarea
            id="new-statement-textarea"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            placeholder="Digite o enunciado completo..."
            rows={4}
          />
        </label>

        <div className="field-label">
          Alternativas{' '}
          <span className="field-optional">(deixe em branco para questão discursiva)</span>
          <div className="new-alternatives">
            {OPTION_LETTERS.map((letter, i) => (
              <div className="new-alternative-row" key={letter}>
                <span>{letter}</span>
                <input
                  id={`alt-input-${letter}`}
                  value={alternatives[i]}
                  onChange={(e) =>
                    setAlternatives((prev) =>
                      prev.map((x, idx) => (idx === i ? e.target.value : x))
                    )
                  }
                  placeholder={`Texto da alternativa ${letter}`}
                />
              </div>
            ))}
          </div>
        </div>

        <label className="field-label" htmlFor="new-answer-select">
          Gabarito
          <select
            id="new-answer-select"
            value={answerKey}
            onChange={(e) => setAnswerKey(e.target.value)}
          >
            {OPTION_LETTERS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>

        <label className="field-label" htmlFor="new-explanation-textarea">
          Resolução comentada
          <textarea
            id="new-explanation-textarea"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explique o raciocínio, se desejar..."
            rows={3}
          />
        </label>

        <div className="modal-footer">
          <span className="modal-foot-note">Cadastro local, sem sincronização externa</span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="button button-primary" onClick={handleSubmit}>
            <Save size={16} /> Salvar questão
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
