import type { StyleSpecification } from 'maplibre-gl';

/**
 * Estilo de ruas no visual do Google Maps — Carto "Voyager" (vetorial, gratuito,
 * SEM chave/API key). Paleta clara com ruas, POIs e rótulos parecidos com o
 * Google. Substitui o OpenFreeMap pra ficar mais perto do que o dono pediu.
 */
export const STREETS_STYLE = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

/** Satélite (Esri World Imagery) montado como style raster. {z}/{y}/{x} — y antes de x. */
export const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [{ id: 'esri-imagery', type: 'raster', source: 'esri-imagery' }],
};

export type Basemap = 'streets' | 'satellite';
