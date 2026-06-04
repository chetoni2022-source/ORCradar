import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  MapContainer, TileLayer, Circle, CircleMarker, Polyline, Tooltip,
  LayersControl, LayerGroup, ZoomControl, useMap, useMapEvents,
} from 'react-leaflet';
import {
  Radar, MapPin, Save, Loader2, Trash2, RotateCcw, Crosshair, CheckCircle2,
  AlertCircle, Search, X, LocateFixed, Navigation, Car, Bike, Footprints, DownloadCloud,
} from 'lucide-react';
import { listRegioes, createRegiao, deleteRegiao, type NovaRegiao } from '../lib/radarRegioes';
import {
  getMinhaLocalizacao, buscarEndereco, tracarRota, formatarDuracao,
  type LatLng, type ModoRota, type Rota, type GeocodeResult,
} from '../lib/geo';
import { rasparRegiao } from '../lib/scrape';
import type { RadarRegiao } from '../types/database';

const VISAO_INICIAL: [number, number] = [-23.5505, -46.6333]; // São Paulo
const VERDE = '#00C46A';
const VERDE_DEEP = '#00A058';
const AZUL = '#2563EB';
const CINZA = '#94A3B8';

const SEGMENTOS = [
  'Oficina mecânica', 'Auto elétrica', 'Funilaria e pintura', 'Centro automotivo',
  'Borracharia', 'Troca de óleo', 'Lava-rápido', 'Acessórios e som',
];

const MODOS: { id: ModoRota; label: string; Icon: typeof Car }[] = [
  { id: 'carro', label: 'Carro', Icon: Car },
  { id: 'bici', label: 'Bici', Icon: Bike },
  { id: 'pe', label: 'A pé', Icon: Footprints },
];

function zoomForRaio(km: number): number {
  const z = Math.round(13 - Math.log2(Math.max(km, 0.5)));
  return Math.max(7, Math.min(14, z));
}

