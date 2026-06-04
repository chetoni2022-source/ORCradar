import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, envError } from './env';

/**
 * Cliente Supabase do ORCradar.
 *
 * Aponta para o MESMO projeto do ORCtech (banco "ERP"). O ORCradar só deve
 * tocar nas tabelas de prospecção (`crm_leads` e `radar_regioes`) — nunca nas
 * tabelas do produto ORCtech (orçamentos, clientes, serviços, etc.).
 */
export const isSupabaseConfigured =
  !envError && !!env.VITE_SUPABASE_URL && !!env.VITE_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  : null;

export type ConnectionStatus = {
  ok: boolean;
  detail: string;
};

/**
 * Checa se o projeto Supabase está acessível (sem depender de login nem de
 * tabelas). Usa o endpoint público de health do GoTrue.
 */
export async function checkSupabaseConnection(): Promise<ConnectionStatus> {
  if (!isSupabaseConfigured) {
    return { ok: false, detail: envError ?? 'Variáveis de ambiente ausentes' };
  }
  try {
    const res = await fetch(`${env.VITE_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: env.VITE_SUPABASE_ANON_KEY },
    });
    if (res.ok) return { ok: true, detail: 'Projeto Supabase acessível' };
    return { ok: false, detail: `Resposta inesperada (HTTP ${res.status})` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Falha de rede' };
  }
}
