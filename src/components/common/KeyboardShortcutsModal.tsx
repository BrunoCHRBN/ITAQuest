import { Command, X } from 'lucide-react';
import { ModalShell } from './ModalShell';

interface ShortcutGroup {
  group: string;
  items: { key: string; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    group: 'Resolução e Alternativas',
    items: [
      { key: 'A – E', description: 'Seleciona instantaneamente a alternativa A, B, C, D ou E' },
      { key: 'Espaço', description: 'Confere ou oculta o gabarito comentado (no modo treino)' },
      { key: 'M', description: 'Marca ou desmarca a questão para revisão posterior' },
    ],
  },
  {
    group: 'Navegação e Ritmo',
    items: [
      { key: '→ ou K', description: 'Avança para a próxima questão do caderno' },
      { key: '← ou J', description: 'Retorna para a questão anterior' },
      { key: 'S', description: 'Alterna entre cronômetro completo (hh:mm:ss) e sutil' },
    ],
  },
  {
    group: 'Tática de Prova ITA (Varredura em 3 Voltas)',
    items: [
      { key: '1', description: '1ª Volta: Imediata / Garantida (resolução rápida sem risco)' },
      { key: '2', description: '2ª Volta: Trabalhosa (método claro, cálculo extenso)' },
      { key: '3', description: '3ª Volta: Combate / Chute consciente (alta complexidade)' },
    ],
  },
  {
    group: 'Ferramentas de Apoio',
    items: [
      { key: 'C', description: 'Abre a folha de constantes físico-químicas do ITA' },
      { key: '?', description: 'Exibe ou oculta esta janela de atalhos' },
      { key: 'Esc', description: 'Fecha qualquer painel ou janela aberta' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <ModalShell
      title="Atalhos de Teclado"
      subtitle="Navegue e resolva simulados sem tirar as mãos do teclado"
      onClose={onClose}
    >
      <div className="shortcuts-modal-body">
        <p className="shortcuts-tip">
          <b>Dica ergonômica:</b> Quando o cursor estiver ativo na caixa de texto discursivo, os atalhos de seleção são pausados para permitir digitação livre.
        </p>

        <div className="shortcuts-groups-grid">
          {SHORTCUT_GROUPS.map((g) => (
            <div key={g.group} className="shortcut-group-card">
              <h4>{g.group}</h4>
              <div className="shortcut-list">
                {g.items.map((item) => (
                  <div key={item.key} className="shortcut-row">
                    <kbd className="shortcut-kbd">{item.key}</kbd>
                    <span className="shortcut-desc">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions" style={{ marginTop: 24, justifyContent: 'flex-end' }}>
          <button type="button" className="button button-primary" onClick={onClose}>
            Entendi, continuar resolução
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
