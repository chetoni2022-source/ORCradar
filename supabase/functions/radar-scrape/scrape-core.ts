// ORCradar — núcleo da raspagem, compartilhado por `radar-scrape` (manual) e
// `radar-cron` (agendada). Faz a chamada ao Apify, dedup forte, insert e LOG.
// Mantenha igual nas duas funções (cópia idêntica em cada pasta de função).

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export type Regiao = {
  id: string;
  nome: string | null;
  centro_lat: number | string;
  centro_lng: number | string;
  raio_km: number | string;
  segmento: string | null;
  leads_encontrados: number | null;
};

export type Resultado = { total: number; inseridos: number; duplicados: number };

function circlePolygon(lat: number, lng: number, radiusKm: number, points = 32) {
  const coords: number[][] = [];
  const rLat = radiusKm / 111.32;
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI;
    const dLat = rLat * Math.cos(t);
    const dLng = (rLat * Math.sin(t)) / Math.cos((lat * Math.PI) / 180);
    coords.push([lng + dLng, lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

function calcScore(num: number, nota: number, temTel: boolean, temSite: boolean, temFotos: boolean) {
  let p = 0;
  if (num >= 200) p += 40; else if (num >= 80) p += 32; else if (num >= 30) p += 24; else if (num >= 10) p += 14; else if (num >= 3) p += 6;
  if (nota >= 4.6) p += 30; else if (nota >= 4.2) p += 24; else if (nota >= 3.8) p += 16; else if (nota >= 3.0) p += 8; else if (nota > 0) p += 2;
  if (temTel) p += 20;
  if (temSite) p += 5;
  if (temFotos) p += 5;
  const cor = p >= 70 ? 'verde' : p >= 45 ? 'amarelo' : 'vermelho';
  return { score: p, cor };
}

export function mapSegmento(texto: string | null): string {
  if (!texto) return 'oficina';
  const t = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
  if (['oficina', 'funilaria', 'autoeletrica', 'ar_condicionado', 'eletrica', 'hidraulica', 'cobertura', 'marcenaria', 'lava_rapido', 'outro'].includes(t)) return t;
  if (t.includes('funilaria') || t.includes('pintura') || t.includes('lanternag')) return 'funilaria';
  if (t.includes('auto') && t.includes('eletr')) return 'autoeletrica';
  if (t.includes('condicionado') || t.includes('climatiz') || t.includes('ar-cond')) return 'ar_condicionado';
  if (t.includes('lava')) return 'lava_rapido';
  if (t.includes('marcen')) return 'marcenaria';
  if (t.includes('telhad') || t.includes('cobertura')) return 'cobertura';
  if (t.includes('hidraul') || t.includes('encanad')) return 'hidraulica';
  if (t.includes('eletric')) return 'eletrica';
  if (t.includes('oficina') || t.includes('mecanic') || t.includes('automotiv') || t.includes('autocenter')) return 'oficina';
  return 'outro';
}

function acharInstagram(p: Record<string, any>): string | null {
  const cands: unknown[] = [
    p.instagram,
    ...(Array.isArray(p.socialMedias) ? p.socialMedias : []),
    ...(Array.isArray(p.socialProfiles) ? p.socialProfiles : []),
    p.website,
  ];
  for (const c of cands) {
    if (typeof c === 'string' && c.toLowerCase().includes('instagram.com')) return c;
    if (c && typeof c === 'object') {
      const url = (c as Record<string, unknown>).url ?? (c as Record<string, unknown>).link;
      if (typeof url === 'string' && url.toLowerCase().includes('instagram.com')) return url;
    }
  }
  return null;
}

/** Normaliza texto pra dedup (sem acento, sem pontuação, minúsculo). */
function norm(s: string | null | undefined): string {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
/** Chave de dedup por nome+endereço (quando falta telefone/place_id). */
function chaveNomeEnd(nome: string | null, endereco: string | null): string {
  const n = norm(nome), e = norm(endereco);
  return n && e ? `${n}|${e}` : '';
}

/**
 * Raspa UMA região e grava os leads novos. Faz dedup por place_id, telefone E
 * por nome+endereço (pega o que vem sem telefone/place_id). Sempre escreve uma
 * linha em radar_scrape_log (sucesso ou erro).
 */
export async function scrapeRegiao(
  admin: SupabaseClient,
  apifyToken: string,
  regiao: Regiao,
  max: number,
  source: 'manual' | 'cron',
  caller: string | null,
): Promise<Resultado> {
  const inicio = Date.now();
  const logErro = async (erro: string) => {
    await admin.from('radar_scrape_log').insert({
      source, regiao_id: regiao.id, max_pedido: max, erro,
      duracao_ms: Date.now() - inicio, caller,
    });
  };

  try {
    const segmentoBusca = (regiao.segmento && String(regiao.segmento).trim()) || 'oficina mecânica';
    const segmentoKey = mapSegmento(segmentoBusca);

    const input = {
      searchStringsArray: [segmentoBusca],
      customGeolocation: circlePolygon(Number(regiao.centro_lat), Number(regiao.centro_lng), Number(regiao.raio_km)),
      maxCrawledPlacesPerSearch: max,
      language: 'pt-BR',
      skipClosedPlaces: true,
    };
    const runUrl = `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${apifyToken}`;
    const apifyRes = await fetch(runUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!apifyRes.ok) {
      const txt = await apifyRes.text();
      const msg = `Apify falhou (HTTP ${apifyRes.status}): ${txt.slice(0, 200)}`;
      await logErro(msg);
      throw new Error(msg);
    }
    const places = await apifyRes.json();
    if (!Array.isArray(places)) { await logErro('Resposta inesperada do Apify.'); throw new Error('Resposta inesperada do Apify.'); }

    // Carrega o que já existe pra NÃO repetir (place_id, telefone, nome+endereço).
    const { data: existentes } = await admin.from('crm_leads').select('telefone, place_id, nome_empresa, endereco');
    const tels = new Set<string>(), pids = new Set<string>(), nomes = new Set<string>();
    for (const e of (existentes ?? []) as Record<string, string | null>[]) {
      const t = e.telefone ? String(e.telefone).replace(/\D/g, '') : '';
      if (t) tels.add(t);
      if (e.place_id) pids.add(String(e.place_id));
      const k = chaveNomeEnd(e.nome_empresa, e.endereco);
      if (k) nomes.add(k);
    }

    let duplicados = 0;
    const vT = new Set<string>(), vP = new Set<string>(), vN = new Set<string>();
    const rows: Record<string, unknown>[] = [];

    for (const p of places as Record<string, any>[]) {
      const placeId = p.placeId ?? p.placeID ?? p.cid ?? null;
      const tel = p.phone ?? p.phoneUnformatted ?? null;
      const telNorm = tel ? String(tel).replace(/\D/g, '') : '';
      const nome = p.title ?? 'Sem nome';
      const endereco = p.address ?? null;
      const kNome = chaveNomeEnd(nome, endereco);

      const dup =
        (placeId && (pids.has(String(placeId)) || vP.has(String(placeId)))) ||
        (telNorm && (tels.has(telNorm) || vT.has(telNorm))) ||
        (kNome && (nomes.has(kNome) || vN.has(kNome)));
      if (dup) { duplicados++; continue; }
      if (placeId) vP.add(String(placeId));
      if (telNorm) vT.add(telNorm);
      if (kNome) vN.add(kNome);

      const website = typeof p.website === 'string' ? p.website : null;
      const instagram = acharInstagram(p);
      const siteUrl = website && !website.toLowerCase().includes('instagram.com') ? website : null;
      const num = Number(p.reviewsCount ?? 0);
      const nota = p.totalScore != null ? Number(p.totalScore) : null;
      const temSite = !!siteUrl;
      const temFotos = !!(p.imageUrl || Number(p.imagesCount) > 0);
      const sc = calcScore(num, nota ?? 0, !!tel, temSite, temFotos);

      rows.push({
        nome_empresa: nome, segmento: segmentoKey, telefone: tel, whatsapp: tel,
        instagram, site_url: siteUrl, place_id: placeId ? String(placeId) : null,
        endereco, cidade: p.city ?? null, link_maps: p.url ?? null,
        tem_site: temSite, num_avaliacoes: num, nota_media: nota, tem_fotos: temFotos,
        score: sc.score, score_cor: sc.cor,
        latitude: p.location?.lat ?? null, longitude: p.location?.lng ?? null,
        regiao: regiao.nome ?? null, origem: 'orcradar', etapa: 'triagem',
        aprovado: false, enviado_crm: false, duplicado: false,
      });
    }

    let inseridos = 0;
    if (rows.length) {
      const { error: insErr, count } = await admin.from('crm_leads').insert(rows, { count: 'exact' });
      if (insErr) { await logErro(`Falha ao inserir: ${insErr.message}`); throw new Error(insErr.message); }
      inseridos = count ?? rows.length;
    }

    await admin.from('radar_regioes')
      .update({ leads_encontrados: (regiao.leads_encontrados ?? 0) + inseridos })
      .eq('id', regiao.id);

    await admin.from('radar_scrape_log').insert({
      source, regiao_id: regiao.id, max_pedido: max,
      total: places.length, inseridos, duplicados,
      duracao_ms: Date.now() - inicio, caller,
    });

    return { total: places.length, inseridos, duplicados };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro inesperado na raspagem.';
    // Evita log duplicado se já logamos acima (best-effort).
    throw new Error(msg);
  }
}
