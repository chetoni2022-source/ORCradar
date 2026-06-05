import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ShieldAlert, LogOut, Loader2 } from 'lucide-react';
import { Sidebar, BottomTabBar } from './components/Shell';
import { LoginPage } from './pages/LoginPage';
import { RadarMark } from './components/RadarMark';

// Code-splitting: o mapa (MapLibre ~786 KB) e as páginas só carregam quando
// abertas — o login e o primeiro paint ficam bem mais leves.
const MapWorkspace = lazy(() => import('./components/MapWorkspace').then((m) => ({ default: m.MapWorkspace })));
const RegioesPage = lazy(() => import('./pages/RegioesPage').then((m) => ({ default: m.RegioesPage })));
const LeadsPage = lazy(() => import('./pages/LeadsPage').then((m) => ({ default: m.LeadsPage })));
const AnalisePage = lazy(() => import('./pages/AnalisePage').then((m) => ({ default: m.AnalisePage })));
const ConfigPage = lazy(() => import('./pages/ConfigPage').then((m) => ({ default: m.ConfigPage })));
const LeadDetailModal = lazy(() => import('./components/LeadDetailModal').then((m) => ({ default: m.LeadDetailModal })));
import { isSupabaseConfigured } from './lib/supabase';
import { getSession, onAuthChange, checkOwner, signOut } from './lib/auth';
import { listRegioes } from './lib/radarRegioes';
import type { RadarRegiao } from './types/database';
import type { LeadMapa } from './lib/leads';

export type Theme = 'light' | 'dark';
export type View = 'mapa' | 'regioes' | 'leads' | 'analise' | 'config';

function Splash({ label }: { label: string }) {
  return (
    <div className="login-wrap">
      <div className="brand-blobs" aria-hidden />
      <div className="col" style={{ alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
        <RadarMark size={72} />
        <div className="row t-muted" style={{ gap: 8 }}><Loader2 size={16} className="spin" /> {label}</div>
      </div>
    </div>
  );
}

function CentralCard({ children }: { children: ReactNode }) {
  return (
    <div className="login-wrap">
      <div className="brand-blobs" aria-hidden />
      <div className="login-card card card-lg col" style={{ gap: 16, alignItems: 'center', textAlign: 'center', position: 'relative', zIndex: 1 }}>{children}</div>
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
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [owner, setOwner] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    getSession().then((s) => { if (!alive) return; setSession(s); setAuthLoading(false); });
    const unsub = onAuthChange((s) => { if (alive) setSession(s); });
    return () => { alive = false; unsub(); };
  }, []);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    let alive = true;
    if (!userId) { setOwner(null); return; }
    checkOwner(userId).then((ok) => { if (alive) setOwner(ok); });
    return () => { alive = false; };
  }, [userId]);

  // Estado compartilhado da app -----------------------------------------------
  const [view, setView] = useState<View>('mapa');
  const [regions, setRegions] = useState<RadarRegiao[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [regionsError, setRegionsError] = useState<string | null>(null);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [focusLatLng, setFocusLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [detailLead, setDetailLead] = useState<LeadMapa | null>(null);
  const [leadsVersion, setLeadsVersion] = useState(0);

  const reloadRegions = useCallback(async () => {
    setRegionsLoading(true); setRegionsError(null);
    try { setRegions(await listRegioes()); }
    catch (e) { setRegionsError(e instanceof Error ? e.message : 'Falha ao carregar regiões.'); }
    finally { setRegionsLoading(false); }
  }, []);
  useEffect(() => { if (owner) void reloadRegions(); }, [owner, reloadRegions]);

  function openLead(lead: LeadMapa) {
    if (lead.regiao) { const r = regions.find((x) => x.nome === lead.regiao); if (r) setActiveRegionId(r.id); }
    if (lead.latitude != null && lead.longitude != null) setFocusLatLng({ lat: lead.latitude, lng: lead.longitude });
    setView('mapa');
  }

  let content: ReactNode;

  if (!isSupabaseConfigured) {
    content = (
      <CentralCard>
        <ShieldAlert size={32} style={{ color: 'var(--warning)' }} />
        <div className="t-h2">Configuração ausente</div>
        <div className="t-body t-muted">Preencha <span className="mono-code">VITE_SUPABASE_URL</span> e <span className="mono-code">VITE_SUPABASE_ANON_KEY</span> no <span className="mono-code">.env</span> e reinicie.</div>
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
        <div className="t-body t-muted">A conta <span className="mono-code">{session?.user.email}</span> não é dona da plataforma.</div>
        <button className="btn btn-secondary" onClick={() => void signOut()}><LogOut size={16} /> Sair</button>
      </CentralCard>
    );
  } else {
    const email = session?.user.email ?? 'preview@local';
    content = (
      <div className="app-grid">
        <Sidebar view={view} onNavigate={setView} email={email} theme={theme} onToggleTheme={toggleTheme} onSignOut={() => void signOut()} counts={{ regioes: regions.length }} />
        <main className="app-main">
         <Suspense fallback={<div className="row t-muted" style={{ gap: 8, padding: 28 }}><Loader2 size={16} className="spin" /> Carregando…</div>}>
          {view === 'mapa' && (
            <MapWorkspace
              regions={regions}
              reloadRegions={() => void reloadRegions()}
              activeRegionId={activeRegionId}
              setActiveRegionId={setActiveRegionId}
              focusLatLng={focusLatLng}
              clearFocus={() => setFocusLatLng(null)}
              onGoLeads={() => setView('leads')}
              onReview={setDetailLead}
            />
          )}
          {view === 'regioes' && (
            <RegioesPage
              regions={regions} loading={regionsLoading} error={regionsError} reload={() => void reloadRegions()}
              onOpen={(id) => { setActiveRegionId(id); setView('mapa'); }}
              onScrape={(id) => { setActiveRegionId(id); setView('mapa'); }}
              onNew={() => { setActiveRegionId(null); setView('mapa'); }}
            />
          )}
          {view === 'leads' && <LeadsPage onReview={setDetailLead} leadsVersion={leadsVersion} />}
          {view === 'analise' && <AnalisePage leadsVersion={leadsVersion} />}
          {view === 'config' && <ConfigPage theme={theme} onToggleTheme={toggleTheme} email={email} />}
         </Suspense>
        </main>
        <BottomTabBar view={view} onNavigate={setView} />
      </div>
    );
    if (detailLead) {
      content = (
        <>
          {content}
          <Suspense fallback={null}>
            <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} onChanged={() => setLeadsVersion((v) => v + 1)} onOpenMapa={openLead} />
          </Suspense>
        </>
      );
    }
  }

  return <div className="app-root">{content}</div>;
}
