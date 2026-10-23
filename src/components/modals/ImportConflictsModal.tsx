import { useState } from 'react';
import { ArrowRight, Check, FileWarning, Replace, X } from 'lucide-react';
import type { DedupConflict } from '../../services/questionService';
import { ModalShell } from '../common/ModalShell';

type Decision = 'replace' | 'keep';

interface ImportConflictsModalProps {
  conflicts: DedupConflict[];
  freshCount: number;
  identicalCount: number;
  onClose: () => void;
  onApply: (decisions: Record<string, Decision>) => void;
}

function questionLabel(c: DedupConflict): string {
  const { source } = c.existing;
  const num = source.questionNumber ?? source.order;
  const parts = [source.label, source.year].filter(Boolean).join(' ');
  return `${parts}${num ? ` · questão ${num}` : ''}`;
}

function preview(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function ImportConflictsModal({
  conflicts,
  freshCount,
  identicalCount,
  onClose,
  onApply,
}: ImportConflictsModalProps) {
  // O padrão é substituir: quem reimporta uma questão com o mesmo número quase sempre quer a
  // versão nova (foi corrigida por isso). O contrário — manter — é a exceção explícita.
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(conflicts.map((c) => [c.existingId, 'replace' as Decision]))
  );

  const setAll = (decision: Decision) =>
    setDecisions(Object.fromEntries(conflicts.map((c) => [c.existingId, decision])));

  const replaceCount = Object.values(decisions).filter((d) => d === 'replace').length;

  return (
    <ModalShell
      title="Questões já existentes com conteúdo diferente"
      subtitle={`${conflicts.length} questão(ões) do arquivo já estão no banco com o mesmo documento e número, mas com conteúdo diferente. Escolha o que fica.`}
      onClose={onClose}
    >
      <div className="modal-form">
        <div className="import-warning">
          <FileWarning size={17} />
          <p>
            Nada é descartado sem sua decisão. A versão que você mantiver preserva o histórico de
            respostas: o identificador da questão no banco não muda.
          </p>
        </div>

        <div className="conflict-bulk-actions">
          <button type="button" className="text-button" onClick={() => setAll('replace')}>
            <Replace size={13} /> Substituir todas
          </button>
          <button type="button" className="text-button" onClick={() => setAll('keep')}>
            <X size={13} /> Manter todas
          </button>
        </div>

        <div className="conflict-list">
          {conflicts.map((c) => {
            const decision = decisions[c.existingId] ?? 'replace';
            return (
              <div className="conflict-item" key={c.existingId}>
                <div className="conflict-head">
                  <span className="conflict-label">{questionLabel(c)}</span>
                  <div className="conflict-changes">
                    {c.differences.map((d) => (
                      <span className="conflict-chip" key={d}>
                        {d}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="conflict-body">
                  <div className={`conflict-version ${decision === 'keep' ? 'conflict-selected' : ''}`}>
                    <span className="conflict-version-tag">No banco</span>
                    <p>{preview(c.existing.statement)}</p>
                    <small>
                      Gabarito: {c.existing.answerKey ?? '—'} · {Object.keys(c.existing.alternatives).length}{' '}
                      alternativa(s)
                    </small>
                  </div>

                  <div className="conflict-arrow" aria-hidden="true">
                    <ArrowRight size={14} />
                  </div>

                  <div className={`conflict-version ${decision === 'replace' ? 'conflict-selected' : ''}`}>
                    <span className="conflict-version-tag">No arquivo</span>
                    <p>{preview(c.incoming.statement)}</p>
                    <small>
                      Gabarito: {c.incoming.answerKey ?? '—'} · {Object.keys(c.incoming.alternatives).length}{' '}
                      alternativa(s)
                    </small>
                  </div>
                </div>

                <div className="conflict-choice" role="group" aria-label="Decisão para esta questão">
                  <button
                    type="button"
                    className={`conflict-choice-btn ${decision === 'replace' ? 'is-active' : ''}`}
                    aria-pressed={decision === 'replace'}
                    onClick={() => setDecisions((d) => ({ ...d, [c.existingId]: 'replace' }))}
                  >
                    <Replace size={13} /> Usar a do arquivo
                  </button>
                  <button
                    type="button"
                    className={`conflict-choice-btn ${decision === 'keep' ? 'is-active' : ''}`}
                    aria-pressed={decision === 'keep'}
                    onClick={() => setDecisions((d) => ({ ...d, [c.existingId]: 'keep' }))}
                  >
                    <Check size={13} /> Manter a do banco
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="modal-footer">
          <span className="modal-foot-note">
            {freshCount} nova(s) · {identicalCount} idêntica(s) ignorada(s) · {replaceCount} substituição(ões)
          </span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar importação
          </button>
          <button type="button" className="button button-primary" onClick={() => onApply(decisions)}>
            <Check size={16} /> Aplicar e importar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
