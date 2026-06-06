import { supabase } from './supabase';
import { gerarMensagem, type Tom } from './mensagem';
import type { LeadMapa } from './leads';

async function atualizar(id: string, patch: Record<string, unknown>): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('crm_leads').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Descarta o lead (etapa "perdido"). Continua no banco, mas fora da triagem. */
export const descartarLead = (id: string) =>
  atualizar(id, { aprovado: false, etapa: 'perdido' });

/** Volta o lead pra triagem do ORCradar (sai do funil do CRM). */
export const reabrirLead = (id: string) =>
  atualizar(id, { aprovado: false, enviado_crm: false, etapa: 'triagem' });

/** Salva a mensagem de WhatsApp gerada/editada e o tom usado. */
export const salvarMensagem = (id: string, mensagem: string, tom: string) =>
  atualizar(id, { mensagem_whatsapp: mensagem, tom_mensagem: tom, ultimo_contato_at: new Date().toISOString() });

// ── Segmento: texto livre da região → "key" que o CRM da ORCtech entende ──────
function norm(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

const SEG_KEYS = new Set([
  'oficina', 'funilaria', 'autoeletrica', 'ar_condicionado', 'eletrica',
  'hidraulica', 'cobertura', 'marcenaria', 'lava_rapido', 'outro',
]);

/** Mapeia o segmento da região (ex.: "oficina mecânica") pro key do CRM. */
export function mapearSegmento(texto: string | null): string {
  if (!texto) return 'oficina';
  const t = norm(texto);
  if (SEG_KEYS.has(t)) return t;
  if (t.includes('funilaria') || t.includes('pintura') || t.includes('lanternag')) return 'funilaria';
  if (t.includes('auto') && t.includes('eletr')) return 'autoeletrica';
  if (t.includes('condicionado') || t.includes('climatiz') || t.includes('ar-cond')) return 'ar_condicionado';
  if (t.includes('lava')) return 'lava_rapido';
  if (t.includes('marcen')) return 'marcenaria';
  if (t.includes('telhad') || t.includes('cobertura')) return 'cobertura';
  if (t.includes('hidraul') || t.includes('encanad')) return 'hidraulica';
  if (t.includes('eletric')) return 'eletrica';
  if (t.includes('oficina') || t.includes('mecanic') || t.includes('automotiv') || t.includes('autocenter') || t.includes('auto center')) return 'oficina';
  return 'outro';
}

// ── Planos reais da ORCtech (ver ORCtech_Apresentacao.pdf) ────────────────────
// Só existem dois: Essencial R$ 150/mês e Completo R$ 250/mês (o "mais indicado").
// (O Setup do Google Maps de R$ 400 é cobrança única, não MRR.)
export const VALOR_OPCOES: { cents: number; label: string }[] = [
  { cents: 15000, label: 'Essencial · R$ 150' },
  { cents: 25000, label: 'Completo · R$ 250' },
];

/** Plano sugerido pela temperatura do lead (quente = Completo). */
export function estimarValorCents(scoreCor: string | null): number {
  return scoreCor === 'verde' ? 25000 : 15000;
}

/** Bloco de infos do lead pro campo Observações do CRM (visível e copiável). */
function buildObservacoes(lead: LeadMapa, mensagem: string): string {
  const cor = lead.score_cor === 'verde' ? 'quente' : lead.score_cor === 'amarelo' ? 'morno' : 'frio';
  const linhas: string[] = [];
  linhas.push(`Score ${lead.score}/100 (${cor})`);
  if (lead.nota_media != null) linhas.push(`Google: ${lead.nota_media} estrelas, ${lead.num_avaliacoes} avaliacoes`);
  if (lead.telefone) linhas.push(`Telefone: ${lead.telefone}`);
  if (lead.endereco) linhas.push(`Endereco: ${lead.endereco}`);
  if (lead.site_url) linhas.push(`Site: ${lead.site_url}`);
  if (lead.instagram) linhas.push(`Instagram: ${lead.instagram}`);
  if (lead.link_maps) linhas.push(`Google Maps: ${lead.link_maps}`);
  if (lead.regiao) linhas.push(`Regiao prospectada: ${lead.regiao}`);
  if (lead.horario_funcionamento) {
    linhas.push('');
    linhas.push('Horario de funcionamento:');
    linhas.push(lead.horario_funcionamento);
  }
  linhas.push('');
  linhas.push('Mensagem de 1o contato (Kaua):');
  linhas.push(mensagem);
  return linhas.join('\n');
}

export type EnvioCrm = { mensagem: string; tom: string; valorCents: number };

/**
 * FASE 5 — Envia o lead pro CRM da ORCtech.
 * Promove o lead de 'triagem' pro funil vivo ('a_contatar'), com segmento no
 * formato que o CRM entende, valor de MRR e a mensagem pronta. Também registra
 * uma interação (linha do tempo do CRM). Tudo via RLS owner-only.
 */
export async function enviarParaCrm(lead: LeadMapa, opts: EnvioCrm): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('crm_leads')
    .update({
      aprovado: true,
      enviado_crm: true,
      enviado_crm_at: nowIso,
      etapa: 'a_contatar',
      segmento: mapearSegmento(lead.segmento),
      valor_potencial_mensal_cents: opts.valorCents,
      mensagem_whatsapp: opts.mensagem,
      tom_mensagem: opts.tom,
      // Observações leva TODAS as infos (site, insta, maps, score, mensagem) —
      // o CRM da ORCtech mostra esse campo no detalhe do lead.
      observacoes: buildObservacoes(lead, opts.mensagem),
      proximo_passo: 'Mandar 1o contato no WhatsApp',
      ultimo_contato_at: nowIso,
    })
    .eq('id', lead.id);
  if (error) throw new Error(error.message);

  // Linha do tempo no CRM — guarda a própria mensagem. Não bloqueia se falhar.
  try {
    await supabase.from('crm_lead_interactions').insert({
      lead_id: lead.id,
      tipo: 'nota',
      resumo: `Captado pelo ORCradar. Mensagem de 1o contato pronta:\n\n${opts.mensagem}`,
    });
  } catch { /* segue mesmo assim */ }
}

export type ResultadoLote = { enviados: number; falhas: number };

/**
 * Envia VÁRIOS leads de uma vez pro CRM (botão de lote na tela Leads).
 * Cada lead vai com a mensagem (gerada no tom salvo ou amigável), o plano
 * sugerido pela temperatura e TODAS as infos. Pula os que já estão no CRM.
 */
export async function enviarLoteParaCrm(leads: LeadMapa[]): Promise<ResultadoLote> {
  const alvo = leads.filter((l) => !l.enviado_crm && l.etapa !== 'perdido');
  const results = await Promise.allSettled(
    alvo.map((l) => {
      const tom = (l.tom_mensagem as Tom) || 'amigavel';
      const mensagem = l.mensagem_whatsapp || gerarMensagem(l, tom);
      return enviarParaCrm(l, { mensagem, tom, valorCents: estimarValorCents(l.score_cor) });
    }),
  );
  const enviados = results.filter((r) => r.status === 'fulfilled').length;
  return { enviados, falhas: results.length - enviados };
}
