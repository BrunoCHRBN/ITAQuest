import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, LockKeyhole, Play, Search, Timer } from 'lucide-react';
import type { Question, StudyMode } from '../../types';
import { ModalShell } from '../common/ModalShell';

interface CreateSessionModalProps {
  questions: Question[];
  initialSelectedIds?: string[];
  onClose: () => void;
  onCreate: (params: {
    title: string;
    mode: StudyMode;
    timeLimitMinutes?: number;
    questionIds: string[];
    startNow: boolean;
  }) => void;
}

export function CreateSessionModal({
  questions,
  initialSelectedIds = [],
  onClose,
  onCreate,
}: CreateSessionModalProps) {
  const [title, setTitle] = useState(
    initialSelectedIds.length ? 'Sessão personalizada' : 'Sessão de estudo'
  );
  const [mode, setMode] = useState<StudyMode>('treino');
  const [limit, setLimit] = useState('120');
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [search, setSearch] = useState('');

  const filteredQuestions = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return questions;
    return questions.filter((q) =>
      `${q.subject} ${q.topic} ${q.statement}`.toLowerCase().includes(term)
    );
  }, [questions, search]);

  const toggleAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map((q) => q.id));
    }
  };

  const handleToggleQuestion = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleStart = () => {
    const chosen = selectedIds.filter((id) => questions.some((q) => q.id === id));
    if (!chosen.length) return;

    const parsedLimit = limit.trim() ? Math.min(600, Math.max(1, Number(limit) || 120)) : undefined;

    onCreate({
      title: title.trim() || (mode === 'simulado' ? 'Simulado' : 'Sessão de estudo'),
      mode,
      timeLimitMinutes: parsedLimit,
      questionIds: chosen,
      startNow: true,
    });
  };

  return (
    <ModalShell
      title="Montar uma sessão"
      subtitle="Escolha a sequência que você deseja resolver."
      onClose={onClose}
    >
      <div className="modal-form">
        <label className="field-label" htmlFor="session-title-input">
          Nome da sessão
          <input
            id="session-title-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Revisão de mecânica"
          />
        </label>

        <div className="field-label">
          Formato de estudo
          <div className="mode-choice-grid">
            <button
              type="button"
              className={`mode-choice ${mode === 'treino' ? 'mode-choice-active' : ''}`}
              onClick={() => setMode('treino')}
            >
              <div className="mode-choice-icon">
                <BookOpen size={18} />
              </div>
              <span>
                <b>Treino</b>
                <small>Confira respostas durante a prática.</small>
              </span>
              {mode === 'treino' && <CheckCircle2 size={17} />}
            </button>

            <button
              type="button"
              className={`mode-choice ${mode === 'simulado' ? 'mode-choice-active' : ''}`}
              onClick={() => setMode('simulado')}
            >
              <div className="mode-choice-icon">
                <Timer size={18} />
              </div>
              <span>
                <b>Simulado</b>
                <small>Gabarito oculto até finalizar.</small>
              </span>
              {mode === 'simulado' && <CheckCircle2 size={17} />}
            </button>
          </div>
        </div>

        <div className="field-label">
          Tempo máximo
          <div className="input-with-suffix">
            <input
              type="number"
              min="1"
              max="600"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              placeholder="120"
              aria-label="Tempo máximo em minutos"
            />
            <span>minutos</span>
            <button type="button" onClick={() => setLimit('')} title="Sem limite de tempo">
              Sem limite
            </button>
          </div>
        </div>

        <div className="question-picker-header">
          <div>
            <b>Questões da sessão</b>
            <span>{selectedIds.length} selecionada(s)</span>
          </div>
          <button type="button" className="text-button" onClick={toggleAll}>
            {selectedIds.length === questions.length ? 'Desmarcar todas' : 'Selecionar todas'}
          </button>
        </div>

        <div className="question-picker-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Localizar questão..."
            aria-label="Localizar questão para sessão"
          />
        </div>

        <div className="question-picker-list">
          {filteredQuestions.map((q) => (
            <label key={q.id} className="picker-row">
              <input
                type="checkbox"
                checked={selectedIds.includes(q.id)}
                onChange={() => handleToggleQuestion(q.id)}
              />
              <span className="picker-text">
                <b>
                  {q.subject} <i>·</i> {q.topic}
                </b>
                <small>{q.statement}</small>
              </span>
              <span className="picker-difficulty">{q.difficulty}</span>
            </label>
          ))}
        </div>

        <div className="modal-footer">
          <span className="modal-foot-note">
            <LockKeyhole size={14} /> Respostas salvas neste navegador
          </span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleStart}
            disabled={!selectedIds.length}
          >
            <Play size={16} /> Iniciar sessão
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
