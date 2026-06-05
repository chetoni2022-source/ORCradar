import { useEffect, useState } from 'react';
import {
  MapPin, Radar, Sparkles, CheckCircle2, MessageCircle, Database,
  ShieldCheck, Loader2, ArrowRight,
} from 'lucide-react';
import { Logo } from '../components/Logo';
import { RadarMark } from '../components/RadarMark';
import { env } from '../lib/env';
import { checkSupabaseConnection, type ConnectionStatus } from '../lib/supabase';

type HomePageProps = {
  onOpenMapa?: () => void;
};

const FLUXO = [
  { icon: MapPin, title: 'Desenhe o raio no mapa', desc: 'Você marca uma região e o raio de cobertura sobre o mapa.', feito: true },
  { icon: Radar, title: 'Raspagem dos leads', desc: 'O ORCradar coleta oficinas e prestadores da região via Apify.', feito: false },
  { icon: Sparkles, title: 'Score por cor', desc: 'A IA pontua cada lead em verde, amarelo ou vermelho conforme o potencial.', feito: false },
  { icon: CheckCircle2, title: 'Você revisa e aprova', desc: 'Só os leads aprovados por você seguem adiante no funil.', feito: false },
  { icon: MessageCircle, title: 'Vai pro CRM', desc: 'Com uma mensagem de WhatsApp já pronta pra abordar o lead.', feito: false },
];

const TABELAS = [
  {
    icon: Database, nome: 'crm_leads', title: 'Leads de prospecção',
    desc: 'Empresas raspadas, score por cor, etapa do funil e mensagem gerada pela IA.',
    badge: { label: 'compartilhada com o ORCtech', cls: 'badge-neutral' },
  },
  {
    icon: Radar, nome: 'radar_regioes', title: 'Regiões prospectadas',
    desc: 'Centro, raio e contadores de leads de cada região desenhada no mapa.',
    badge: { label: 'exclusiva do ORCradar', cls: 'badge-success' },
  },
];

