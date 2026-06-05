import { useEffect, useMemo, useState } from 'react';
import {
  Radar, DownloadCloud, Trash2, Plus, Loader2, AlertCircle, Eye, RotateCcw,
  CalendarClock, Clock, Power, X, Check,
} from 'lucide-react';
import { deleteRegiao } from '../lib/radarRegioes';
import {
  listAgendamentos, criarAgendamento, alternarAgendamento, excluirAgendamento,
  descreveAgendamento, DIAS, type Agendamento,
} from '../lib/radarAgendamentos';
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

function fmtProximo(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function AgendarModal({ regiao, onClose, onSaved }: { regiao: RadarRegiao; onClose: () => void; onSaved: () => void }) {
  const [freq, setFreq] = useState<'diaria' | 'semanal'>('semanal');
  const [dia, setDia] = useState(1); // segunda
  const [hora, setHora] = useState(8);
  const [max, setMax] = useState(50);
  const [busy, setBusy] = useState(false);

  async function salvar() {
    setBusy(true);
    try {
      await criarAgendamento({ regiao_id: regiao.id, frequencia: freq, dia_semana: freq === 'semanal' ? dia : null, hora, max_leads: max });
      onSaved(); onClose();
    } catch (e) { alert(e instanceof Error ? e.message : 'Falha ao agendar.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="scrape-wrap" onClick={onClose}>
      <div className="backdrop" />
      <div className="modal-card lead-modal" style={{ width: 'min(440px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <div className="between">
          <div className="row" style={{ gap: 8 }}><CalendarClock size={18} style={{ color: 'var(--tech-deep)' }} /> <strong style={{ fontSize: 16 }}>Agendar raspagem</strong></div>
          <button className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }} onClick={onClose}><X size={18} /></button>
        </div>
        <div className="t-caption t-muted">{regiao.nome ?? 'Região'} · {regiao.segmento ?? 'comércios'}</div>

        <div className="field">
          <label className="field-label">Frequência</label>
          <div className="seg">
            <button className={`seg-item ${freq === 'diaria' ? 'is-on' : ''}`} onClick={() => setFreq('diaria')}>Todo dia</button>
            <button className={`seg-item ${freq === 'semanal' ? 'is-on' : ''}`} onClick={() => setFreq('semanal')}>Semanal</button>
          </div>
        </div>

        {freq === 'semanal' && (
          <div className="field">
            <label className="field-label">Dia da semana</label>
            <select className="select" value={dia} onChange={(e) => setDia(Number(e.target.value))}>
              {DIAS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}

        <div className="row" style={{ gap: 10 }}>
          <div className="field grow">
            <label className="field-label">Hora</label>
            <select className="select" value={hora} onChange={(e) => setHora(Number(e.target.value))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>
          <div className="field grow">
            <label className="field-label">Quantos leads</label>
            <input className="input" type="number" min={1} max={120} value={max} onChange={(e) => setMax(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
          </div>
        </div>

        <button className="btn btn-primary btn-block" onClick={() => void salvar()} disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Criar agendamento
        </button>
        <div className="t-caption t-faint">A raspagem roda sozinha no horário (fuso de Brasília). Precisa do token do Apify configurado no servidor.</div>
      </div>
    </div>
  );
}

export function RegioesPage({ regions, loading, error, reload, onOpen, onScrape, onNew }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [ags, setAgs] = useState<Agendamento[]>([]);
  const [agBusy, setAgBusy] = useState<string | null>(null);
  const [agendarPara, setAgendarPara] = useState<RadarRegiao | null>(null);

  const nomeRegiao = useMemo(() => {
    const m = new Map(regions.map((r) => [r.id, r.nome ?? 'Sem nome']));
    return (id: string) => m.get(id) ?? 'Região';
  }, [regions]);

  async function reloadAgs() {
    try { setAgs(await listAgendamentos()); } catch { /* ignora */ }
  }
  useEffect(() => { void reloadAgs(); }, []);

  async function excluir(r: RadarRegiao) {
    if (!window.confirm(`Excluir a região "${r.nome ?? 'sem nome'}"? Os leads continuam no CRM.`)) return;
    setBusy(r.id);
    try { await deleteRegiao(r.id); reload(); void reloadAgs(); } catch { /* ignora */ } finally { setBusy(null); }
  }

  async function toggleAg(a: Agendamento) {
    setAgBusy(a.id);
    try { await alternarAgendamento(a.id, !a.ativo); await reloadAgs(); } catch { /* ignora */ } finally { setAgBusy(null); }
  }
  async function excluirAg(a: Agendamento) {
    setAgBusy(a.id);
    try { await excluirAgendamento(a.id); await reloadAgs(); } catch { /* ignora */ } finally { setAgBusy(null); }
  }

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head">
        <div><h1 className="t-h1">Regiões</h1><p>As áreas que você prospecta. Dá pra agendar a raspagem automática.</p></div>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" style={{ width: 38, padding: 0 }} onClick={reload} title="Recarregar"><RotateCcw size={15} /></button>
          <button className="btn btn-primary" onClick={onNew}><Plus size={17} /> Nova região</button>
        </div>
      </div>

      {/* Agendamentos ativos */}
      {ags.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 18 }}>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}><CalendarClock size={16} style={{ color: 'var(--tech-deep)' }} /> <strong style={{ fontSize: 14 }}>Raspagens agendadas</strong></div>
          <div className="col" style={{ gap: 8 }}>
            {ags.map((a) => (
              <div key={a.id} className="row ag-row" style={{ gap: 10 }}>
                <span className="icon-badge" style={{ flexShrink: 0, width: 34, height: 34, opacity: a.ativo ? 1 : 0.4 }}><Clock size={16} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nomeRegiao(a.regiao_id)}</div>
                  <div className="t-caption t-muted">{descreveAgendamento(a)} · {a.max_leads} leads · próxima: {a.ativo ? fmtProximo(a.proximo_run_at) : 'pausada'}</div>
                </div>
                <button className={`btn btn-sm ${a.ativo ? 'btn-soft' : 'btn-secondary'}`} disabled={agBusy === a.id} onClick={() => void toggleAg(a)} title={a.ativo ? 'Pausar' : 'Ativar'}>
                  {agBusy === a.id ? <Loader2 size={14} className="spin" /> : <Power size={14} />} {a.ativo ? 'Ativa' : 'Pausada'}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ width: 34, padding: 0, color: 'var(--error)' }} disabled={agBusy === a.id} onClick={() => void excluirAg(a)} title="Excluir agendamento"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

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
        <div className="cards-auto">
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
              <div className="row" style={{ gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                <button className="btn btn-soft btn-sm grow" onClick={() => onScrape(r.id)}><DownloadCloud size={15} /> Raspar</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setAgendarPara(r)} title="Agendar raspagem"><CalendarClock size={15} /> Agendar</button>
                <button className="btn btn-secondary btn-sm" style={{ width: 36, padding: 0 }} onClick={() => onOpen(r.id)} title="Abrir no mapa"><Eye size={15} /></button>
                <button className="btn btn-ghost btn-sm" style={{ width: 36, padding: 0, color: 'var(--error)' }} disabled={busy === r.id} onClick={() => excluir(r)} title="Excluir">
                  {busy === r.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {agendarPara && <AgendarModal regiao={agendarPara} onClose={() => setAgendarPara(null)} onSaved={() => void reloadAgs()} />}
    </div></div>
  );
}
