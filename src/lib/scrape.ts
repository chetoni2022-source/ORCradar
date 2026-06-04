import { supabase } from './supabase';

export type ResultadoRaspagem = {
  total: number;
  inseridos: number;
  duplicados: number;
};

/**
 * Dispara a raspagem de uma região chamando a Edge Function `radar-scrape`.
 * O token do Apify fica no servidor (secret da função) — nunca no navegador.
 */
export async function rasparRegiao(regiaoId: string, max = 50): Promise<ResultadoRaspagem> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { data, error } = await supabase.functions.invoke('radar-scrape', {
    body: { regiao_id: regiaoId, max },
  });
  if (error) {
    // Erros HTTP da função trazem o corpo em error.context (quando disponível).
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
