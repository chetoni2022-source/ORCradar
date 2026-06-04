import { supabase } from './supabase';
import type { RadarRegiao } from '../types/database';

/**
 * Acesso de dados da tabela `radar_regioes` (regiões desenhadas no mapa).
 * Todas as operações dependem de RLS — só o superadmin logado consegue
 * ler/gravar (is_platform_owner()).
 */

export type NovaRegiao = {
  nome: string | null;
  centro_lat: number;
  centro_lng: number;
  raio_km: number;
  segmento: string | null;
};

export async function listRegioes(): Promise<RadarRegiao[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('radar_regioes')
    .select('*')
    .order('data_prospeccao', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as RadarRegiao[];
}

export async function createRegiao(r: NovaRegiao): Promise<RadarRegiao> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase
    .from('radar_regioes')
    .insert(r)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as RadarRegiao;
}

export async function deleteRegiao(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('radar_regioes').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
