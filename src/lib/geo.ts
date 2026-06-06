/**
 * Utilidades de geolocalização, busca de endereço e rotas — tudo com serviços
 * gratuitos e sem chave de API:
 *  - Geolocalização: API do navegador
 *  - Busca de endereço: Nominatim (OpenStreetMap)
 *  - Rotas multimodais (carro/bici/a pé): servidores públicos OSRM da FOSSGIS
 */

export type LatLng = { lat: number; lng: number };
/** Localização + precisão (em metros) reportada pelo navegador. */
export type MinhaLoc = LatLng & { accuracy: number };
export type ModoRota = 'carro' | 'bici' | 'pe';

/**
 * Pega a localização atual do usuário (pede permissão ao navegador).
 * Força leitura FRESCA (maximumAge: 0) e alta precisão — no desktop sem GPS
 * a precisão vem do Wi-Fi/IP e pode errar bastante (por isso devolvemos
 * `accuracy` pra avisar e deixamos o pino arrastável no mapa).
 */
export function getMinhaLocalizacao(): Promise<MinhaLoc> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Permissão de localização negada. Libere o acesso à localização no navegador.'));
        else if (err.code === err.TIMEOUT) reject(new Error('Tempo esgotado ao obter a localização.'));
        else reject(new Error('Não foi possível obter a localização.'));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });
}

export type GeocodeResult = { label: string; lat: number; lng: number };

/**
 * Busca um endereço/lugar pelo nome (Nominatim).
 * Mais preciso: restringe ao Brasil (countrycodes=br) e, quando o mapa já está
 * num lugar, ENVIESA os resultados pra perto desse ponto (viewbox) — assim a
 * busca "bate" com o que você está olhando, em vez de cair em outra cidade.
 */
export async function buscarEndereco(q: string, perto?: LatLng): Promise<GeocodeResult[]> {
  const termo = q.trim();
  if (termo.length < 3) return [];
  const params = new URLSearchParams({
    format: 'jsonv2', limit: '7', 'accept-language': 'pt-BR',
    countrycodes: 'br', addressdetails: '1', dedupe: '1', q: termo,
  });
  if (perto && Number.isFinite(perto.lat) && Number.isFinite(perto.lng)) {
    const d = 0.7; // ~70 km de viés ao redor do que está na tela
    params.set('viewbox', `${perto.lng - d},${perto.lat - d},${perto.lng + d},${perto.lat + d}`);
    params.set('bounded', '0'); // prefere dentro da caixa, mas não descarta o resto
  }
  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Falha na busca de endereço.');
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string; importance?: number }>;
  return data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
}

export type Rota = {
  coords: [number, number][];
  distanciaKm: number;
  duracaoMin: number;
  modo: ModoRota;
};

const SUBDOMINIO: Record<ModoRota, string> = {
  carro: 'routed-car',
  bici: 'routed-bike',
  pe: 'routed-foot',
};

/** Traça a rota entre dois pontos no modo escolhido (OSRM / FOSSGIS). */
export async function tracarRota(origem: LatLng, destino: LatLng, modo: ModoRota): Promise<Rota> {
  const coordsStr = `${origem.lng},${origem.lat};${destino.lng},${destino.lat}`;
  const url = `https://routing.openstreetmap.de/${SUBDOMINIO[modo]}/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao traçar a rota.');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('Nenhuma rota encontrada para esse trajeto.');
  const rt = data.routes[0];
  const coords = (rt.geometry.coordinates as number[][]).map((c) => [c[1], c[0]] as [number, number]);
  return { coords, distanciaKm: rt.distance / 1000, duracaoMin: rt.duration / 60, modo };
}

export function formatarDuracao(min: number): string {
  if (min < 1) return 'menos de 1 min';
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}min` : `${h}h`;
}
