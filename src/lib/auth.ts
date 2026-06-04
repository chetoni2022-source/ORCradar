import { supabase } from './supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Camada de autenticação do ORCradar.
 *
 * O ORCradar é restrito ao dono da plataforma. O login usa e-mail/senha
 * (mesmo método do ORCtech) contra o MESMO projeto Supabase. Depois de logar,
 * confirmamos que o usuário é superadmin via is_platform_owner() — caso
 * contrário o RLS bloquearia tudo de qualquer forma.
 */

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase não configurado (verifique o .env).' };
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  return { error: error?.message ?? null };
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Assina mudanças de sessão (login/logout/refresh). Retorna função de unsubscribe. */
export function onAuthChange(cb: (session: Session | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

/**
 * Confirma se o usuário logado é o dono da plataforma (superadmin).
 * Tenta a RPC is_platform_owner(); se não estiver exposta, cai pra leitura
 * da própria linha em platform_admins (o RLS só deixa o owner ver).
 */
export async function checkOwner(userId: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_platform_owner');
  if (!error && typeof data === 'boolean') return data;

  const { data: row } = await supabase
    .from('platform_admins')
    .select('is_owner, can_access_crm')
    .eq('user_id', userId)
    .maybeSingle();
  return !!(row && (row.is_owner || row.can_access_crm));
}
