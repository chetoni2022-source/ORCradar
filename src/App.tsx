import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { TopBar, type View } from './components/TopBar';
import { HomePage } from './pages/HomePage';
import { RadarMapPage } from './pages/RadarMapPage';
import { LoginPage } from './pages/LoginPage';
import { RadarMark } from './components/RadarMark';
import { isSupabaseConfigured } from './lib/supabase';
import { getSession, onAuthChange, checkOwner, signOut } from './lib/auth';

export type Theme = 'light' | 'dark';

function Splash({ label }: { label: string }) {
  return (
    <div className="login-wrap">
      <div className="brand-blobs" aria-hidden />
      <div className="col" style={{ alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
        <RadarMark size={72} />
        <div className="row t-muted" style={{ gap: 8 }}>
          <Loader2 size={16} className="spin" /> {label}
        </div>
      </div>
    </div>
  );
}

function CentralCard({ children }: { children: ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="brand-blobs" aria-hidden />
      <div className="login-card card card-lg col" style={{ gap: 16, alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('orcradar-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('theme-dark', theme === 'dark');
    localStorage.setItem('orcradar-theme', theme);
  }, [theme]);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [owner, setOwner] = useState<boolean | null>(null);
  const [view, setView] = useState<View>('overview');

  useEffect(() => {
    let alive = true;
    getSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setAuthLoading(false);
    });
    const unsub = onAuthChange((s) => { if (alive) setSession(s); });
    return () => { alive = false; unsub(); };
  }, []);

  // Verifica owner apenas quando o USUÁRIO muda (não a cada refresh de token).
  // Sem isso, voltar pra aba disparava onAuthStateChange (TOKEN_REFRESHED) e a
  // tela ficava "Verificando acesso…" toda vez. Agora o refresh não reseta nada.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    let alive = true;
    if (!userId) { setOwner(null); return; }
    checkOwner(userId).then((ok) => { if (alive) setOwner(ok); });
    return () => { alive = false; };
  }, [userId]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  let content: ReactNode;

  if (!isSupabaseConfigured) {
    content = (
      <CentralCard>
        <ShieldAlert size={32} style={{ color: 'var(--warning)' }} />
        <div className="t-h2">Configuração ausente</div>
        <div className="t-body t-muted">
          Preencha <span className="mono-code">VITE_SUPABASE_URL</span> e{' '}
          <span className="mono-code">VITE_SUPABASE_ANON_KEY</span> no arquivo{' '}
          <span className="mono-code">.env</span> e reinicie o servidor.
        </div>
      </CentralCard>
    );
  } else if (authLoading) {
    content = <Splash label="Carregando…" />;
  } else if (!session) {
    content = <LoginPage />;
  } else if (owner === null) {
    content = <Splash label="Verificando acesso…" />;
  } else if (owner === false) {
    content = (
      <CentralCard>
        <ShieldAlert size={32} style={{ color: 'var(--error)' }} />
        <div className="t-h2">Acesso restrito</div>
        <div className="t-body t-muted">
          A conta <span className="mono-code">{session.user.email}</span> não é dona da plataforma.
          O ORCradar é exclusivo do superadmin.
        </div>
        <button className="btn btn-secondary" onClick={() => void signOut()}>
          <LogOut size={16} /> Sair
        </button>
      </CentralCard>
    );
  } else {
    content = (
      <>
        <TopBar
          view={view}
          onNavigate={setView}
          theme={theme}
          onToggleTheme={toggleTheme}
          email={session.user.email ?? null}
          onSignOut={() => void signOut()}
        />
        <div className="grow" style={{ minHeight: 0 }}>
          {view === 'overview' ? <HomePage onOpenMapa={() => setView('mapa')} /> : <RadarMapPage />}
        </div>
      </>
    );
  }

  return (
    <div className="app-root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      {content}
    </div>
  );
}
