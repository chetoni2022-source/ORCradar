/**
 * Utilidades de geolocalização, busca de endereço e rotas — tudo com serviços
 * gratuitos e sem chave de API:
 *  - Geolocalização: API do navegador
 *  - Busca de endereço: Nominatim (OpenStreetMap)
 *  - Rotas multimodais (carro/bici/a pé): servidores públicos OSRM da FOSSGIS
 */

export type LatLng = { lat: number; lng: number };
export type ModoRota = 'carro' | 'bici' | 'pe';

/** Pega a localização atual do usuário (pede permissão ao navegador). */
export function getMinhaLocalizacao(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste navegador.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('Permissão de localização negada.'));
        else if (err.code === err.TIMEOUT) reject(new Error('Tempo esgotado ao obter a localização.'));
        else reject(new Error('Não foi possível obter a localização.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export type GeocodeResult = { label: string; lat: number; lng: number };

/** Busca um endereço/lugar pelo nome (Nominatim). */
export async function buscarEndereco(q: string): Promise<GeocodeResult[]> {
  const termo = q.trim();
  if (termo.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=pt-BR&q=${encodeURIComponent(termo)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Falha na busca de endereço.');
  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
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
