import { supabase } from './supabase';
import type { ScoreCor } from '../types/database';

/** Lead simplificado pra exibir no mapa e nas listas. */
export type LeadMapa = {
  id: string;
  nome_empresa: string;
  segmento: string | null;
  regiao: string | null;
  telefone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  site_url: string | null;
  endereco: string | null;
  cidade: string | null;
  link_maps: string | null;
  tem_site: boolean;
  tem_fotos: boolean;
  num_avaliacoes: number;
  nota_media: number | null;
  score: number;
  score_cor: ScoreCor;
  latitude: number | null;
  longitude: number | null;
  aprovado: boolean;
  duplicado: boolean;
  enviado_crm: boolean;
  etapa: string;
  mensagem_whatsapp: string | null;
  tom_mensagem: string | null;
  valor_potencial_mensal_cents: number | null;
  created_at: string | null;
};

const COLS =
  'id,nome_empresa,segmento,regiao,telefone,whatsapp,instagram,site_url,endereco,cidade,link_maps,tem_site,tem_fotos,num_avaliacoes,nota_media,score,score_cor,latitude,longitude,aprovado,duplicado,enviado_crm,etapa,mensagem_whatsapp,tom_mensagem,valor_potencial_mensal_cents,created_at';

/** Leads de uma região específica (só os que têm coordenadas — pro mapa). */
export async function listLeadsByRegiao(nome: string | null): Promise<LeadMapa[]> {
  if (!supabase || !nome) return [];
  const { data, error } = await supabase
    .from('crm_leads')
    .select(COLS)
    .eq('regiao', nome)
    .eq('origem', 'orcradar')
    .not('latitude', 'is', null)
    .order('score', { ascending: false })
    .limit(800);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadMapa[];
}

/** Todos os leads do ORCradar (pra tela Leads / triagem). */
export async function listAllLeads(): Promise<LeadMapa[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('crm_leads')
    .select(COLS)
    .eq('origem', 'orcradar')
    .order('score', { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadMapa[];
}

/**
 * Sanitiza uma URL que veio de dado raspado antes de virar href clicável.
 * Bloqueia `javascript:`/`data:`/etc. e completa domínios "pelados" com https://.
 * Defense-in-depth contra XSS (mesmo só o dono vendo os leads).
 */
export function linkSeguro(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  const u = String(url).trim();
  if (!u) return undefined;
  if (/^(javascript|data|vbscript|file):/i.test(u)) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$|\?)/i.test(u)) return 'https://' + u; // domínio pelado
  return undefined;
}

/** Oficina vizinha (pra usar na abordagem: "vi que perto de vocês tem a X"). */
export type Vizinho = {
  id: string;
  nome_empresa: string;
  nota_media: number | null;
  num_avaliacoes: number;
  endereco: string | null;
  link_maps: string | null;
  distanciaKm: number;
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Acha as `n` oficinas mais próximas de um lead (mesmo segmento prospectado),
 * pra usar na abordagem. Busca os outros leads com coordenadas e ordena por
 * distância real (haversine). Não conta o próprio lead nem descartados.
 */
export async function buscarVizinhos(lead: LeadMapa, n = 2): Promise<Vizinho[]> {
  if (!supabase || lead.latitude == null || lead.longitude == null) return [];
  const { data, error } = await supabase
    .from('crm_leads')
    .select('id,nome_empresa,nota_media,num_avaliacoes,endereco,link_maps,latitude,longitude')
    .eq('origem', 'orcradar')
    .neq('id', lead.id)
    .neq('etapa', 'perdido')
    .not('latitude', 'is', null)
    .not('longitude', 'is', null)
    .limit(500);
  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      nome_empresa: r.nome_empresa as string,
      nota_media: (r.nota_media as number | null) ?? null,
      num_avaliacoes: (r.num_avaliacoes as number) ?? 0,
      endereco: (r.endereco as string | null) ?? null,
      link_maps: (r.link_maps as string | null) ?? null,
      distanciaKm: haversineKm(lead.latitude!, lead.longitude!, Number(r.latitude), Number(r.longitude)),
    }))
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .slice(0, n);
}
