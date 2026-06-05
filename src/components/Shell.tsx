import { Map as MapIcon, Radar, Target, Settings, Sun, Moon, LogOut } from 'lucide-react';
import { Logo } from './Logo';
import type { View, Theme } from '../App';

export const NAV: { id: View; label: string; short: string; Icon: typeof MapIcon }[] = [
  { id: 'mapa', label: 'Mapa', short: 'Mapa', Icon: MapIcon },
  { id: 'regioes', label: 'Regiões', short: 'Regiões', Icon: Radar },
  { id: 'leads', label: 'Leads', short: 'Leads', Icon: Target },
  { id: 'config', label: 'Configurações', short: 'Config', Icon: Settings },
];

type SidebarProps = {
  view: View;
  onNavigate: (v: View) => void;
  email: string | null;
  theme: Theme;
  onToggleTheme: () => void;
  onSignOut: () => void;
  counts?: Partial<Record<View, number>>;
};

export function Sidebar({ view, onNavigate, email, theme, onToggleTheme, onSignOut, counts }: SidebarProps) {
  const initial = (email ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <aside className="sidebar2">
      <div className="sidebar2-logo"><Logo size={20} /></div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.slice(0, 3).map(({ id, label, Icon }) => (
          <button key={id} className={`nav-item ${view === id ? 'is-active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={18} /> <span className="grow">{label}</span>
            {counts?.[id] ? <span className="nav-count">{counts[id]}</span> : null}
          </button>
        ))}
        <div className="nav-section-label">Ferramentas</div>
        {NAV.slice(3).map(({ id, label, Icon }) => (
          <button key={id} className={`nav-item ${view === id ? 'is-active' : ''}`} onClick={() => onNavigate(id)}>
            <Icon size={18} /> <span className="grow">{label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar2-footer">
        <div className="divider" style={{ marginBottom: 8 }} />
        <div className="sidebar2-user">
          <span className="avatar-sm">{initial}</span>
          <span className="grow" style={{ minWidth: 0 }}>
            <div className="t-caption" style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email ?? '—'}</div>
            <div className="t-caption t-faint">Dono · Fase 1</div>
          </span>
        </div>
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          <button className="btn btn-ghost btn-sm grow" onClick={onToggleTheme}>{theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} Tema</button>
          <button className="btn btn-ghost btn-sm grow" style={{ color: 'var(--error)' }} onClick={onSignOut}><LogOut size={14} /> Sair</button>
        </div>
      </div>
    </aside>
  );
}

export function BottomTabBar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <nav className="bottom-tabbar">
      {NAV.map(({ id, short, Icon }) => (
        <button key={id} className={`tab-item ${view === id ? 'is-active' : ''}`} onClick={() => onNavigate(id)}>
          <Icon size={21} /><span>{short}</span>
        </button>
      ))}
    </nav>
  );
}
