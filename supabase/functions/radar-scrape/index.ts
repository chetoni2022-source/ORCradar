// ORCradar — Edge Function `radar-scrape` (raspagem MANUAL, disparada pelo app).
//
// SEGURANÇA: valida que quem chama é o dono (is_platform_owner). Token do Apify
// vem do secret APIFY_TOKEN ou do corpo (fica só na máquina do dono). Nunca é
// gravado no banco. RATE LIMIT: protege os créditos do Apify contra abuso/erro.
// A lógica de raspar/dedup/log vive em ./scrape-core.ts (compartilhada c/ o cron).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { scrapeRegiao } from './scrape-core.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

// Limites pra não estourar créditos do Apify (raspagem manual).
const MAX_RUNS_HORA = 12;
const MAX_LEADS_DIA = 2000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // 1) Só o dono da plataforma.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: isOwner } = await userClient.rpc('is_platform_owner');
    if (isOwner !== true) return json({ error: 'Acesso restrito ao dono da plataforma.' }, 403);
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user?.id ?? null;

    const body = await req.json().catch(() => ({}));
    const regiaoId = body?.regiao_id as string | undefined;
    const max = Math.min(Number(body?.max) || 50, 120);
    if (!regiaoId) return json({ error: 'regiao_id é obrigatório.' }, 400);

    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') ||
      (typeof body?.apify_token === 'string' ? body.apify_token.trim() : '');
    if (!APIFY_TOKEN) return json({ error: 'Token do Apify ausente. Configure no app (campo "Token Apify") ou como secret APIFY_TOKEN.' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 2) Rate limit — protege os créditos do Apify.
    const umaHora = new Date(Date.now() - 3600_000).toISOString();
    const { count: runsHora } = await admin.from('radar_scrape_log')
      .select('*', { count: 'exact', head: true }).gte('ran_at', umaHora);
    if ((runsHora ?? 0) >= MAX_RUNS_HORA) {
      return json({ error: `Muitas raspagens na última hora (limite ${MAX_RUNS_HORA}). Tente mais tarde.` }, 429);
    }
    const umDia = new Date(Date.now() - 86_400_000).toISOString();
    const { data: hoje } = await admin.from('radar_scrape_log').select('inseridos').gte('ran_at', umDia);
    const leadsHoje = (hoje ?? []).reduce((s: number, r: { inseridos: number | null }) => s + (r.inseridos ?? 0), 0);
    if (leadsHoje >= MAX_LEADS_DIA) {
      return json({ error: `Limite diário de ${MAX_LEADS_DIA} leads atingido. Volte amanhã.` }, 429);
    }

    // 3) Região e raspagem (com dedup + log no core).
    const { data: regiao, error: regErr } = await admin.from('radar_regioes').select('*').eq('id', regiaoId).single();
    if (regErr || !regiao) return json({ error: 'Região não encontrada.' }, 404);

    const result = await scrapeRegiao(admin, APIFY_TOKEN, regiao, max, 'manual', caller);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500);
  }
});