function ClickToSetCenter({ onSet }: { onSet: (p: LatLng) => void }) {
  useMapEvents({ click(e) { onSet({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}

function FlyTo({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function RadarMapPage() {
  // Região --------------------------------------------------------------
  const [center, setCenter] = useState<LatLng | null>(null);
  const [raioKm, setRaioKm] = useState(5);
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  // Lista de regiões ----------------------------------------------------
  const [regioes, setRegioes] = useState<RadarRegiao[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mostrarSalvas, setMostrarSalvas] = useState(true);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const [scrapingId, setScrapingId] = useState<string | null>(null);
  const [scrapeMsg, setScrapeMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Busca ---------------------------------------------------------------
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Localização e rota --------------------------------------------------
  const [minhaLoc, setMinhaLoc] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [modo, setModo] = useState<ModoRota>('carro');
  const [rota, setRota] = useState<Rota | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const limparRota = () => { setRota(null); setRouteError(null); };

  const carregar = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try { setRegioes(await listRegioes()); }
    catch (e) { setListError(e instanceof Error ? e.message : 'Falha ao carregar regiões.'); }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  function definirCentro(p: LatLng) {
    setCenter(p);
    setActiveId(null);
    limparRota();
  }

  async function handleSalvar() {
    if (!center || saving) return;
    setSaving(true);
    setSaveError(null);
    const nova: NovaRegiao = {
      nome: nome.trim() || null,
      centro_lat: Number(center.lat.toFixed(6)),
      centro_lng: Number(center.lng.toFixed(6)),
      raio_km: raioKm,
      segmento: segmento.trim() || null,
    };
    try {
      const criada = await createRegiao(nova);
      setNome('');
      setActiveId(criada.id);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      await carregar();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  function handleSelecionar(r: RadarRegiao) {
    const c = { lat: Number(r.centro_lat), lng: Number(r.centro_lng) };
    setCenter(c);
    setRaioKm(Number(r.raio_km));
    setSegmento(r.segmento ?? '');
    setActiveId(r.id);
    limparRota();
    setFocus({ ...c, zoom: zoomForRaio(Number(r.raio_km)) });
  }

  async function handleExcluir(r: RadarRegiao) {
    if (!window.confirm(`Excluir a região "${r.nome ?? 'sem nome'}"?`)) return;
    try {
      await deleteRegiao(r.id);
      if (activeId === r.id) setActiveId(null);
      await carregar();
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao excluir.');
    }
  }

  async function handleRaspar(r: RadarRegiao) {
    if (scrapingId) return;
    setScrapingId(r.id);
    setScrapeMsg(null);
    try {
      const res = await rasparRegiao(r.id);
      setScrapeMsg({ ok: true, text: `${r.nome ?? 'Região'}: ${res.inseridos} leads novos (${res.duplicados} duplicados).` });
      await carregar();
    } catch (e) {
      setScrapeMsg({ ok: false, text: e instanceof Error ? e.message : 'Falha na raspagem.' });
    } finally {
      setScrapingId(null);
    }
  }

  async function handleBuscar(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setSearching(true);
    try { setResults(await buscarEndereco(q)); }
    catch { setResults([]); }
    finally { setSearching(false); }
  }

  function selecionarBusca(r: GeocodeResult) {
    const c = { lat: r.lat, lng: r.lng };
    definirCentro(c);
    setFocus({ ...c, zoom: 14 });
    setResults([]);
    setQ(r.label.split(',').slice(0, 2).join(',').trim());
  }

  async function handleLocalizar() {
    setLocating(true);
    setLocError(null);
    try {
      const loc = await getMinhaLocalizacao();
      setMinhaLoc(loc);
      setFocus({ ...loc, zoom: 14 });
    } catch (e) {
      setLocError(e instanceof Error ? e.message : 'Falha na localização.');
    } finally {
      setLocating(false);
    }
  }

  async function tracar(m: ModoRota) {
    if (!minhaLoc || !center) { setRouteError('Defina sua localização e um centro no mapa.'); return; }
    setRouting(true);
    setRouteError(null);
    try { setRota(await tracarRota(minhaLoc, center, m)); }
    catch (e) { setRouteError(e instanceof Error ? e.message : 'Falha na rota.'); setRota(null); }
    finally { setRouting(false); }
  }

  function escolherModo(m: ModoRota) {
    setModo(m);
    if (minhaLoc && center) void tracar(m);
  }

  return (
    <div className="map-shell">
      {/* Painel de controles ----------------------------------------------- */}
      <aside className="map-panel col" style={{ gap: 18 }}>
        <div className="row" style={{ gap: 10 }}>
          <span className="icon-badge"><Radar size={20} /></span>
          <div>
            <div className="t-h3" style={{ fontSize: 16 }}>Nova região</div>
            <div className="t-caption t-muted">Desenhe um raio sobre o mapa.</div>
          </div>
        </div>

        <div className="field">
          <label className="field-label" htmlFor="nome">Nome da região</label>
          <input id="nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Zona Sul — São Paulo" />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="segmento">Segmento (opcional)</label>
          <input id="segmento" className="input" list="segmentos" value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Oficina mecânica" />
          <datalist id="segmentos">{SEGMENTOS.map((s) => <option key={s} value={s} />)}</datalist>
        </div>

        <div className="field">
          <label className="field-label">Raio: <span className="tnum">{raioKm} km</span></label>
          <input className="range" type="range" min={1} max={50} step={1} value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))} />
          <div className="between t-caption t-faint"><span>1 km</span><span>50 km</span></div>
        </div>

        {center ? (
          <div className="card-soft row" style={{ gap: 10, padding: 12 }}>
            <MapPin size={16} style={{ color: VERDE_DEEP, flexShrink: 0 }} />
            <div className="grow mono-code" style={{ fontSize: 12 }}>{center.lat.toFixed(5)}, {center.lng.toFixed(5)}</div>
            <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }} onClick={() => { setCenter(null); setActiveId(null); limparRota(); }} title="Limpar centro">
              <RotateCcw size={14} />
            </button>
          </div>
        ) : (
          <div className="card-soft row" style={{ gap: 10, padding: 12, color: 'var(--text-muted)' }}>
            <Crosshair size={16} style={{ flexShrink: 0 }} />
            <div className="t-caption">Clique no mapa para marcar o centro.</div>
          </div>
        )}

        {saveError && <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}><AlertCircle size={15} /> <span>{saveError}</span></div>}

        <button className="btn btn-primary btn-block" onClick={handleSalvar} disabled={!center || saving}>
          {saving ? <Loader2 size={17} className="spin" /> : savedFlash ? <CheckCircle2 size={17} /> : <Save size={17} />}
          {saving ? 'Salvando…' : savedFlash ? 'Região salva!' : 'Salvar região'}
        </button>

        <div className="divider" />

        {/* Localização e rota --------------------------------------------- */}
        <div className="row" style={{ gap: 10 }}>
          <span className="icon-badge"><Navigation size={18} /></span>
          <div>
            <div className="t-h3" style={{ fontSize: 15 }}>Localização e rota</div>
            <div className="t-caption t-muted">Veja o trajeto e o tempo até o centro.</div>
          </div>
        </div>

        <button className="btn btn-secondary btn-block" onClick={handleLocalizar} disabled={locating}>
          {locating ? <Loader2 size={16} className="spin" /> : <LocateFixed size={16} />}
          {minhaLoc ? 'Atualizar minha localização' : 'Usar minha localização'}
        </button>
        {locError && <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 12.5 }}><AlertCircle size={14} /> <span>{locError}</span></div>}

        <div className="seg" role="group" aria-label="Meio de locomoção">
          {MODOS.map(({ id, label, Icon }) => (
            <button key={id} className={`seg-item ${modo === id ? 'is-on' : ''}`} onClick={() => escolherModo(id)}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        <button className="btn btn-soft btn-block" onClick={() => void tracar(modo)} disabled={!minhaLoc || !center || routing}>
          {routing ? <Loader2 size={16} className="spin" /> : <Navigation size={16} />}
          Traçar rota até o centro
        </button>
        {routeError && <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 12.5 }}><AlertCircle size={14} /> <span>{routeError}</span></div>}

        {rota && (
          <div className="card-soft between" style={{ padding: 14, gap: 10 }}>
            <div className="row" style={{ gap: 10 }}>
              <span className="icon-badge" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(37,99,235,0.12)', color: AZUL }}>
                <Navigation size={16} />
              </span>
              <div>
                <div className="t-h3" style={{ fontSize: 18, color: AZUL }}>{formatarDuracao(rota.duracaoMin)}</div>
                <div className="t-caption t-muted">{rota.distanciaKm.toFixed(1)} km · {MODOS.find((m) => m.id === rota.modo)?.label}</div>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }} onClick={limparRota} title="Limpar rota"><X size={14} /></button>
          </div>
        )}

        <div className="divider" />

        {/* Regiões salvas ------------------------------------------------- */}
        <div className="between">
          <div className="t-overline" style={{ color: 'var(--text-muted)' }}>Regiões salvas ({regioes.length})</div>
          <div className="row" style={{ gap: 10 }}>
            <label className="row clickable" style={{ gap: 6 }} title="Mostrar regiões no mapa">
              <input type="checkbox" checked={mostrarSalvas} onChange={(e) => setMostrarSalvas(e.target.checked)} style={{ accentColor: VERDE }} />
              <span className="t-caption t-muted">no mapa</span>
            </label>
            <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }} onClick={() => void carregar()} title="Recarregar"><RotateCcw size={14} /></button>
          </div>
        </div>

        {scrapingId ? (
          <div className="row t-caption t-muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> Raspando leads… pode levar alguns minutos.</div>
        ) : scrapeMsg ? (
          <div className="row" style={{ gap: 8, fontSize: 12.5, color: scrapeMsg.ok ? 'var(--tech-deep)' : 'var(--error)' }}>
            {scrapeMsg.ok ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />} <span>{scrapeMsg.text}</span>
          </div>
        ) : null}

        {loadingList ? (
          <div className="row t-caption t-muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> Carregando…</div>
        ) : listError ? (
          <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}><AlertCircle size={15} /> <span>{listError}</span></div>
        ) : regioes.length === 0 ? (
          <div className="t-caption t-faint">Nenhuma região ainda. Desenhe a primeira no mapa. 🛰️</div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {regioes.map((r) => (
              <div key={r.id} className={`region-item ${activeId === r.id ? 'is-active' : ''}`} onClick={() => handleSelecionar(r)} role="button" tabIndex={0}>
                <span className="icon-badge" style={{ width: 32, height: 32, borderRadius: 9 }}><Radar size={16} /></span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome ?? 'Sem nome'}</div>
                  <div className="t-caption t-muted">
                    <span className="tnum">{Number(r.raio_km)} km</span>
                    {r.segmento ? ` · ${r.segmento}` : ''}{` · ${r.leads_encontrados} leads`}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0, color: VERDE_DEEP }} onClick={(e) => { e.stopPropagation(); void handleRaspar(r); }} disabled={!!scrapingId} title="Raspar leads desta região (Apify)">
                  {scrapingId === r.id ? <Loader2 size={14} className="spin" /> : <DownloadCloud size={14} />}
                </button>
                <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0, color: 'var(--error)' }} onClick={(e) => { e.stopPropagation(); void handleExcluir(r); }} title="Excluir região"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Mapa --------------------------------------------------------------- */}
      <div className="map-canvas">
        {/* Busca de endereço (Nominatim) */}
        <div className="map-search">
          <form className="map-search-box" onSubmit={handleBuscar}>
            {searching ? <Loader2 size={16} className="spin" style={{ color: 'var(--text-faint)' }} /> : <Search size={16} style={{ color: 'var(--text-faint)' }} />}
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar endereço ou lugar…" aria-label="Buscar endereço" />
            {q && <button type="button" onClick={() => { setQ(''); setResults([]); }} className="btn btn-ghost btn-sm" style={{ width: 26, height: 26, padding: 0 }} aria-label="Limpar busca"><X size={14} /></button>}
          </form>
          {results.length > 0 && (
            <div className="map-search-results">
              {results.map((r, i) => <button key={i} className="map-search-result" onClick={() => selecionarBusca(r)}>{r.label}</button>)}
            </div>
          )}
        </div>

        {/* Botão flutuante de localização */}
        <button className="map-fab" style={{ left: 12, bottom: 24 }} onClick={handleLocalizar} disabled={locating} title="Minha localização">
          {locating ? <Loader2 size={16} className="spin" /> : <LocateFixed size={16} />}
          Onde estou
        </button>

        <MapContainer center={VISAO_INICIAL} zoom={11} scrollWheelZoom zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <ZoomControl position="topright" />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Ruas">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satélite">
              <TileLayer
                attribution='Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={19}
              />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Híbrido">
              <LayerGroup>
                <TileLayer
                  attribution='Tiles &copy; Esri'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={19}
                />
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
              </LayerGroup>
            </LayersControl.BaseLayer>
          </LayersControl>

          <ClickToSetCenter onSet={definirCentro} />
          <FlyTo target={focus} />

          {/* Regiões salvas (overlay informativo) */}
          {mostrarSalvas && regioes.filter((r) => r.id !== activeId).map((r) => (
            <Circle
              key={r.id}
              center={[Number(r.centro_lat), Number(r.centro_lng)]}
              radius={Number(r.raio_km) * 1000}
              pathOptions={{ color: CINZA, weight: 1, fillColor: CINZA, fillOpacity: 0.05, interactive: false }}
            >
              <Tooltip>{r.nome ?? 'Sem nome'}</Tooltip>
            </Circle>
          ))}

          {/* Região atual (centro + raio) */}
          {center && (
            <>
              <Circle center={[center.lat, center.lng]} radius={raioKm * 1000} pathOptions={{ color: VERDE_DEEP, weight: 2, fillColor: VERDE, fillOpacity: 0.12 }} />
              <CircleMarker center={[center.lat, center.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: VERDE, fillOpacity: 1 }} />
            </>
          )}

          {/* Minha localização */}
          {minhaLoc && (
            <CircleMarker center={[minhaLoc.lat, minhaLoc.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: AZUL, fillOpacity: 1 }}>
              <Tooltip>Você está aqui</Tooltip>
            </CircleMarker>
          )}

          {/* Rota */}
          {rota && <Polyline positions={rota.coords} pathOptions={{ color: AZUL, weight: 5, opacity: 0.85 }} />}
        </MapContainer>

        {!center && (
          <div style={{
            position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            zIndex: 1000, pointerEvents: 'none', background: 'var(--bg-elev)',
            border: '1px solid var(--border)', borderRadius: 999, padding: '8px 16px',
            boxShadow: 'var(--shadow-pop)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <Crosshair size={15} style={{ color: VERDE_DEEP }} /> Clique no mapa para marcar o centro
          </div>
        )}
      </div>
    </div>
  );
}
