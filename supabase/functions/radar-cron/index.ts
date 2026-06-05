// ORCradar — Edge Function `radar-cron` (raspagem AGENDADA).
//
// Chamada pelo pg_cron a cada 15 min (via pg_net). NÃO usa JWT de usuário:
// é autenticada por um segredo (x-cron-secret) guardado no Vault e conferido
// via RPC service-role `radar_get_cron_secret()`. Processa 1 agendamento vencido
// por tick (respeita o tempo da Edge Function) e reprograma o próximo run.
//
// Depende do secret APIFY_TOKEN (sem navegador não dá pra pegar o token do app).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { scrapeRegiao } from './scrape-core.ts';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// Brasil (America/Sao_Paulo) é UTC-3 fixo (sem horário de verão desde 2019).
const TZ_OFFSET_H = -3;
function proximoRun(freq: string, diaSemana: number | null, hora: number): string {
  const now = new Date();
  const br = new Date(now.getTime() + TZ_OFFSET_H * 3600_000); // componentes UTC = hora local BR
  const toUtc = (d: Date) => new Date(d.getTime() - TZ_OFFSET_H * 3600_000);
  let cand = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate(), hora, 0, 0));
  if (freq === 'semanal') {
    const alvo = diaSemana ?? 1;
    const add = (alvo - cand.getUTCDay() + 7) % 7;
    cand = new Date(cand.getTime() + add * 86_400_000);
    let utc = toUtc(cand);
    if (utc <= now) utc = toUtc(new Date(cand.getTime() + 7 * 86_400_000));
    return utc.toISOString();
  }
  let utc = toUtc(cand);
  if (utc <= now) utc = toUtc(new Date(cand.getTime() + 86_400_000));
  return utc.toISOString();
}

Deno.serve(async (req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Autenticação por segredo do cron (Vault).
    const { data: segredo } = await admin.rpc('radar_get_cron_secret');
    const enviado = req.headers.get('x-cron-secret') ?? '';
    if (!segredo || enviado !== segredo) return json({ error: 'não autorizado' }, 401);

    // 2) Pega 1 agendamento vencido (ativo, proximo_run_at no passado/null).
    const agora = new Date().toISOString();
    const { data: ags } = await admin
      .from('radar_agendamentos')
      .select('*')
      .eq('ativo', true)
      .or(`proximo_run_at.is.null,proximo_run_at.lte.${agora}`)
      .order('proximo_run_at', { ascending: true, nullsFirst: true })
      .limit(1);
    const ag = (ags ?? [])[0];
    if (!ag) return json({ ok: true, processados: 0 });

    // Reprograma já (evita rodar de novo no próximo tick se a raspagem demorar).
    const prox = proximoRun(ag.frequencia, ag.dia_semana, ag.hora);
    await admin.from('radar_agendamentos').update({ ultimo_run_at: agora, proximo_run_at: prox }).eq('id', ag.id);

    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN') || '';
    if (!APIFY_TOKEN) {
      await admin.from('radar_scrape_log').insert({ source: 'cron', regiao_id: ag.regiao_id, erro: 'APIFY_TOKEN não configurado (secret). Agendamento não pôde rodar.' });
      return json({ error: 'APIFY_TOKEN não configurado' }, 400);
    }

    const { data: regiao } = await admin.from('radar_regioes').select('*').eq('id', ag.regiao_id).single();
    if (!regiao) return json({ error: 'região do agendamento não existe' }, 404);

    try {
      const r = await scrapeRegiao(admin, APIFY_TOKEN, regiao, ag.max_leads, 'cron', null);
      return json({ ok: true, processados: 1, regiao: regiao.nome, ...r });
    } catch (e) {
      return json({ ok: false, erro: e instanceof Error ? e.message : 'falha' }, 200);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erro' }, 500);
  }
});
