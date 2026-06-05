import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Target, Star, Phone, Globe, MapPin } from 'lucide-react';
import { listAllLeads, type LeadMapa } from '../lib/leads';
import { ScoreBadge } from '../components/ScoreBadge';
import { calcularScore } from '../lib/score';

const COR: Record<string, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };
const FILTROS = [
  { k: 'todos', label: 'Todos' }, { k: 'verde', label: 'Verde' }, { k: 'amarelo', label: 'Amarelo' }, { k: 'vermelho', label: 'Vermelho' },
];
const STATUS = [
  { k: 'todos', label: 'Todos' }, { k: 'revisar', label: 'A revisar' }, { k: 'aprovados', label: 'Aprovados' }, { k: 'descartados', label: 'Descartados' },
];

function statusMatch(l: LeadMapa, k: string) {
  if (k === 'revisar') return !l.aprovado && l.etapa !== 'perdido';
  if (k === 'aprovados') return l.aprovado;
  if (k === 'descartados') return l.etapa === 'perdido';
  return true;
}
function statusBadge(l: LeadMapa) {
  if (l.etapa === 'perdido') return <span className="badge badge-error">descartado</span>;
  if (l.aprovado) return <span className="badge badge-success">aprovado</span>;
  return null;
}

type Props = { onReview: (lead: LeadMapa) => void; leadsVersion: number };

export function LeadsPage({ onReview, leadsVersion }: Props) {
  const [leads, setLeads] = useState<LeadMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cor, setCor] = useState('todos');
  const [reg, setReg] = useState('todas');
  const [stat, setStat] = useState('todos');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try { const l = await listAllLeads(); if (alive) setLeads(l); }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Falha ao carregar leads.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [leadsVersion]);

  const regioes = useMemo(() => Array.from(new Set(leads.map((l) => l.regiao).filter(Boolean))) as string[], [leads]);
  const enriched = useMemo(
    () => leads.map((l) => ({ l, sc: calcularScore(l) })).sort((a, b) => b.sc.score - a.sc.score),
    [leads],
  );
  const filtered = useMemo(
    () => enriched.filter(({ l, sc }) => (cor === 'todos' || sc.cor === cor) && (reg === 'todas' || l.regiao === reg) && statusMatch(l, stat)),
    [enriched, cor, reg, stat],
  );
  const contagem = useMemo(() => {
    const c = { verde: 0, amarelo: 0, vermelho: 0 } as Record<string, number>;
    for (const { sc } of enriched) c[sc.cor]++;
    return c;
  }, [enriched]);

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head">
        <div><h1 className="t-h1">Leads</h1><p>Revise, aprove e mande o WhatsApp. Clique num lead pra abrir.</p></div>
        <div className="row" style={{ gap: 6 }}>
          <span className="badge badge-success"><span className="dot" /> {contagem.verde}</span>
          <span className="badge badge-warning"><span className="dot" /> {contagem.amarelo}</span>
          <span className="badge badge-error"><span className="dot" /> {contagem.vermelho}</span>
        </div>
      </div>

      <div className="col" style={{ gap: 10, marginBottom: 18 }}>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="seg" style={{ width: 'auto' }}>
            {FILTROS.map((f) => (
              <button key={f.k} className={`seg-item ${cor === f.k ? 'is-on' : ''}`} onClick={() => setCor(f.k)} style={{ flex: '0 0 auto', padding: '0 12px' }}>
                {f.k !== 'todos' && <span className="score-dot" style={{ background: COR[f.k] }} />} {f.label}
              </button>
            ))}
          </div>
          <select className="select" style={{ width: 'auto', minWidth: 170 }} value={reg} onChange={(e) => setReg(e.target.value)}>
            <option value="todas">Todas as regiões</option>
            {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <span className="t-caption t-muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>{filtered.length} de {leads.length}</span>
        </div>
        <div className="seg" style={{ width: 'auto', alignSelf: 'flex-start' }}>
          {STATUS.map((s) => <button key={s.k} className={`seg-item ${stat === s.k ? 'is-on' : ''}`} onClick={() => setStat(s.k)} style={{ flex: '0 0 auto', padding: '0 12px' }}>{s.label}</button>)}
        </div>
      </div>

      {loading ? (
        <div className="row t-muted" style={{ gap: 8 }}><Loader2 size={16} className="spin" /> Carregando leads…</div>
      ) : error ? (
        <div className="row" style={{ gap: 8, color: 'var(--error)' }}><AlertCircle size={16} /> {error}</div>
      ) : leads.length === 0 ? (
        <div className="card empty-state">
          <Target size={42} style={{ color: 'var(--tech)' }} />
          <div className="t-h3">Nenhum lead ainda</div>
          <div className="t-muted" style={{ maxWidth: 380 }}>Raspe uma região no mapa pra encontrar oficinas e comércios.</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state"><div className="t-h3">Nada com esse filtro</div><div className="t-muted">Tente outra cor, status ou região.</div></div>
      ) : (
        <div className="leads-grid">
          {filtered.map(({ l, sc }) => (
            <div key={l.id} className={`lead-card s-${sc.cor}`} role="button" tabIndex={0} onClick={() => onReview(l)}
              onKeyDown={(e) => { if (e.key === 'Enter') onReview(l); }}>
              <div className="between" style={{ alignItems: 'flex-start', gap: 8 }}>
                <div className="lead-card-name">{l.nome_empresa}</div>
                <ScoreBadge lead={l} />
              </div>
              <div className="lead-card-meta">
                {l.nota_media != null ? (
                  <span className="row" style={{ gap: 5 }}><Star size={13} fill="#F59E0B" color="#F59E0B" /> <span className="tnum" style={{ fontWeight: 600, color: 'var(--text)' }}>{l.nota_media}</span> <span className="t-faint">· {l.num_avaliacoes} avaliações</span></span>
                ) : <span className="t-faint">sem avaliações</span>}
                {l.telefone && <span className="row" style={{ gap: 5 }}><Phone size={13} /> <span className="tnum">{l.telefone}</span></span>}
              </div>
              <div className="row-wrap" style={{ gap: 6 }}>
                {statusBadge(l)}
                {l.segmento && <span className="badge badge-neutral">{l.segmento}</span>}
                {l.tem_site && <span className="badge badge-outline"><Globe size={11} /> site</span>}
                {l.regiao && <span className="badge badge-outline"><MapPin size={11} /> {l.regiao}</span>}
              </div>
              <div className="lead-card-foot">
                {l.link_maps ? (
                  <a className="lead-card-maps" href={l.link_maps} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}><Globe size={13} /> Google Maps</a>
                ) : <span />}
                <span className="lead-card-open">Revisar →</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
}
