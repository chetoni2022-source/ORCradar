import { LayoutDashboard, Map as MapIcon, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { Logo } from './Logo';
import type { Theme } from '../App';

export type View = 'overview' | 'mapa';

type TopBarProps = {
  view: View;
  onNavigate: (v: View) => void;
  theme: Theme;
  onToggleTheme: () => void;
  email: string | null;
  onSignOut: () => void;
};

export function TopBar({ view, onNavigate, theme, onToggleTheme, email, onSignOut }: TopBarProps) {
  return (
    <header className="orc-topbar">
      <div className="row" style={{ gap: 12 }}>
        <Logo size={19} />
        <span className="badge badge-neutral">Fase 1</span>
      </div>

      <nav className="orc-nav" style={{ marginLeft: 6 }}>
        <button
          className={`orc-nav-tab ${view === 'overview' ? 'is-active' : ''}`}
          onClick={() => onNavigate('overview')}
        >
          <LayoutDashboard size={16} />
          <span className="orc-nav-label">Visão geral</span>
        </button>
        <button
          className={`orc-nav-tab ${view === 'mapa' ? 'is-active' : ''}`}
          onClick={() => onNavigate('mapa')}
        >
          <MapIcon size={16} />
          <span className="orc-nav-label">Mapa</span>
        </button>
      </nav>

      <div className="grow" />

      {email && (
        <span className="orc-email" title={email}>
          <UserRound size={14} /> {email}
        </span>
      )}
      <button
        className="btn btn-ghost"
        style={{ width: 42, padding: 0 }}
        onClick={onToggleTheme}
        aria-label="Alternar tema claro/escuro"
        title="Alternar tema"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onSignOut} title="Sair">
        <LogOut size={15} />
        <span className="orc-nav-label">Sair</span>
      </button>
    </header>
  );
}
