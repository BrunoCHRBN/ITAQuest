import {
  BookOpen,
  Bookmark,
  ChartNoAxesCombined,
  ClipboardList,
  Database,
  LayoutDashboard,
  Settings,
  Target,
  X,
} from 'lucide-react';
import type { View } from '../../types';

interface SidebarProps {
  currentView: View;
  mobileMenuOpen: boolean;
  reviewCount: number;
  onNavigate: (view: View) => void;
  onCloseMobile: () => void;
  onSettingsClick: () => void;
  onBackupClick?: () => void;
}

const NAV_ITEMS = [
  { id: 'overview' as View, label: 'Visão geral', icon: LayoutDashboard },
  { id: 'bank' as View, label: 'Banco de questões', icon: BookOpen },
  { id: 'sessions' as View, label: 'Sessões e simulados', icon: ClipboardList },
  { id: 'reviews' as View, label: 'Revisões', icon: Bookmark },
  { id: 'stats' as View, label: 'Desempenho', icon: ChartNoAxesCombined },
];

export function Sidebar({
  currentView,
  mobileMenuOpen,
  reviewCount,
  onNavigate,
  onCloseMobile,
  onSettingsClick,
  onBackupClick,
}: SidebarProps) {
  return (
    <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand">
        <div className="brand-symbol">
          <span>R</span>
          <i />
        </div>
        <div>
          <div className="brand-name">
            rotina <b>ITA</b>
          </div>
          <div className="brand-sub">CADERNO DE PREPARAÇÃO</div>
        </div>
        <button className="icon-button sidebar-close" aria-label="Fechar menu" onClick={onCloseMobile}>
          <X size={17} />
        </button>
      </div>

      <div className="nav-caption">ESPAÇO DE ESTUDOS</div>

      <nav className="nav-list">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentView === item.id ||
            ((currentView === 'resolver' || currentView === 'results') && item.id === 'sessions');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
              {item.id === 'reviews' && reviewCount > 0 && <span className="nav-count">{reviewCount}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <div className="note-icon">
            <Target size={17} />
          </div>
          <div>
            <b>Um passo por vez.</b>
            <p>Consistência antes de intensidade.</p>
          </div>
        </div>

        {onBackupClick && (
          <button className="nav-item settings-link" onClick={onBackupClick} style={{ marginBottom: 4 }}>
            <Database size={18} />
            <span>Backup e dados</span>
          </button>
        )}

        <button className="nav-item settings-link" onClick={onSettingsClick}>
          <Settings size={18} />
          <span>Configurações</span>
        </button>

        <div className="version-label">
          ROTINA ITA <span>·</span> PROTÓTIPO 0.1
        </div>
      </div>
    </aside>
  );
}
