import { useEffect, useState } from 'react';
import {
  X, Star, Phone, Globe, AtSign, MapPin, Check, Trash2, RotateCcw,
  MessageCircle, Send, Loader2, Eye, Navigation, Building2, TrendingUp, CheckCircle2, Clock, CalendarClock,
} from 'lucide-react';
import { ScoreBadge } from './ScoreBadge';
import { TONS, gerarMensagem, whatsappLink, type Tom } from '../lib/mensagem';
import { descartarLead, reabrirLead, salvarMensagem, enviarParaCrm, estimarValorCents, VALOR_OPCOES } from '../lib/crm';
import { buscarVizinhos, linkSeguro, type LeadMapa, type Vizinho } from '../lib/leads';

type Props = {
  lead: LeadMapa;
  onClose: () => void;
  onChanged: () => void;
  onOpenMapa: (l: LeadMapa) => void;
};

function statusOf(l: LeadMapa) {
  if (l.etapa === 'perdido') return { label: 'Descartado', cls: 'badge-error' };
  if (l.enviado_crm) return { label: 'No CRM da ORCtech', cls: 'badge-success' };
  return { label: 'A revisar', cls: 'badge-warning' };
}

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function fmtDist(km: number) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function fmtDataHora(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function LeadDetailModal({ lead, onClose, onChanged, onOpenMapa }: Props) {
  const tomInicial = (lead.tom_mensagem as Tom) || 'amigavel';
  const [tom, setTom] = useState<Tom>(tomInicial);
  const [mensagem, setMensagem] = useState(lead.mensagem_whatsapp || gerarMensagem(lead, tomInicial));
  const [busy, setBusy] = useState<string | null>(null);
  const [local, setLocal] = useState(lead);
  const [valorCents, setValorCents] = useState(() => estimarValorCents(lead.score_cor));
  const [vizinhos, setVizinhos] = useState<Vizinho[] | null>(null);

  const status = statusOf(local);
  const temTel = !!(local.whatsapp || local.telefone);
  const podeEnviarCrm = !local.enviado_crm && local.etapa !== 'perdido';

  function trocarTom(t: Tom) { setTom(t); setMensagem(gerarMensagem(lead, t)); }

  // Salva a mensagem ao sair do campo (garante que nada se perca).
  async function salvarRascunho() {
    if (mensagem === lead.mensagem_whatsapp) return;
    try { await salvarMensagem(lead.id, mensagem, tom); } catch { /* silencioso */ }
  }

  async function enviarCrm() {
    setBusy('crm');
    try {
      await enviarParaCrm(lead, { mensagem, tom, valorCents });
      setLocal({ ...local, enviado_crm: true, aprovado: true, etapa: 'a_contatar' });
      onChanged();
    } catch (e) { alert(e instanceof Error ? e.message : 'Falha ao enviar pro CRM.'); }
    finally { setBusy(null); }
  }

  async function acao(tipo: 'descartar' | 'reabrir') {
    setBusy(tipo);
    try {
      if (tipo === 'descartar') { await descartarLead(lead.id); setLocal({ ...local, aprovado: false, etapa: 'perdido' }); }
      else { await reabrirLead(lead.id); setLocal({ ...local, aprovado: false, enviado_crm: false, etapa: 'triagem' }); }
      onChanged();
    } catch (e) { alert(e instanceof Error ? e.message : 'Falha na ação.'); }
    finally { setBusy(null); }
  }

  async function enviarWhats() {
    const link = whatsappLink(local.whatsapp || local.telefone, mensagem);
    if (!link) { alert('Esse lead não tem telefone.'); return; }
    try { await salvarMensagem(lead.id, mensagem, tom); onChanged(); } catch { /* segue mesmo assim */ }
    window.open(link, '_blank', 'noopener');
  }

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // Busca as oficinas mais próximas (pra usar na abordagem).
  useEffect(() => {
    let alive = true;
    setVizinhos(null);
    buscarVizinhos(lead, 2).then((v) => { if (alive) setVizinhos(v); }).catch(() => { if (alive) setVizinhos([]); });
    return () => { alive = false; };
  }, [lead]);

  return (
    <div className="scrape-wrap" onClick={onClose}>
      <div className="backdrop" />
      <div className="modal-card lead-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lead-modal-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className={`badge ${status.cls}`}><span className="dot" /> {status.label}</span>
              <ScoreBadge lead={local} />
            </div>
            <div className="t-h2" style={{ fontSize: 21, marginTop: 8, lineHeight: 1.2 }}>{local.nome_empresa}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        {/* Info principal */}
        <div className="lead-modal-info">
          {local.nota_media != null && (
            <div className="row" style={{ gap: 6 }}>
              <Star size={14} fill="#F59E0B" color="#F59E0B" /> <strong className="tnum">{local.nota_media}</strong>
              <span className="t-muted">· {local.num_avaliacoes} avaliações</span>
            </div>
          )}
          {local.telefone && <div className="row" style={{ gap: 6 }}><Phone size={14} /> <span className="tnum">{local.telefone}</span></div>}
          {local.endereco && <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}><MapPin size={14} style={{ marginTop: 2, flexShrink: 0 }} /> <span className="t-muted">{local.endereco}</span></div>}
          {local.horario_funcionamento && (
            <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
              <Clock size={14} style={{ marginTop: 2, flexShrink: 0 }} />
              <span className="t-muted" style={{ whiteSpace: 'pre-line', fontSize: 12.5, lineHeight: 1.5 }}>{local.horario_funcionamento}</span>
            </div>
          )}
          {fmtDataHora(local.created_at) && (
            <div className="row t-faint" style={{ gap: 6, fontSize: 12 }}><CalendarClock size={13} /> Raspado em {fmtDataHora(local.created_at)}</div>
          )}
          <div className="row-wrap" style={{ gap: 6 }}>
            {local.segmento && <span className="badge badge-neutral">{local.segmento}</span>}
            {local.regiao && <span className="badge badge-outline">{local.regiao}</span>}
          </div>

          {/* Links (Maps / Instagram / Site / Ver no mapa) */}
          <div className="lead-links">
            {linkSeguro(local.link_maps) && (
              <a className="lead-linkbtn" href={linkSeguro(local.link_maps)} target="_blank" rel="noreferrer"><MapPin size={14} /> Google Maps</a>
            )}
            {linkSeguro(local.instagram) && (
              <a className="lead-linkbtn is-insta" href={linkSeguro(local.instagram)} target="_blank" rel="noreferrer"><AtSign size={14} /> Instagram</a>
            )}
            {linkSeguro(local.site_url) && (
              <a className="lead-linkbtn" href={linkSeguro(local.site_url)} target="_blank" rel="noreferrer"><Globe size={14} /> Site</a>
            )}
            <button className="lead-linkbtn" onClick={() => { onClose(); onOpenMapa(local); }}><Eye size={14} /> Ver no mapa</button>
          </div>
        </div>

        {/* Oficinas próximas (pra abordagem) */}
        <div className="lead-viz">
          <div className="lead-section-label"><Navigation size={14} /> Oficinas mais próximas</div>
          {vizinhos === null ? (
            <div className="row t-faint" style={{ gap: 6, fontSize: 12.5 }}><Loader2 size={13} className="spin" /> Buscando vizinhas…</div>
          ) : vizinhos.length === 0 ? (
            <div className="t-faint" style={{ fontSize: 12.5 }}>Sem outras oficinas com localização por perto.</div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              {vizinhos.map((v) => (
                <div key={v.id} className="viz-card">
                  <div className="viz-icon"><Building2 size={15} /></div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="viz-name">{v.nome_empresa}</div>
                    <div className="viz-meta">
                      {v.nota_media != null && <span className="row" style={{ gap: 3 }}><Star size={11} fill="#F59E0B" color="#F59E0B" /> {v.nota_media} <span className="t-faint">({v.num_avaliacoes})</span></span>}
                      <span className="viz-dist"><Navigation size={11} /> {fmtDist(v.distanciaKm)}</span>
                    </div>
                  </div>
                  {linkSeguro(v.link_maps) && <a className="viz-go" href={linkSeguro(v.link_maps)} target="_blank" rel="noreferrer" title="Ver no Maps"><MapPin size={14} /></a>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Mensagem de WhatsApp */}
        <div className="col" style={{ gap: 10 }}>
          <div className="lead-section-label"><MessageCircle size={15} style={{ color: '#00A058' }} /> Mensagem de WhatsApp</div>
          <div className="seg">{TONS.map((t) => <button key={t.id} className={`seg-item ${tom === t.id ? 'is-on' : ''}`} onClick={() => trocarTom(t.id)}>{t.label}</button>)}</div>
          <textarea
            className="textarea" value={mensagem}
            onChange={(e) => setMensagem(e.target.value)} onBlur={() => void salvarRascunho()}
            rows={7} style={{ minHeight: 148 }}
          />
          <button className="btn btn-secondary btn-block" onClick={() => void enviarWhats()} disabled={!temTel}><Send size={16} /> Enviar no WhatsApp</button>
          {!temTel && <div className="t-caption t-faint">Esse lead não trouxe telefone.</div>}
        </div>

        <div className="divider" />

        {/* Ações de funil / CRM */}
        {local.enviado_crm ? (
          <div className="crm-done">
            <CheckCircle2 size={18} />
            <div className="grow">
              <strong>No CRM da ORCtech</strong>
              <div className="t-caption t-muted">Entrou no funil em “A contatar” · {fmtBRL(valorCents)}/mês</div>
            </div>
            <button className="btn btn-ghost btn-sm" disabled={busy != null} onClick={() => void acao('reabrir')}>
              {busy === 'reabrir' ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />} Voltar
            </button>
          </div>
        ) : local.etapa === 'perdido' ? (
          <button className="btn btn-secondary btn-block" disabled={busy != null} onClick={() => void acao('reabrir')}>
            {busy === 'reabrir' ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />} Voltar pra triagem
          </button>
        ) : (
          <div className="col" style={{ gap: 10 }}>
            <div className="crm-value">
              <span className="lead-section-label" style={{ marginBottom: 0 }}><TrendingUp size={14} /> Valor estimado (MRR)</span>
              <div className="seg crm-value-seg">
                {VALOR_OPCOES.map((o) => (
                  <button key={o.cents} className={`seg-item ${valorCents === o.cents ? 'is-on' : ''}`} onClick={() => setValorCents(o.cents)}>{o.label}</button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy != null || !podeEnviarCrm} onClick={() => void enviarCrm()}>
              {busy === 'crm' ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Enviar para o CRM da ORCtech
            </button>
            <button className="btn btn-ghost btn-sm btn-block" disabled={busy != null} onClick={() => void acao('descartar')} style={{ color: 'var(--error)' }}>
              {busy === 'descartar' ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Descartar lead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
