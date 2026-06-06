import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, Target, Star, Phone, Globe, MapPin, AtSign, Check, CheckCheck, Send, X, Download, Search, CalendarClock } from 'lucide-react';
import { listAllLeads, linkSeguro, type LeadMapa } from '../lib/leads';
import { enviarLoteParaCrm } from '../lib/crm';
import { leadsParaCsv, baixarCsv } from '../lib/csv';
import { ScoreBadge } from '../components/ScoreBadge';
import { calcularScore } from '../lib/score';

const COR: Record<string, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };
const FILTROS = [
  { k: 'todos', label: 'Todos' }, { k: 'verde', label: 'Verde' }, { k: 'amarelo', label: 'Amarelo' }, { k: 'vermelho', label: 'Vermelho' },
];
const STATUS = [
  { k: 'todos', label: 'Todos' }, { k: 'revisar', label: 'A revisar' }, { k: 'aprovados', label: 'No CRM' }, { k: 'descartados', label: 'Descartados' },
];

function statusMatch(l: LeadMapa, k: string) {
  if (k === 'revisar') return !l.enviado_crm && l.etapa !== 'perdido';
  if (k === 'aprovados') return l.enviado_crm;
  if (k === 'descartados') return l.etapa === 'perdido';
  return true;
}
function statusBadge(l: LeadMapa) {
  if (l.etapa === 'perdido') return <span className="badge badge-error">descartado</span>;
  if (l.enviado_crm) return <span className="badge badge-success">no CRM</span>;
  return null;
}
/** Pode ser enviado pro CRM (ainda não foi e não está descartado). */
const enviavel = (l: LeadMapa) => !l.enviado_crm && l.etapa !== 'perdido';

