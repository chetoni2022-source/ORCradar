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
  etapa: string;
  mensagem_whatsapp: string | null;
  tom_mensagem: string | null;
};

const COLS =
  'id,nome_empresa,segmento,regiao,telefone,whatsapp,endereco,cidade,link_maps,tem_site,tem_fotos,num_avaliacoes,nota_media,score,score_cor,latitude,longitude,aprovado,duplicado,etapa,mensagem_whatsapp,tom_mensagem';

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
