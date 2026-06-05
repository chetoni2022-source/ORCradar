// ORCradar — Edge Function `radar-scrape`
// Raspa leads de uma região (via Apify / Google Maps Scraper) e grava em crm_leads.
//
// SEGURANÇA: o token do Apify NUNCA vai pro navegador. Ele fica como secret
// desta função (APIFY_TOKEN). A função valida que quem chama é o dono da
// plataforma (is_platform_owner) antes de qualquer coisa.
//
// Secrets/var. de ambiente usadas:
//   - APIFY_TOKEN                 (você configura — token da sua conta Apify)
//   - SUPABASE_URL                (injetada automaticamente pelo Supabase)
//   - SUPABASE_ANON_KEY           (injetada automaticamente)
//   - SUPABASE_SERVICE_ROLE_KEY   (injetada automaticamente)

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

// Gera um polígono (círculo aproximado) a partir de centro + raio, no formato
// GeoJSON que o ator do Apify aceita pra limitar a busca à região.
function circlePolygon(lat: number, lng: number, radiusKm: number, points = 32) {
  const coords: number[][] = [];
  const rLat = radiusKm / 111.32; // graus de latitude por km (aprox.)
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI;
    const dLat = rLat * Math.cos(t);
    const dLng = (rLat * Math.sin(t)) / Math.cos((lat * Math.PI) / 180);
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const APIFY_TOKEN = Deno.env.get('APIFY_TOKEN');
    if (!APIFY_TOKEN) {
      return json({ error: 'APIFY_TOKEN não configurado nas secrets da função.' }, 500);
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // 1) Valida que o chamador é o dono da plataforma (no contexto do usuário).
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isOwner } = await userClient.rpc('is_platform_owner');
    if (isOwner !== true) {
      return json({ error: 'Acesso restrito ao dono da plataforma.' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const regiaoId = body?.regiao_id as string | undefined;
    const max = Math.min(Number(body?.max) || 50, 120);
    if (!regiaoId) return json({ error: 'regiao_id é obrigatório.' }, 400);

    // 2) Cliente admin (service role) pras operações de dados.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: regiao, error: regErr } = await admin
      .from('radar_regioes').select('*').eq('id', regiaoId).single();
    if (regErr || !regiao) return json({ error: 'Região não encontrada.' }, 404);

    const segmento = (regiao.segmento && String(regiao.segmento).trim()) || 'oficina mecânica';

    // 3) Chama o ator do Apify (Google Maps Scraper — compass/crawler-google-places).
    const input = {
      searchStringsArray: [segmento],
      customGeolocation: circlePolygon(Number(regiao.centro_lat), Number(regiao.centro_lng), Number(regiao.raio_km)),
      maxCrawledPlacesPerSearch: max,
      language: 'pt-BR',
      skipClosedPlaces: true,
    };
    const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
    const apifyRes = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!apifyRes.ok) {
      const txt = await apifyRes.text();
      return json({ error: `Apify falhou (HTTP ${apifyRes.status}): ${txt.slice(0, 300)}` }, 502);
    }
    const places = await apifyRes.json();
    if (!Array.isArray(places)) return json({ error: 'Resposta inesperada do Apify.' }, 502);

    // 4) Marca duplicados (telefone já existente em crm_leads).
    const { data: existentes } = await admin.from('crm_leads').select('telefone').not('telefone', 'is', null);
    const telsExistentes = new Set(
      (existentes ?? []).map((e: { telefone: string }) => String(e.telefone).replace(/\D/g, '')).filter(Boolean),
    );

    let duplicados = 0;
    const vistos = new Set<string>();
    const rows = places.map((p: Record<string, any>) => {
      const tel = p.phone ?? p.phoneUnformatted ?? null;
      const telNorm = tel ? String(tel).replace(/\D/g, '') : '';
      const dup = telNorm ? (telsExistentes.has(telNorm) || vistos.has(telNorm)) : false;
      if (telNorm) vistos.add(telNorm);
      if (dup) duplicados++;
      return {
        nome_empresa: p.title ?? 'Sem nome',
        segmento,
        telefone: tel,
        whatsapp: tel,
        endereco: p.address ?? null,
        cidade: p.city ?? null,
        link_maps: p.url ?? null,
        tem_site: !!p.website,
        num_avaliacoes: Number(p.reviewsCount ?? 0),
        nota_media: p.totalScore != null ? Number(p.totalScore) : null,
        tem_fotos: !!(p.imageUrl || Number(p.imagesCount) > 0),
        latitude: p.location?.lat ?? null,
        longitude: p.location?.lng ?? null,
        regiao: regiao.nome ?? null,
        origem: 'orcradar',
        aprovado: false,
        duplicado: dup,
      };
    });

    let inseridos = 0;
    if (rows.length) {
      const { error: insErr, count } = await admin.from('crm_leads').insert(rows, { count: 'exact' });
      if (insErr) return json({ error: `Falha ao inserir: ${insErr.message}` }, 500);
      inseridos = count ?? rows.length;
    }

    // 5) Atualiza o contador da região.
    await admin
      .from('radar_regioes')
      .update({ leads_encontrados: (regiao.leads_encontrados ?? 0) + rows.length })
      .eq('id', regiaoId);

    return json({ total: places.length, inseridos, duplicados });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro inesperado.' }, 500);
  }
});
