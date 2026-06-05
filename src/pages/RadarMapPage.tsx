import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  MapContainer, TileLayer, Circle, CircleMarker, Polyline, Tooltip, Popup,
  LayersControl, LayerGroup, ZoomControl, useMap, useMapEvents,
} from 'react-leaflet';
import {
  Radar, MapPin, Save, Loader2, Trash2, RotateCcw, Crosshair, CheckCircle2,
  AlertCircle, Search, X, LocateFixed, Navigation, Car, Bike, Footprints,
  DownloadCloud, Eye, KeyRound, ChevronDown, Star, Globe,
} from 'lucide-react';
import { listRegioes, createRegiao, deleteRegiao, type NovaRegiao } from '../lib/radarRegioes';
import { rasparRegiao, getApifyToken, setApifyToken, type ResultadoRaspagem } from '../lib/scrape';
import { listLeadsByRegiao, type LeadMapa } from '../lib/leads';
import {
  getMinhaLocalizacao, buscarEndereco, tracarRota, formatarDuracao,
  type LatLng, type ModoRota, type Rota, type GeocodeResult,
} from '../lib/geo';
import { RadarMark } from '../components/RadarMark';
import type { RadarRegiao } from '../types/database';

const VISAO_INICIAL: [number, number] = [-23.5505, -46.6333]; // São Paulo
const VERDE = '#00C46A';
const VERDE_DEEP = '#00A058';
const AZUL = '#2563EB';
const CINZA = '#94A3B8';
const COR_SCORE: Record<string, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };

const SEGMENTOS = [
  'Oficina mecânica', 'Auto elétrica', 'Funilaria e pintura', 'Centro automotivo',
  'Borracharia', 'Troca de óleo', 'Lava-rápido', 'Acessórios e som',
];

const MODOS: { id: ModoRota; label: string; Icon: typeof Car }[] = [
  { id: 'carro', label: 'Carro', Icon: Car },
  { id: 'bici', label: 'Bici', Icon: Bike },
  { id: 'pe', label: 'A pé', Icon: Footprints },
];

type ScrapeState = {
  regiao: RadarRegiao;
  status: 'running' | 'done' | 'error';
  result?: ResultadoRaspagem;
  error?: string;
};

function zoomForRaio(km: number): number {
  return Math.max(7, Math.min(14, Math.round(13 - Math.log2(Math.max(km, 0.5)))));
}

function ClickToSetCenter({ onSet }: { onSet: (p: LatLng) => void }) {
  useMapEvents({ click(e) { onSet({ lat: e.latlng.lat, lng: e.latlng.lng }); } });
  return null;
}
function FlyTo({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.6 }); }, [target, map]);
  return null;
}
function TrackCenter({ onMove }: { onMove: (c: LatLng) => void }) {
  const map = useMapEvents({ moveend() { const c = map.getCenter(); onMove({ lat: c.lat, lng: c.lng }); } });
  return null;
}

