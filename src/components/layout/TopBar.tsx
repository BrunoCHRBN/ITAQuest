import { CircleHelp, Database } from 'lucide-react';
import type { View } from '../../types';

interface TopBarProps {
  currentView: View;
  onHelpClick: () => void;
  onBackupClick?: () => void;
}

const VIEW_NAMES: Record<View, string> = {
  overview: 'Visão geral',
  bank: 'Banco de questões',
  sessions: 'Sessões e simulados',
  reviews: 'Revisões',
  stats: 'Desempenho',
  resolver: 'Resolução',
  results: 'Resultado',
};

export function TopBar({ currentView, onHelpClick, onBackupClick }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="breadcrumbs">
        <span>ITAQuest</span>
        <span className="crumb-slash">/</span>
        <b>{VIEW_NAMES[currentView] ?? 'Estudo'}</b>
      </div>
      <div className="topbar-right">
        {onBackupClick && (
          <button
            className="icon-button"
            title="Backup e Restauração"
            onClick={onBackupClick}
            aria-label="Backup e Restauração"
          >
            <Database size={16} />
          </button>
        )}
        <span className="local-status">
          <i /> Dados salvos localmente
        </span>
        <button className="topbar-help" onClick={onHelpClick} aria-label="Ajuda e status">
          <CircleHelp size={17} />
        </button>
        <div className="avatar-mark">R</div>
      </div>
    </header>
  );
}
