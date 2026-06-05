import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Target, Star, Check, Minus, MapPin } from 'lucide-react';
import { listAllLeads, type LeadMapa } from '../lib/leads';

const COR: Record<string, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };
const FILTROS = [
  { k: 'todos', label: 'Todos' },
  { k: 'verde', label: 'Verde' },
  { k: 'amarelo', label: 'Amarelo' },
  { k: 'vermelho', label: 'Vermelho' },
];

type Props = { onOpenLead: (lead: LeadMapa) => void };

export function LeadsPage({ onOpenLead }: Props) {
  const [leads, setLeads] = useState<LeadMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cor, setCor] = useState('todos');
  const [reg, setReg] = useState('todas');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try { const l = await listAllLeads(); if (alive) setLeads(l); }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Falha ao carregar leads.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const regioes = useMemo(() => Array.from(new Set(leads.map((l) => l.regiao).filter(Boolean))) as string[], [leads]);
  const filtered = useMemo(
    () => leads.filter((l) => (cor === 'todos' || l.score_cor === cor) && (reg === 'todas' || l.regiao === reg)),
    [leads, cor, reg],
  );

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head">
        <div><h1 className="t-h1">Leads</h1><p>Os estabelecimentos que o radar encontrou.</p></div>
        <span className="badge badge-neutral">{filtered.length} de {leads.length}</span>
      </div>

      <div className="row" style={{ gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div className="seg" style={{ width: 'auto' }}>
          {FILTROS.map((f) => (
            <button key={f.k} className={`seg-item ${cor === f.k ? 'is-on' : ''}`} onClick={() => setCor(f.k)} style={{ flex: '0 0 auto', padding: '0 14px' }}>
              {f.k !== 'todos' && <span className="score-dot" style={{ background: COR[f.k] }} />} {f.label}
            </button>
          ))}
        </div>
        <select className="select" style={{ width: 'auto', minWidth: 180 }} value={reg} onChange={(e) => setReg(e.target.value)}>
          <option value="todas">Todas as regiões</option>
          {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
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
        <div className="card empty-state"><div className="t-h3">Nada com esse filtro</div><div className="t-muted">Tente outra cor ou região.</div></div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="leads-table">
            <thead>
              <tr>
                <th>Empresa</th><th>Score</th><th>Nota</th><th className="tbl-hide-md">Telefone</th>
                <th className="tbl-hide-md">Site</th><th className="tbl-hide-md">Região</th><th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} onClick={() => onOpenLead(l)}>
                  <td style={{ fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome_empresa}</td>
                  <td><span className={`badge badge-${l.score_cor}`}><span className="dot" />{l.score_cor}</span></td>
                  <td className="tnum">{l.nota_media != null ? <span className="row" style={{ gap: 4 }}><Star size={12} fill="#F59E0B" color="#F59E0B" /> {l.nota_media} <span className="t-faint">({l.num_avaliacoes})</span></span> : '—'}</td>
                  <td className="tbl-hide-md tnum">{l.telefone ?? '—'}</td>
                  <td className="tbl-hide-md">{l.tem_site ? <Check size={15} color="#00A058" /> : <Minus size={15} color="#A1A1AA" />}</td>
                  <td className="tbl-hide-md t-muted" style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.regiao ?? '—'}</td>
                  <td><span className="row" style={{ gap: 4, color: 'var(--tech-deep)', fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}><MapPin size={13} /> Ver</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div></div>
  );
}
