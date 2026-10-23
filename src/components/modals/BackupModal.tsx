import { useState } from 'react';
import { AlertCircle, CheckCircle2, Database, Download, FileUp, RefreshCw, Trash2 } from 'lucide-react';
import type { BackupData, Question, RestoreStrategy, StudySession } from '../../types';
import { ModalShell } from '../common/ModalShell';
import { createBackup, downloadJsonFile, restoreBackup, validateBackup } from '../../services/backupService';
import { formatDate } from '../../services/scoringService';

interface BackupModalProps {
  questions: Question[];
  sessions: StudySession[];
  onClose: () => void;
  onRestoreApplied: (params: {
    questions: Question[];
    sessions: StudySession[];
    message: string;
  }) => void;
  onError: (message: string) => void;
  onClearQuestions?: () => void;
}

export function BackupModal({
  questions,
  sessions,
  onClose,
  onRestoreApplied,
  onError,
  onClearQuestions,
}: BackupModalProps) {
  const [strategy, setStrategy] = useState<RestoreStrategy>('merge');
  const [loadedBackup, setLoadedBackup] = useState<BackupData | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string>('');

  const handleExport = () => {
    const backup = createBackup(questions, sessions);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadJsonFile(backup, `rotina-ita-backup-${dateStr}.json`);
  };

  const handleFileSelect = async (file?: File) => {
    if (!file) return;
    setSelectedFileName(file.name);
    setValidationErrors([]);
    setLoadedBackup(null);

    try {
      const text = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        setValidationErrors(['O arquivo selecionado não é um JSON válido.']);
        return;
      }

      const result = validateBackup(raw);
      if (!result.valid || !result.backup) {
        setValidationErrors(result.errors);
      } else {
        setLoadedBackup(result.backup);
      }
    } catch (err) {
      setValidationErrors([
        err instanceof Error ? err.message : 'Não foi possível ler o arquivo de backup.',
      ]);
    }
  };

  const handleExecuteRestore = () => {
    if (!loadedBackup) return;

    if (strategy === 'replace') {
      const confirmed = window.confirm(
        'ATENÇÃO: A opção "Substituir tudo" substituirá todo o seu banco local pelo conteúdo deste arquivo. Deseja continuar?'
      );
      if (!confirmed) return;
    }

    const {
      questions: newQuestions,
      sessions: newSessions,
      result,
    } = restoreBackup(questions, sessions, loadedBackup, strategy);

    const msg =
      strategy === 'replace'
        ? `Backup restaurado com sucesso! ${result.restoredQuestions} questões e ${result.restoredSessions} sessões carregadas.`
        : `Backup mesclado! ${result.restoredQuestions} novas questões e ${result.restoredSessions} novas sessões adicionadas (${result.skippedDuplicates} duplicatas ignoradas).`;

    onRestoreApplied({
      questions: newQuestions,
      sessions: newSessions,
      message: msg,
    });
  };

  return (
    <ModalShell
      title="Backup e Restauração"
      subtitle="Exporte todos os seus dados ou restaure um backup completo com segurança."
      onClose={onClose}
    >
      <div className="modal-form">
        {/* Export Section */}
        <div className="backup-section surface-panel" style={{ padding: '16px 18px', marginBottom: 16 }}>
          <div className="section-heading" style={{ marginBottom: 10 }}>
            <div>
              <div className="eyebrow">CÓPIA DE SEGURANÇA</div>
              <h2 style={{ fontSize: 18 }}>Exportar backup completo</h2>
            </div>
            <button type="button" className="button button-primary" onClick={handleExport}>
              <Download size={16} /> Exportar JSON
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#7d837b', lineHeight: 1.6 }}>
            Inclui <b>{questions.length} questão(ões)</b> e <b>{sessions.length} sessão(ões)</b> com
            respostas, anotações, marcações de revisão, tempos e resultados acumulados.
          </p>
        </div>

        {/* Restore Section */}
        <div className="backup-section surface-panel" style={{ padding: '16px 18px' }}>
          <div className="eyebrow">RECUPERAÇÃO</div>
          <h2 style={{ fontSize: 18, margin: '4px 0 10px' }}>Restaurar backup</h2>
          <p style={{ margin: '0 0 14px', fontSize: 11, color: '#7d837b', lineHeight: 1.6 }}>
            Carregue um arquivo JSON de backup previamente exportado. O sistema valida a estrutura
            antes de qualquer modificação no seu banco local.
          </p>

          <label
            className="button button-secondary import-browse"
            style={{ display: 'inline-flex', cursor: 'pointer', marginBottom: 12 }}
          >
            <FileUp size={16} /> {selectedFileName ? `Arquivo: ${selectedFileName}` : 'Selecionar arquivo de backup'}
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />
          </label>

          {validationErrors.length > 0 && (
            <div className="import-warning" style={{ margin: '12px 0' }}>
              <AlertCircle size={17} />
              <div>
                <b>Arquivo inválido:</b>
                <ul style={{ margin: '4px 0 0', paddingLeft: 16, fontSize: 11 }}>
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {loadedBackup && (
            <div
              style={{
                background: '#eef4ee',
                border: '1px solid #c9dccb',
                borderRadius: 10,
                padding: '12px 14px',
                margin: '12px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#2b583f', fontWeight: 600, fontSize: 12 }}>
                <CheckCircle2 size={16} /> Backup verificado e válido!
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: '#455848', lineHeight: 1.6 }}>
                Exportado em: <b>{formatDate(loadedBackup.exportedAt)}</b> · Versão: <b>{loadedBackup.version}</b>
                <br />
                Contém: <b>{loadedBackup.questions.length} questões</b> e <b>{loadedBackup.sessions.length} sessões</b>.
              </div>

              <div style={{ marginTop: 14 }}>
                <span className="field-label" style={{ fontWeight: 700, fontSize: 11, marginBottom: 8, display: 'block' }}>
                  Estratégia de restauração:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 11 }}>
                    <input
                      type="radio"
                      name="strategy"
                      value="merge"
                      checked={strategy === 'merge'}
                      onChange={() => setStrategy('merge')}
                    />
                    <div>
                      <b>Mesclar com dados existentes (Recomendado)</b>
                      <div style={{ color: '#687268', fontSize: 10 }}>
                        Preserva suas questões e sessões locais. Adiciona somente questões e sessões novas.
                      </div>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', fontSize: 11 }}>
                    <input
                      type="radio"
                      name="strategy"
                      value="replace"
                      checked={strategy === 'replace'}
                      onChange={() => setStrategy('replace')}
                    />
                    <div>
                      <b>Substituir banco local</b>
                      <div style={{ color: '#9a4c38', fontSize: 10 }}>
                        Apaga o estado local atual e restaura exclusivamente os dados deste backup.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={handleExecuteRestore}
                >
                  <RefreshCw size={16} /> Aplicar restauração ({strategy === 'merge' ? 'Mesclar' : 'Substituir'})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reset Section */}
        {questions.length > 0 && onClearQuestions && (
          <div className="backup-section surface-panel" style={{ padding: '14px 18px', marginTop: 16, borderColor: '#f0d2cc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <div>
                <div className="eyebrow" style={{ color: '#9a4c38' }}>ZONA DE LIMPEZA</div>
                <h3 style={{ fontSize: 16, margin: '2px 0 4px', color: '#9a4c38' }}>Zerar banco de questões</h3>
                <p style={{ margin: 0, fontSize: 11, color: '#7d837b', lineHeight: 1.5 }}>
                  Apaga todas as {questions.length} questão(ões) cadastradas localmente para iniciar a inserção do zero.
                </p>
              </div>
              <button
                type="button"
                className="button button-secondary"
                style={{ color: '#9a4c38', borderColor: '#e4c4be', whiteSpace: 'nowrap' }}
                onClick={() => {
                  const confirmed = window.confirm(
                    `Tem certeza de que deseja zerar todas as ${questions.length} questão(ões) do banco local? Essa ação não pode ser desfeita.`
                  );
                  if (confirmed) {
                    onClearQuestions();
                    onClose();
                  }
                }}
              >
                <Trash2 size={15} /> Zerar questões
              </button>
            </div>
          </div>
        )}

        <div className="modal-footer" style={{ marginTop: 16 }}>
          <span className="modal-foot-note">
            <Database size={14} /> Nenhum dado é enviado a servidores externos.
          </span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
