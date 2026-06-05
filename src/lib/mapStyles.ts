import type { StyleSpecification } from 'maplibre-gl';

/** Estilo vetorial gratuito (sem chave) — mostra comércios/POIs como o Google Maps. */
export const STREETS_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

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
