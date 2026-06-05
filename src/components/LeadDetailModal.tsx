import { useEffect, useState } from 'react';
import { X, Star, Phone, MapPin, Globe, Check, Trash2, RotateCcw, MessageCircle, Send, Loader2, Eye } from 'lucide-react';
import { ScoreBadge } from './ScoreBadge';
import { TONS, gerarMensagem, whatsappLink, type Tom } from '../lib/mensagem';
import { aprovarLead, descartarLead, reabrirLead, salvarMensagem } from '../lib/crm';
import type { LeadMapa } from '../lib/leads';

type Props = {
  lead: LeadMapa;
  onClose: () => void;
  onChanged: () => void;
  onOpenMapa: (l: LeadMapa) => void;
};

function statusOf(l: LeadMapa) {
  if (l.etapa === 'perdido') return { label: 'Descartado', cls: 'badge-error' };
  if (l.aprovado) return { label: 'Aprovado', cls: 'badge-success' };
  return { label: 'A revisar', cls: 'badge-warning' };
}

export function LeadDetailModal({ lead, onClose, onChanged, onOpenMapa }: Props) {
  const tomInicial = (lead.tom_mensagem as Tom) || 'amigavel';
  const [tom, setTom] = useState<Tom>(tomInicial);
  const [mensagem, setMensagem] = useState(lead.mensagem_whatsapp || gerarMensagem(lead, tomInicial));
  const [busy, setBusy] = useState<string | null>(null);
  const [local, setLocal] = useState(lead);
  const status = statusOf(local);
  const temTel = !!(local.whatsapp || local.telefone);

  function trocarTom(t: Tom) { setTom(t); setMensagem(gerarMensagem(lead, t)); }

  async function acao(tipo: 'aprovar' | 'descartar' | 'reabrir') {
    setBusy(tipo);
    try {
      if (tipo === 'aprovar') { await aprovarLead(lead.id); setLocal({ ...local, aprovado: true, etapa: 'a_contatar' }); }
      else if (tipo === 'descartar') { await descartarLead(lead.id); setLocal({ ...local, aprovado: false, etapa: 'perdido' }); }
      else { await reabrirLead(lead.id); setLocal({ ...local, aprovado: false, etapa: 'novo' }); }
      onChanged();
    } catch (e) { alert(e instanceof Error ? e.message : 'Falha na ação.'); }
    finally { setBusy(null); }
  }

  async function enviar() {
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

  return (
    <div className="scrape-wrap" onClick={onClose}>
      <div className="backdrop" />
      <div className="modal-card lead-modal" onClick={(e) => e.stopPropagation()}>
        <div className="lead-modal-head">
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="row" style={{ gap: 8 }}>
              <span className={`badge ${status.cls}`}><span className="dot" /> {status.label}</span>
              <ScoreBadge lead={local} />
            </div>
            <div className="t-h2" style={{ fontSize: 20, marginTop: 8 }}>{local.nome_empresa}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: 32, padding: 0 }} onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        </div>

        <div className="lead-modal-info">
          {local.nota_media != null && <div className="row" style={{ gap: 6 }}><Star size={14} fill="#F59E0B" color="#F59E0B" /> <strong className="tnum">{local.nota_media}</strong> <span className="t-muted">· {local.num_avaliacoes} avaliações</span></div>}
          {local.telefone && <div className="row" style={{ gap: 6 }}><Phone size={14} /> <span className="tnum">{local.telefone}</span></div>}
          {local.endereco && <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}><MapPin size={14} style={{ marginTop: 2, flexShrink: 0 }} /> <span className="t-muted">{local.endereco}</span></div>}
          <div className="row-wrap" style={{ gap: 6 }}>
            {local.segmento && <span className="badge badge-neutral">{local.segmento}</span>}
            {local.regiao && <span className="badge badge-outline">{local.regiao}</span>}
            {local.tem_site && <span className="badge badge-outline"><Globe size={11} /> site</span>}
          </div>
          <div className="row" style={{ gap: 16, marginTop: 2 }}>
            {local.link_maps && <a className="lead-card-maps" href={local.link_maps} target="_blank" rel="noreferrer"><Globe size={13} /> Google Maps</a>}
            <button className="lead-card-open" style={{ background: 'none', border: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => { onClose(); onOpenMapa(local); }}><Eye size={13} /> Ver no mapa</button>
          </div>
        </div>

        <div className="divider" />

        <div className="col" style={{ gap: 10 }}>
          <div className="row" style={{ gap: 8 }}><MessageCircle size={16} style={{ color: '#00A058' }} /> <strong style={{ fontSize: 14 }}>Mensagem de WhatsApp</strong></div>
          <div className="seg">{TONS.map((t) => <button key={t.id} className={`seg-item ${tom === t.id ? 'is-on' : ''}`} onClick={() => trocarTom(t.id)}>{t.label}</button>)}</div>
          <textarea className="textarea" value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={7} style={{ minHeight: 150 }} />
          <button className="btn btn-primary btn-block" onClick={() => void enviar()} disabled={!temTel}><Send size={16} /> Enviar no WhatsApp</button>
          {!temTel && <div className="t-caption t-faint">Esse lead não trouxe telefone.</div>}
        </div>

        <div className="divider" />

        <div className="row" style={{ gap: 8 }}>
          {local.etapa === 'perdido' || local.aprovado ? (
            <button className="btn btn-secondary grow" disabled={busy != null} onClick={() => void acao('reabrir')}>
              {busy === 'reabrir' ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />} Voltar pra triagem
            </button>
          ) : (
            <>
              <button className="btn btn-primary grow" disabled={busy != null} onClick={() => void acao('aprovar')}>
                {busy === 'aprovar' ? <Loader2 size={15} className="spin" /> : <Check size={15} />} Aprovar
              </button>
              <button className="btn btn-secondary" disabled={busy != null} onClick={() => void acao('descartar')} style={{ color: 'var(--error)' }}>
                {busy === 'descartar' ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Descartar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
