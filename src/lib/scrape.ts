import { supabase } from './supabase';

const TOKEN_KEY = 'orcradar-apify-token';

/** Token do Apify guardado localmente (só no navegador do dono). */
export function getApifyToken(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setApifyToken(token: string): void {
  if (typeof localStorage === 'undefined') return;
  const v = token.trim();
  if (v) localStorage.setItem(TOKEN_KEY, v);
  else localStorage.removeItem(TOKEN_KEY);
}

export type ResultadoRaspagem = {
  total: number;
  inseridos: number;
  duplicados: number;
};

/**
 * Dispara a raspagem de uma região chamando a Edge Function `radar-scrape`.
 * O token do Apify vem do secret da função OU, se houver, do que está salvo
 * no navegador (enviado no corpo). Nunca é gravado no banco.
 */
export async function rasparRegiao(regiaoId: string, max = 50): Promise<ResultadoRaspagem> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const apify_token = getApifyToken();
  const { data, error } = await supabase.functions.invoke('radar-scrape', {
    body: { regiao_id: regiaoId, max, apify_token: apify_token || undefined },
  });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json();
        if (j?.error) msg = j.error;
      }
    } catch { /* ignora */ }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data as ResultadoRaspagem;
}
