import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertCircle, BarChart3, Users, Send, Trash2, TrendingUp, Target } from 'lucide-react';
import { listAllLeads, type LeadMapa } from '../lib/leads';
import { estimarValorCents } from '../lib/crm';
import { calcularScore } from '../lib/score';

const COR: Record<string, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };

function fmtBRL(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="an-row">
      <span className="an-label" title={label}>{label}</span>
      <span className="an-track"><span className="an-fill" style={{ width: `${Math.max(3, pct)}%`, background: color }} /></span>
      <span className="an-val tnum">{value}</span>
    </div>
  );
}

function Kpi({ icon, label, value, hint, color }: { icon: React.ReactNode; label: string; value: string; hint?: string; color?: string }) {
  return (
    <div className="an-kpi">
      <div className="an-kpi-top"><span className="an-kpi-icon" style={color ? { color } : undefined}>{icon}</span><span className="an-kpi-label">{label}</span></div>
      <div className="an-kpi-value" style={color ? { color } : undefined}>{value}</div>
      {hint && <div className="an-kpi-hint">{hint}</div>}
    </div>
  );
}

type Props = { leadsVersion: number };

export function AnalisePage({ leadsVersion }: Props) {
  const [leads, setLeads] = useState<LeadMapa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try { const l = await listAllLeads(); if (alive) setLeads(l); }
      catch (e) { if (alive) setError(e instanceof Error ? e.message : 'Falha ao carregar.'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [leadsVersion]);

  const s = useMemo(() => {
    const total = leads.length;
    let triagem = 0, noCrm = 0, descartado = 0;
    const porCor = { verde: 0, amarelo: 0, vermelho: 0 } as Record<string, number>;
    const porRegiao = new Map<string, number>();
    let mrrCrmCents = 0, mrrPotencialCents = 0;
    const dias = new Map<string, number>(); // yyyy-mm-dd → count

    for (const l of leads) {
      const cor = calcularScore(l).cor;
      porCor[cor]++;
      mrrPotencialCents += estimarValorCents(cor);
      if (l.etapa === 'perdido') descartado++;
      else if (l.enviado_crm) { noCrm++; mrrCrmCents += l.valor_potencial_mensal_cents ?? estimarValorCents(cor); }
      else triagem++;
      const reg = l.regiao || 'Sem região';
      porRegiao.set(reg, (porRegiao.get(reg) ?? 0) + 1);
      if (l.created_at) {
        const d = l.created_at.slice(0, 10);
        dias.set(d, (dias.get(d) ?? 0) + 1);
      }
    }
    const regioes = Array.from(porRegiao, ([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n).slice(0, 8);
    const taxa = total > 0 ? Math.round((noCrm / total) * 100) : 0;

    // últimos 14 dias
    const serie: { dia: string; label: string; n: number }[] = [];
    const hoje = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      serie.push({ dia: key, label: String(d.getDate()), n: dias.get(key) ?? 0 });
    }
    return { total, triagem, noCrm, descartado, porCor, regioes, mrrCrmCents, mrrPotencialCents, taxa, serie };
  }, [leads]);

  const maxStatus = Math.max(1, s.triagem, s.noCrm, s.descartado);
  const maxCor = Math.max(1, s.porCor.verde, s.porCor.amarelo, s.porCor.vermelho);
  const maxReg = Math.max(1, ...s.regioes.map((r) => r.n));
  const maxSerie = Math.max(1, ...s.serie.map((d) => d.n));

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head">
        <div><h1 className="t-h1">Análise</h1><p>Visão geral da sua prospecção: leads, score, regiões e MRR.</p></div>
      </div>

      {loading ? (
        <div className="row t-muted" style={{ gap: 8 }}><Loader2 size={16} className="spin" /> Carregando…</div>
      ) : error ? (
        <div className="row" style={{ gap: 8, color: 'var(--error)' }}><AlertCircle size={16} /> {error}</div>
      ) : s.total === 0 ? (
        <div className="card empty-state">
          <BarChart3 size={42} style={{ color: 'var(--tech)' }} />
          <div className="t-h3">Sem dados ainda</div>
          <div className="t-muted" style={{ maxWidth: 380 }}>Raspe uma região e revise leads pra ver os números aqui.</div>
        </div>
      ) : (
        <div className="col" style={{ gap: 18 }}>
          {/* KPIs */}
          <div className="an-kpis">
            <Kpi icon={<Users size={16} />} label="Total de leads" value={String(s.total)} hint={`${s.triagem} em triagem`} />
            <Kpi icon={<Send size={16} />} label="No CRM" value={String(s.noCrm)} hint={`${s.taxa}% enviados`} color="var(--tech-deep)" />
            <Kpi icon={<TrendingUp size={16} />} label="MRR no CRM" value={fmtBRL(s.mrrCrmCents)} hint="por mês, se fechar" color="var(--tech-deep)" />
            <Kpi icon={<Target size={16} />} label="MRR potencial" value={fmtBRL(s.mrrPotencialCents)} hint="todos os leads" />
            <Kpi icon={<Trash2 size={16} />} label="Descartados" value={String(s.descartado)} color="var(--error)" />
          </div>

          <div className="an-grid">
            {/* Status */}
            <div className="card an-card">
              <div className="an-title">Por status</div>
              <BarRow label="Em triagem" value={s.triagem} max={maxStatus} color="#94A3B8" />
              <BarRow label="No CRM" value={s.noCrm} max={maxStatus} color={COR.verde} />
              <BarRow label="Descartados" value={s.descartado} max={maxStatus} color={COR.vermelho} />
            </div>

            {/* Score */}
            <div className="card an-card">
              <div className="an-title">Por temperatura (score)</div>
              <BarRow label="Quente" value={s.porCor.verde} max={maxCor} color={COR.verde} />
              <BarRow label="Morno" value={s.porCor.amarelo} max={maxCor} color={COR.amarelo} />
              <BarRow label="Frio" value={s.porCor.vermelho} max={maxCor} color={COR.vermelho} />
            </div>

            {/* Regiões */}
            <div className="card an-card">
              <div className="an-title">Leads por região</div>
              {s.regioes.length === 0 ? <div className="t-faint" style={{ fontSize: 13 }}>Sem regiões.</div> : (
                s.regioes.map((r) => <BarRow key={r.nome} label={r.nome} value={r.n} max={maxReg} color="var(--tech)" />)
              )}
            </div>

            {/* Últimos 14 dias */}
            <div className="card an-card">
              <div className="an-title">Leads nos últimos 14 dias</div>
              <div className="an-spark">
                {s.serie.map((d) => (
                  <div key={d.dia} className="an-spark-col" title={`${d.dia}: ${d.n}`}>
                    <span className="an-spark-bar" style={{ height: `${Math.round((d.n / maxSerie) * 100)}%` }} />
                    <span className="an-spark-x">{d.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div></div>
  );
}
