import { supabase } from './supabase';
import type { ScoreCor } from '../types/database';

/** Lead simplificado pra exibir no mapa. */
export type LeadMapa = {
  id: string;
  nome_empresa: string;
  telefone: string | null;
  whatsapp: string | null;
  endereco: string | null;
  cidade: string | null;
  link_maps: string | null;
  tem_site: boolean;
  num_avaliacoes: number;
  nota_media: number | null;
  score: number;
  score_cor: ScoreCor;
  latitude: number | null;
  longitude: number | null;
  aprovado: boolean;
  duplicado: boolean;
};

const COLS =
  'id,nome_empresa,telefone,whatsapp,endereco,cidade,link_maps,tem_site,num_avaliacoes,nota_media,score,score_cor,latitude,longitude,aprovado,duplicado';

/** Lê os leads do ORCradar de uma região (só os que têm coordenadas). */
export async function listLeadsByRegiao(nome: string | null): Promise<LeadMapa[]> {
  if (!supabase || !nome) return [];
  const { data, error } = await supabase
    .from('crm_leads')
    .select(COLS)
    .eq('regiao', nome)
    .eq('origem', 'orcradar')
    .not('latitude', 'is', null)
    .order('num_avaliacoes', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as LeadMapa[];
}
