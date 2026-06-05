import { useState } from 'react';
import { Radar, DownloadCloud, Trash2, Plus, Loader2, AlertCircle, Eye, RotateCcw } from 'lucide-react';
import { deleteRegiao } from '../lib/radarRegioes';
import type { RadarRegiao } from '../types/database';

type Props = {
  regions: RadarRegiao[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  onOpen: (id: string) => void;
  onScrape: (id: string) => void;
  onNew: () => void;
};

export function RegioesPage({ regions, loading, error, reload, onOpen, onScrape, onNew }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  async function excluir(r: RadarRegiao) {
    if (!window.confirm(`Excluir a região "${r.nome ?? 'sem nome'}"? Os leads continuam no CRM.`)) return;
    setBusy(r.id);
    try { await deleteRegiao(r.id); reload(); } catch { /* ignora */ } finally { setBusy(null); }
  }

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head">
        <div><h1 className="t-h1">Regiões</h1><p>As áreas que você prospecta.</p></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ width: 38, padding: 0 }} onClick={reload} title="Recarregar"><RotateCcw size={15} /></button>
          <button className="btn btn-primary" onClick={onNew}><Plus size={17} /> Nova região</button>
        </div>
      </div>

      {loading ? (
        <div className="row t-muted" style={{ gap: 8 }}><Loader2 size={16} className="spin" /> Carregando…</div>
      ) : error ? (
        <div className="row" style={{ gap: 8, color: 'var(--error)' }}><AlertCircle size={16} /> {error}</div>
      ) : regions.length === 0 ? (
        <div className="card empty-state">
          <Radar size={42} style={{ color: 'var(--tech)' }} />
          <div className="t-h3">Nenhuma região ainda</div>
          <div className="t-muted" style={{ maxWidth: 360 }}>Desenhe a primeira área no mapa pra começar a prospectar.</div>
          <button className="btn btn-primary" onClick={onNew}><Plus size={16} /> Desenhar no mapa</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {regions.map((r) => (
            <div key={r.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="row" style={{ gap: 10 }}>
                <span className="icon-badge"><Radar size={18} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-h3" style={{ fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome ?? 'Sem nome'}</div>
                  <div className="t-caption t-muted"><span className="tnum">{Number(r.raio_km)} km</span>{r.segmento ? ` · ${r.segmento}` : ''}</div>
                </div>
              </div>
              <span className={`badge ${r.leads_encontrados > 0 ? 'badge-success' : 'badge-warning'}`} style={{ alignSelf: 'flex-start' }}>
                {r.leads_encontrados > 0 ? `${r.leads_encontrados} leads` : 'nunca raspada'}
              </span>
              <div className="row" style={{ gap: 8, marginTop: 'auto' }}>
                <button className="btn btn-soft btn-sm grow" onClick={() => onScrape(r.id)}><DownloadCloud size={15} /> Raspar</button>
                <button className="btn btn-secondary btn-sm" style={{ width: 36, padding: 0 }} onClick={() => onOpen(r.id)} title="Abrir no mapa"><Eye size={15} /></button>
                <button className="btn btn-ghost btn-sm" style={{ width: 36, padding: 0, color: 'var(--error)' }} disabled={busy === r.id} onClick={() => excluir(r)} title="Excluir">
                  {busy === r.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
}
