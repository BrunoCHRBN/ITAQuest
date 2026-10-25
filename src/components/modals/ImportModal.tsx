import { useState } from 'react';
import { AlertCircle, Download, FileUp } from 'lucide-react';
import type { Question } from '../../types';
import { ModalShell } from '../common/ModalShell';
import { generateTemplateJson, resolveImportedFile } from '../../services/importService';
import { downloadJsonFile } from '../../services/backupService';

interface ImportModalProps {
  onClose: () => void;
  onImport: (questions: Question[], warnings: string[]) => void;
  onError: (message: string) => void;
}

export function ImportModal({ onClose, onImport, onError }: ImportModalProps) {
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    setLoading(true);
    try {
      const text = await file.text();
      const { questions, warnings } = resolveImportedFile(text, file.name);

      if (!questions.length) {
        throw new Error('Nenhuma questão válida foi identificada no arquivo.');
      }

      onImport(questions, warnings);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Falha ao processar arquivo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = () => {
    const template = JSON.parse(generateTemplateJson());
    downloadJsonFile(template, 'modelo-importacao-itaquest.json');
  };

  return (
    <ModalShell
      title="Importar questões"
      subtitle="Adicione várias questões de uma vez usando JSON ou CSV."
      onClose={onClose}
    >
      <div className="modal-form">
        <div className="import-dropzone">
          <div className="import-file-icon">
            <FileUp size={23} />
          </div>
          <h3>Importe seu arquivo</h3>
          <p>
            Formatos aceitos: .json e .csv. Cada questão será validada estruturalmente antes de entrar no
            banco.
          </p>
          <label className="button button-primary import-browse">
            {loading ? 'Processando...' : 'Escolher arquivo'}
            <input
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              disabled={loading}
            />
          </label>
          <span className="supported-formats">JSON estruturado · CSV com cabeçalho</span>
        </div>

        <div className="import-warning">
          <AlertCircle size={17} />
          <p>
            O importador verifica a estrutura básica e possíveis duplicatas. Ele não confirma se o
            enunciado ou gabarito corresponde à prova original.
          </p>
        </div>

        <div className="import-help">
          <div>
            <b>Precisa do formato?</b>
            <p>Baixe um modelo para ver os campos esperados pelo importador.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={handleDownloadTemplate}>
            <Download size={15} /> Baixar modelo JSON
          </button>
        </div>

        <div className="modal-footer">
          <span className="modal-foot-note">Os dados importados ficam no navegador</span>
          <button type="button" className="button button-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