export function HomePage({ onOpenMapa }: HomePageProps) {
  const [conn, setConn] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    let alive = true;
    checkSupabaseConnection().then((s) => { if (alive) setConn(s); });
    return () => { alive = false; };
  }, []);

  const maskedUrl = env.VITE_SUPABASE_URL.replace(/^https?:\/\//, '') || '—';

  return (
    <>
      <div className="brand-blobs" aria-hidden />
      <main className="page" style={{ position: 'relative', zIndex: 1, paddingTop: 36, paddingBottom: 56 }}>
        {/* Hero ------------------------------------------------------------ */}
        <section className="col" style={{ alignItems: 'center', textAlign: 'center', gap: 16, marginBottom: 40 }}>
          <RadarMark size={88} />
          <span className="chip" style={{ marginTop: 6 }}>
            <Radar size={13} /> Ferramenta interna de prospecção
          </span>
          <Logo size={50} style={{ marginTop: 2 }} />
          <p className="t-body-l t-muted" style={{ maxWidth: 560, margin: 0 }}>
            Desenhe um raio no mapa, deixe a IA pontuar cada lead por cor, revise,
            aprove e mande pro CRM com a mensagem de WhatsApp já pronta.
          </p>
          {onOpenMapa && (
            <button className="btn btn-primary btn-lg" style={{ marginTop: 6 }} onClick={onOpenMapa}>
              <MapPin size={18} /> Abrir o mapa <ArrowRight size={16} />
            </button>
          )}
        </section>

        {/* Stats ----------------------------------------------------------- */}
        <section className="grid-auto-3" style={{ marginBottom: 36 }}>
          <div className="card stat">
            <div className="stat-label">Fase atual</div>
            <div className="stat-value">1</div>
            <div className="stat-hint">Mapa e regiões</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Tabelas gerenciadas</div>
            <div className="stat-value">2</div>
            <div className="stat-hint">crm_leads · radar_regioes</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Banco de dados</div>
            <div className="stat-value" style={{ fontSize: 22 }}>Supabase</div>
            <div className="stat-hint">o mesmo do ORCtech</div>
          </div>
        </section>

        {/* Conexão --------------------------------------------------------- */}
        <section className="card card-elev" style={{ marginBottom: 36 }}>
          <div className="between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="icon-badge"><Database size={20} /></span>
              <div>
                <div className="t-h3">Conexão com o Supabase</div>
                <div className="t-caption t-muted" style={{ marginTop: 2 }}>
                  {conn === null ? (
                    <span className="row" style={{ gap: 6 }}><Loader2 size={13} className="spin" /> Verificando o projeto…</span>
                  ) : conn.ok ? `Tudo certo — ${conn.detail}.` : `Falhou — ${conn.detail}.`}
                </div>
              </div>
            </div>
            <div className="col" style={{ gap: 6, alignItems: 'flex-end' }}>
              <span className={`badge ${conn?.ok ? 'badge-success' : conn ? 'badge-error' : 'badge-warning'}`}>
                <span className="dot" />
                {conn === null ? 'checando' : conn.ok ? 'online' : 'offline'}
              </span>
              <span className="badge badge-outline">{env.VITE_APP_ENV}</span>
            </div>
          </div>
          <div className="divider" style={{ margin: '16px 0' }} />
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="t-caption t-faint">projeto</span>
            <span className="mono-code">{maskedUrl}</span>
          </div>
        </section>

        {/* Como funciona --------------------------------------------------- */}
        <section style={{ marginBottom: 36 }}>
          <div className="col" style={{ gap: 4, marginBottom: 16 }}>
            <div className="t-h2">Como funciona</div>
            <div className="t-body t-muted">O fluxo completo da prospecção. A etapa do mapa já está ativa.</div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            {FLUXO.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="card card-hover row" style={{ gap: 14, alignItems: 'flex-start' }}>
                  <span className="step-num">{i + 1}</span>
                  <span className="icon-badge" style={{ width: 36, height: 36, borderRadius: 10 }}>
                    <Icon size={18} />
                  </span>
                  <div className="grow">
                    <div className="row" style={{ gap: 8 }}>
                      <div className="t-h3" style={{ fontSize: 15 }}>{step.title}</div>
                      <span className={`badge ${step.feito ? 'badge-success' : 'badge-neutral'}`} style={{ height: 20, fontSize: 11 }}>
                        {step.feito ? 'ativo' : 'em breve'}
                      </span>
                    </div>
                    <div className="t-caption t-muted" style={{ marginTop: 2 }}>{step.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tabelas --------------------------------------------------------- */}
        <section style={{ marginBottom: 36 }}>
          <div className="col" style={{ gap: 4, marginBottom: 16 }}>
            <div className="t-h2">Escopo do ORCradar</div>
            <div className="t-body t-muted">As duas únicas tabelas que o ORCradar gerencia no banco.</div>
          </div>
          <div className="grid-auto-2">
            {TABELAS.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.nome} className="card card-hover">
                  <div className="between" style={{ marginBottom: 12 }}>
                    <span className="icon-badge"><Icon size={20} /></span>
                    <span className={`badge ${t.badge.cls}`}>{t.badge.label}</span>
                  </div>
                  <div className="mono-code" style={{ color: 'var(--tech-deep)', marginBottom: 6 }}>{t.nome}</div>
                  <div className="t-h3" style={{ fontSize: 15 }}>{t.title}</div>
                  <div className="t-caption t-muted" style={{ marginTop: 4 }}>{t.desc}</div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Aviso de segurança ---------------------------------------------- */}
        <section className="card card-soft row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <span className="icon-badge" style={{ background: 'var(--tech-soft)' }}><ShieldCheck size={20} /></span>
          <div className="grow">
            <div className="t-h3" style={{ fontSize: 15 }}>Mesmo banco, escopo isolado</div>
            <div className="t-caption t-muted" style={{ marginTop: 4 }}>
              O ORCradar usa o mesmo Supabase do ORCtech, mas só toca em{' '}
              <span className="mono-code">crm_leads</span> e <span className="mono-code">radar_regioes</span>.
              Nunca altera orçamentos, clientes, serviços ou qualquer outra tabela do produto.
            </div>
          </div>
        </section>

        <footer className="t-caption t-faint" style={{ textAlign: 'center', marginTop: 40 }}>
          ORCradar · Fase 1 — mapa e regiões de prospecção
        </footer>
      </main>
    </>
  );
}