export function RadarMapPage() {
  // Região --------------------------------------------------------------
  const [center, setCenter] = useState<LatLng | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>({ lat: VISAO_INICIAL[0], lng: VISAO_INICIAL[1] });
  const [raioKm, setRaioKm] = useState(5);
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('Oficina mecânica');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const effectiveCenter = center ?? mapCenter;

  // Lista de regiões ----------------------------------------------------
  const [regioes, setRegioes] = useState<RadarRegiao[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mostrarSalvas, setMostrarSalvas] = useState(true);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  // Token Apify ---------------------------------------------------------
  const [tokenInput, setTokenInput] = useState(getApifyToken());
  const [tokenSaved, setTokenSaved] = useState(!!getApifyToken());

  // Raspagem (modal) e leads -------------------------------------------
  const [scrape, setScrape] = useState<ScrapeState | null>(null);
  const [leads, setLeads] = useState<LeadMapa[]>([]);
  const [mostrarLeads, setMostrarLeads] = useState(true);

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

  const carregarLeads = useCallback(async (nomeRegiao: string | null) => {
    try { setLeads(await listLeadsByRegiao(nomeRegiao)); }
    catch { setLeads([]); }
  }, []);

  function definirCentro(p: LatLng) { setCenter(p); setActiveId(null); limparRota(); }

  async function handleSalvar() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    const nova: NovaRegiao = {
      nome: nome.trim() || null,
      centro_lat: Number(effectiveCenter.lat.toFixed(6)),
      centro_lng: Number(effectiveCenter.lng.toFixed(6)),
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
    void carregarLeads(r.nome);
  }

  async function handleExcluir(r: RadarRegiao) {
    if (!window.confirm(`Excluir a região "${r.nome ?? 'sem nome'}"? Os leads já salvos continuam no CRM.`)) return;
    try {
      await deleteRegiao(r.id);
      if (activeId === r.id) { setActiveId(null); setLeads([]); }
      await carregar();
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao excluir.');
    }
  }

  async function handleRaspar(r: RadarRegiao) {
    setScrape({ regiao: r, status: 'running' });
    try {
      const result = await rasparRegiao(r.id);
      setScrape({ regiao: r, status: 'done', result });
      await carregar();
    } catch (e) {
      setScrape({ regiao: r, status: 'error', error: e instanceof Error ? e.message : 'Falha na raspagem.' });
    }
  }

  function verNoMapa(r: RadarRegiao) {
    setScrape(null);
    handleSelecionar(r);
  }

  function salvarToken() {
    setApifyToken(tokenInput);
    setTokenSaved(!!tokenInput.trim());
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
    if (!minhaLoc) { setRouteError('Use sua localização primeiro (botão "Onde estou").'); return; }
    setRouting(true);
    setRouteError(null);
    try { setRota(await tracarRota(minhaLoc, effectiveCenter, m)); }
    catch (e) { setRouteError(e instanceof Error ? e.message : 'Falha na rota.'); setRota(null); }
    finally { setRouting(false); }
  }
  function escolherModo(m: ModoRota) { setModo(m); if (minhaLoc) void tracar(m); }

  return (
    <div className="map-shell">
      {/* Painel ------------------------------------------------------------ */}
      <aside className="map-panel col" style={{ gap: 18 }}>
        {/* Passo 1 — região */}
        <div className="step-block">
          <div className="step-head">
            <span className="step-badge">1</span>
            <div>
              <div className="t-h3" style={{ fontSize: 16 }}>Escolha a região</div>
              <div className="t-caption t-muted">Posicione a mira e ajuste o raio.</div>
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="nome">Nome da região</label>
            <input id="nome" className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Zona Sul — São Paulo" />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="segmento">O que procurar</label>
            <input id="segmento" className="input" list="segmentos" value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Oficina mecânica" />
            <datalist id="segmentos">{SEGMENTOS.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div className="field">
            <label className="field-label">Raio: <span className="tnum">{raioKm} km</span></label>
            <input className="range" type="range" min={1} max={50} step={1} value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))} />
            <div className="between t-caption t-faint"><span>1 km</span><span>50 km</span></div>
          </div>

          <div className="card-soft row" style={{ gap: 10, padding: 12 }}>
            <MapPin size={16} style={{ color: VERDE_DEEP, flexShrink: 0 }} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="mono-code" style={{ fontSize: 12 }}>{effectiveCenter.lat.toFixed(5)}, {effectiveCenter.lng.toFixed(5)}</div>
              <div className="t-caption t-faint" style={{ marginTop: 2 }}>{center ? 'ponto fixado no mapa' : 'centro = meio do mapa (arraste pra posicionar)'}</div>
            </div>
            {center && (
              <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }} onClick={() => { setCenter(null); setActiveId(null); limparRota(); }} title="Soltar — voltar pro meio do mapa"><RotateCcw size={14} /></button>
            )}
          </div>

          {saveError && <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}><AlertCircle size={15} /> <span>{saveError}</span></div>}

          <button className="btn btn-primary btn-block btn-lg" onClick={handleSalvar} disabled={saving}>
            {saving ? <Loader2 size={18} className="spin" /> : savedFlash ? <CheckCircle2 size={18} /> : <Save size={18} />}
            {saving ? 'Salvando…' : savedFlash ? 'Região salva!' : 'Salvar região'}
          </button>
        </div>

        {/* Token Apify */}
        <div className={`card-soft token-box ${tokenSaved ? '' : 'is-warn'}`}>
          <div className="between">
            <span className="row" style={{ gap: 6, fontWeight: 600, fontSize: 13 }}><KeyRound size={14} /> Token do Apify</span>
            <span className={`badge ${tokenSaved ? 'badge-success' : 'badge-warning'}`}>{tokenSaved ? 'configurado' : 'necessário'}</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="apify_api_..." autoComplete="off" />
            <button className="btn btn-secondary btn-sm" onClick={salvarToken} style={{ flexShrink: 0 }}>Salvar</button>
          </div>
          <div className="t-caption t-faint">Fica só no seu navegador, enviado direto pra função. Necessário pra raspar os leads.</div>
        </div>

        <div className="divider" />

        {/* Passo 2 — regiões + raspar */}
        <div className="step-block">
          <div className="step-head">
            <span className="step-badge">2</span>
            <div className="grow">
              <div className="t-h3" style={{ fontSize: 16 }}>Raspe os leads</div>
              <div className="t-caption t-muted">{regioes.length} região(ões) salva(s).</div>
            </div>
            {leads.length > 0 && (
              <label className="row clickable" style={{ gap: 6 }} title="Mostrar leads no mapa">
                <input type="checkbox" checked={mostrarLeads} onChange={(e) => setMostrarLeads(e.target.checked)} style={{ accentColor: VERDE }} />
                <span className="t-caption t-muted">leads</span>
              </label>
            )}
          </div>

          {loadingList ? (
            <div className="row t-caption t-muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> Carregando…</div>
          ) : listError ? (
            <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}><AlertCircle size={15} /> <span>{listError}</span></div>
          ) : regioes.length === 0 ? (
            <div className="card-soft t-caption t-muted" style={{ padding: 14 }}>Nenhuma região ainda. Salve a primeira acima pra poder raspar. 🛰️</div>
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {regioes.map((r) => (
                <div key={r.id} className={`region-card ${activeId === r.id ? 'is-active' : ''}`}>
                  <div className="region-card-head" onClick={() => handleSelecionar(r)} role="button" tabIndex={0}>
                    <span className="icon-badge" style={{ width: 34, height: 34, borderRadius: 9 }}><Radar size={17} /></span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="t-body" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome ?? 'Sem nome'}</div>
                      <div className="t-caption t-muted">
                        <span className="tnum">{Number(r.raio_km)} km</span>{r.segmento ? ` · ${r.segmento}` : ''} · <strong style={{ color: 'var(--tech-deep)' }}>{r.leads_encontrados} leads</strong>
                      </div>
                    </div>
                  </div>
                  <div className="region-card-actions">
                    <button className="btn btn-soft btn-sm" onClick={() => void handleRaspar(r)}><DownloadCloud size={15} /> Raspar leads</button>
                    <button className="btn btn-ghost btn-sm" style={{ width: 34, padding: 0, flex: '0 0 auto' }} onClick={() => handleSelecionar(r)} title="Ver no mapa"><Eye size={15} /></button>
                    <button className="btn btn-ghost btn-sm" style={{ width: 34, padding: 0, flex: '0 0 auto', color: 'var(--error)' }} onClick={() => void handleExcluir(r)} title="Excluir região"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Localização e rota (recolhível) */}
        <details className="collapse">
          <summary>
            <span className="icon-badge" style={{ width: 30, height: 30, borderRadius: 8 }}><Navigation size={16} /></span>
            <div>
              <div className="t-h3" style={{ fontSize: 14 }}>Localização e rota</div>
              <div className="t-caption t-faint">Tempo de carro/bici/a pé até o centro</div>
            </div>
            <ChevronDown size={16} className="chev" />
          </summary>
          <div className="col" style={{ gap: 12, paddingTop: 12 }}>
            <button className="btn btn-secondary btn-block" onClick={handleLocalizar} disabled={locating}>
              {locating ? <Loader2 size={16} className="spin" /> : <LocateFixed size={16} />}
              {minhaLoc ? 'Atualizar minha localização' : 'Usar minha localização'}
            </button>
            {locError && <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 12.5 }}><AlertCircle size={14} /> <span>{locError}</span></div>}
            <div className="seg" role="group" aria-label="Meio de locomoção">
              {MODOS.map(({ id, label, Icon }) => (
                <button key={id} className={`seg-item ${modo === id ? 'is-on' : ''}`} onClick={() => escolherModo(id)}><Icon size={15} /> {label}</button>
              ))}
            </div>
            <button className="btn btn-soft btn-block" onClick={() => void tracar(modo)} disabled={!minhaLoc || routing}>
              {routing ? <Loader2 size={16} className="spin" /> : <Navigation size={16} />} Traçar rota até o centro
            </button>
            {routeError && <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 12.5 }}><AlertCircle size={14} /> <span>{routeError}</span></div>}
            {rota && (
              <div className="card-soft between" style={{ padding: 14, gap: 10 }}>
                <div className="row" style={{ gap: 10 }}>
                  <span className="icon-badge" style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(37,99,235,0.12)', color: AZUL }}><Navigation size={16} /></span>
                  <div>
                    <div className="t-h3" style={{ fontSize: 18, color: AZUL }}>{formatarDuracao(rota.duracaoMin)}</div>
                    <div className="t-caption t-muted">{rota.distanciaKm.toFixed(1)} km · {MODOS.find((m) => m.id === rota.modo)?.label}</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }} onClick={limparRota} title="Limpar rota"><X size={14} /></button>
              </div>
            )}
          </div>
        </details>
      </aside>

      {/* Mapa -------------------------------------------------------------- */}
      <div className="map-canvas">
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

        <button className="map-fab" style={{ left: 12, bottom: 24 }} onClick={handleLocalizar} disabled={locating} title="Minha localização">
          {locating ? <Loader2 size={16} className="spin" /> : <LocateFixed size={16} />} Onde estou
        </button>

        <MapContainer center={VISAO_INICIAL} zoom={11} scrollWheelZoom zoomControl={false} style={{ height: '100%', width: '100%' }}>
          <ZoomControl position="topright" />
          <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Ruas">
              <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" subdomains="abcd" />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Satélite">
              <TileLayer attribution='Tiles &copy; Esri, Maxar' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
            </LayersControl.BaseLayer>
            <LayersControl.BaseLayer name="Híbrido">
              <LayerGroup>
                <TileLayer attribution='Tiles &copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
                <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}" maxZoom={19} />
              </LayerGroup>
            </LayersControl.BaseLayer>
          </LayersControl>

          <ClickToSetCenter onSet={definirCentro} />
          <TrackCenter onMove={setMapCenter} />
          <FlyTo target={focus} />

          {mostrarSalvas && regioes.filter((r) => r.id !== activeId).map((r) => (
            <Circle key={r.id} center={[Number(r.centro_lat), Number(r.centro_lng)]} radius={Number(r.raio_km) * 1000}
              pathOptions={{ color: CINZA, weight: 1, fillColor: CINZA, fillOpacity: 0.05, interactive: false }}>
              <Tooltip>{r.nome ?? 'Sem nome'}</Tooltip>
            </Circle>
          ))}

          <Circle center={[effectiveCenter.lat, effectiveCenter.lng]} radius={raioKm * 1000} pathOptions={{ color: VERDE_DEEP, weight: 2, fillColor: VERDE, fillOpacity: 0.12 }} />
          {center && <CircleMarker center={[center.lat, center.lng]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: VERDE, fillOpacity: 1 }} />}

          {/* Leads raspados */}
          {mostrarLeads && leads.map((l) => (
            <CircleMarker key={l.id} center={[l.latitude as number, l.longitude as number]} radius={6}
              pathOptions={{ color: '#fff', weight: 1.5, fillColor: COR_SCORE[l.score_cor] ?? CINZA, fillOpacity: 0.95 }}>
              <Popup>
                <div className="lead-pop-title">{l.nome_empresa}</div>
                {l.nota_media != null && <div className="lead-pop-row"><Star size={12} fill="#F59E0B" color="#F59E0B" /> {l.nota_media} · {l.num_avaliacoes} avaliações</div>}
                {l.telefone && <div className="lead-pop-row">📞 {l.telefone}</div>}
                <div className="lead-pop-row" style={{ gap: 12, marginTop: 6 }}>
                  {l.link_maps && <a className="lead-pop-link" href={l.link_maps} target="_blank" rel="noreferrer">Ver no Maps</a>}
                  {l.tem_site && <span className="lead-pop-row" style={{ margin: 0 }}><Globe size={12} /> tem site</span>}
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {minhaLoc && (
            <CircleMarker center={[minhaLoc.lat, minhaLoc.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: AZUL, fillOpacity: 1 }}>
              <Tooltip>Você está aqui</Tooltip>
            </CircleMarker>
          )}
          {rota && <Polyline positions={rota.coords} pathOptions={{ color: AZUL, weight: 5, opacity: 0.85 }} />}
        </MapContainer>

        {!center && (
          <>
            <div className="map-crosshair"><Crosshair size={30} strokeWidth={1.75} /></div>
            <div style={{
              position: 'absolute', bottom: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
              pointerEvents: 'none', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 999,
              padding: '8px 16px', boxShadow: 'var(--shadow-pop)', fontSize: 13, fontWeight: 600, color: 'var(--text)',
              display: 'inline-flex', alignItems: 'center', gap: 8, maxWidth: 'calc(100% - 24px)',
            }}>
              <Crosshair size={15} style={{ color: VERDE_DEEP, flexShrink: 0 }} /> Arraste o mapa pra posicionar · clique pra fixar
            </div>
          </>
        )}
      </div>

      {/* Modal de raspagem ------------------------------------------------- */}
      {scrape && (
        <div className="scrape-wrap">
          <div className="backdrop" onClick={() => { if (scrape.status !== 'running') setScrape(null); }} />
          <div className="modal-card scrape-modal">
            {scrape.status === 'running' ? (
              <>
                <RadarMark size={84} />
                <div className="t-h2">Raspando leads…</div>
                <div className="t-body t-muted">
                  Buscando <strong>{scrape.regiao.segmento || 'estabelecimentos'}</strong> num raio de {Number(scrape.regiao.raio_km)} km em volta de <strong>{scrape.regiao.nome ?? 'sua região'}</strong>.
                </div>
                <div className="row" style={{ gap: 8, color: 'var(--text-faint)', fontSize: 13 }}>
                  <Loader2 size={15} className="spin" /> Leva 1–2 minutos — não feche esta janela.
                </div>
              </>
            ) : scrape.status === 'done' ? (
              <>
                <span className="icon-badge" style={{ width: 56, height: 56, borderRadius: 16 }}><CheckCircle2 size={30} /></span>
                <div className="big-num">{scrape.result!.inseridos}</div>
                <div className="t-h3">leads salvos!</div>
                <div className="t-body t-muted">{scrape.result!.total} lugares encontrados · {scrape.result!.duplicados} já existiam no CRM.</div>
                <div className="row" style={{ gap: 10, marginTop: 6 }}>
                  <button className="btn btn-primary" onClick={() => verNoMapa(scrape.regiao)}><Eye size={16} /> Ver no mapa</button>
                  <button className="btn btn-secondary" onClick={() => setScrape(null)}>Fechar</button>
                </div>
              </>
            ) : (
              <>
                <span className="icon-badge" style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--error-soft)', color: 'var(--error)' }}><AlertCircle size={30} /></span>
                <div className="t-h3">Não deu pra raspar</div>
                <div className="t-body t-muted">{scrape.error}</div>
                {/Token do Apify|APIFY/i.test(scrape.error ?? '') && (
                  <div className="t-caption t-faint">Cole seu token no campo <strong>“Token do Apify”</strong> no painel e tente de novo.</div>
                )}
                <div className="row" style={{ gap: 10, marginTop: 6 }}>
                  <button className="btn btn-primary" onClick={() => void handleRaspar(scrape.regiao)}><RotateCcw size={16} /> Tentar de novo</button>
                  <button className="btn btn-secondary" onClick={() => setScrape(null)}>Fechar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