function fmtRaspado(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

type Props = { onReview: (lead: LeadMapa) => void; leadsVersion: number };

export function LeadsPage({ onReview, leadsVersion }: Props) {
  const [leads, setLeads] = useState<LeadMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cor, setCor] = useState('todos');
  const [reg, setReg] = useState('todas');
  const [stat, setStat] = useState('todos');
  const [busca, setBusca] = useState('');

  const [selMode, setSelMode] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLeads(await listAllLeads()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar leads.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load, leadsVersion]);

  const regioes = useMemo(() => Array.from(new Set(leads.map((l) => l.regiao).filter(Boolean))) as string[], [leads]);
  const enriched = useMemo(
    () => leads.map((l) => ({ l, sc: calcularScore(l) })).sort((a, b) => b.sc.score - a.sc.score),
    [leads],
  );
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const bate = (l: LeadMapa) => !q || [l.nome_empresa, l.telefone, l.whatsapp, l.endereco, l.segmento, l.regiao, l.cidade]
      .some((v) => (v ?? '').toLowerCase().includes(q));
    return enriched.filter(({ l, sc }) =>
      (cor === 'todos' || sc.cor === cor) && (reg === 'todas' || l.regiao === reg) && statusMatch(l, stat) && bate(l));
  }, [enriched, cor, reg, stat, busca]);
  const contagem = useMemo(() => {
    const c = { verde: 0, amarelo: 0, vermelho: 0 } as Record<string, number>;
    for (const { sc } of enriched) c[sc.cor]++;
    return c;
  }, [enriched]);

  const selecionaveis = useMemo(() => filtered.filter(({ l }) => enviavel(l)).map(({ l }) => l), [filtered]);

  function toggleSel(id: string) {
    setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selecionarTodos() { setSel(new Set(selecionaveis.map((l) => l.id))); }
  function limparSel() { setSel(new Set()); }
  function sairSelecao() { setSelMode(false); setSel(new Set()); }

  async function enviarSelecionados() {
    const alvo = leads.filter((l) => sel.has(l.id) && enviavel(l));
    if (alvo.length === 0) return;
    if (!window.confirm(`Enviar ${alvo.length} ${alvo.length === 1 ? 'lead' : 'leads'} pro CRM da ORCtech com todas as informações?`)) return;
    setBulkBusy(true);
    try {
      const { enviados, falhas } = await enviarLoteParaCrm(alvo);
      await load();
      sairSelecao();
      if (falhas > 0) alert(`${enviados} enviados. ${falhas} falharam — tente esses de novo.`);
    } catch (e) { alert(e instanceof Error ? e.message : 'Falha no envio em lote.'); }
    finally { setBulkBusy(false); }
  }

  function clickCard(l: LeadMapa) {
    if (selMode) { if (enviavel(l)) toggleSel(l.id); }
    else onReview(l);
  }

  function exportarCsv() {
    const lista = filtered.map(({ l }) => l);
    if (lista.length === 0) return;
    const hoje = new Date().toISOString().slice(0, 10);
    baixarCsv(`leads-orcradar-${hoje}.csv`, leadsParaCsv(lista));
  }

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head">
        <div><h1 className="t-h1">Leads</h1><p>Revise, aprove e mande o WhatsApp. Clique num lead pra abrir.</p></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="row" style={{ gap: 6 }}>
            <span className="badge badge-success"><span className="dot" /> {contagem.verde}</span>
            <span className="badge badge-warning"><span className="dot" /> {contagem.amarelo}</span>
            <span className="badge badge-error"><span className="dot" /> {contagem.vermelho}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={exportarCsv} disabled={filtered.length === 0} title="Baixar CSV (abre no Excel)">
            <Download size={15} /> CSV
          </button>
          <button className={`btn btn-sm ${selMode ? 'btn-primary' : 'btn-secondary'}`} onClick={() => (selMode ? sairSelecao() : setSelMode(true))}>
            <CheckCheck size={15} /> {selMode ? 'Sair da seleção' : 'Selecionar pro CRM'}
          </button>
        </div>
      </div>

      <div className="col" style={{ gap: 10, marginBottom: 18 }}>
        <div className="input-icon-wrap">
          <span className="input-icon"><Search size={16} /></span>
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, telefone, endereço, segmento…" />
          {busca && <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 28, height: 28, padding: 0 }} onClick={() => setBusca('')}><X size={14} /></button>}
        </div>
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
          {filtered.map(({ l, sc }) => {
            const checked = sel.has(l.id);
            const podeSel = enviavel(l);
            return (
              <div key={l.id} className={`lead-card s-${sc.cor} ${selMode && podeSel ? 'is-selmode' : ''}`} role="button" tabIndex={0}
                onClick={() => clickCard(l)} onKeyDown={(e) => { if (e.key === 'Enter') clickCard(l); }}>
                {selMode && podeSel && (
                  <span className={`lead-check ${checked ? 'is-on' : ''}`} onClick={(e) => { e.stopPropagation(); toggleSel(l.id); }}>
                    {checked && <Check size={14} strokeWidth={3} />}
                  </span>
                )}
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
                  {l.regiao && <span className="badge badge-outline"><MapPin size={11} /> {l.regiao}</span>}
                </div>
                {fmtRaspado(l.created_at) && (
                  <div className="row t-faint" style={{ gap: 5, fontSize: 11.5 }}><CalendarClock size={12} /> Raspado em {fmtRaspado(l.created_at)}</div>
                )}
                <div className="lead-card-foot">
                  <div className="row" style={{ gap: 10 }} onClick={(e) => e.stopPropagation()}>
                    {linkSeguro(l.link_maps) && <a className="lead-card-maps" href={linkSeguro(l.link_maps)} target="_blank" rel="noreferrer" title="Google Maps"><MapPin size={14} /></a>}
                    {linkSeguro(l.instagram) && <a className="lead-card-maps" href={linkSeguro(l.instagram)} target="_blank" rel="noreferrer" title="Instagram" style={{ color: '#C13584' }}><AtSign size={14} /></a>}
                    {linkSeguro(l.site_url) && <a className="lead-card-maps" href={linkSeguro(l.site_url)} target="_blank" rel="noreferrer" title="Site"><Globe size={14} /></a>}
                  </div>
                  <span className="lead-card-open">{selMode ? (podeSel ? (checked ? 'Selecionado' : 'Selecionar') : 'já no CRM') : 'Revisar →'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selMode && (
        <div className="bulk-bar">
          <span className="bulk-count">{sel.size} {sel.size === 1 ? 'selecionado' : 'selecionados'}</span>
          <button className="btn btn-ghost btn-sm" onClick={selecionarTodos} disabled={selecionaveis.length === 0}>Selecionar todos ({selecionaveis.length})</button>
          {sel.size > 0 && <button className="btn btn-ghost btn-sm" onClick={limparSel}><X size={14} /> Limpar</button>}
          <span className="grow" />
          <button className="btn btn-primary" onClick={() => void enviarSelecionados()} disabled={sel.size === 0 || bulkBusy}>
            {bulkBusy ? <Loader2 size={16} className="spin" /> : <Send size={16} />} Enviar {sel.size > 0 ? sel.size : ''} pro CRM
          </button>
        </div>
      )}
    </div></div>
  );
}
