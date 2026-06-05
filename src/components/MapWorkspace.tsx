import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Map, { Source, Layer, Marker, Popup, type MapRef, type MapLayerMouseEvent } from '@vis.gl/react-maplibre';
import circle from '@turf/circle';
import {
  Search, X, Loader2, Crosshair, RotateCcw, Save, DownloadCloud, CheckCircle2, AlertCircle,
  LocateFixed, Navigation, Layers, Plus, Minus, KeyRound, Check, Star, Globe, ChevronLeft,
  Car, Bike, Footprints, MapPin, Eye, ArrowRight,
} from 'lucide-react';
import { createRegiao, type NovaRegiao } from '../lib/radarRegioes';
import { rasparRegiao, getApifyToken, setApifyToken, type ResultadoRaspagem } from '../lib/scrape';
import { listLeadsByRegiao, type LeadMapa } from '../lib/leads';
import {
  getMinhaLocalizacao, buscarEndereco, tracarRota, formatarDuracao,
  type ModoRota, type Rota, type GeocodeResult,
} from '../lib/geo';
import { STREETS_STYLE, SATELLITE_STYLE, type Basemap } from '../lib/mapStyles';
import type { RadarRegiao } from '../types/database';

const COR_SCORE: Record<string, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };
const SEGMENTOS = ['Oficina mecânica', 'Auto elétrica', 'Funilaria e pintura', 'Centro automotivo', 'Borracharia', 'Troca de óleo', 'Lava-rápido', 'Acessórios e som'];
const CHIPS = ['Oficina mecânica', 'Auto elétrica', 'Borracharia', 'Centro automotivo'];
const QTDS = [20, 50, 100];
const MODOS: { id: ModoRota; label: string; Icon: typeof Car }[] = [
  { id: 'carro', label: 'Carro', Icon: Car }, { id: 'bici', label: 'Bici', Icon: Bike }, { id: 'pe', label: 'A pé', Icon: Footprints },
];
const LOGS = ['Conectando ao Apify…', 'Varrendo o raio no Google Maps…', 'Encontrando comércios…', 'Salvando no CRM…'];

type ScrapeState = { status: 'running' | 'done' | 'error'; result?: ResultadoRaspagem; error?: string };
type Props = {
  regions: RadarRegiao[];
  reloadRegions: () => void;
  activeRegionId: string | null;
  setActiveRegionId: (id: string | null) => void;
  focusLatLng: { lat: number; lng: number } | null;
  clearFocus: () => void;
  onGoLeads: () => void;
};

function zoomForRaio(km: number) { return Math.max(8, Math.min(15, Math.round(13 - Math.log2(Math.max(km, 0.5))))); }

function Stepper({ active }: { active: 1 | 2 | 3 }) {
  const steps = [{ n: 1, label: 'Região' }, { n: 2, label: 'Raspar' }, { n: 3, label: 'Revisar' }] as const;
  return (
    <div className="orc-stepper">
      {steps.map((s) => {
        const cls = s.n < active ? 'done' : s.n === active ? 'active' : '';
        return <div key={s.n} className={`orc-step ${cls}`}><div className="orc-step-bar" /><div className="orc-step-label">{s.n < active ? <Check size={11} strokeWidth={3} /> : null}{s.label}</div></div>;
      })}
    </div>
  );
}

export function MapWorkspace({ regions, reloadRegions, activeRegionId, setActiveRegionId, focusLatLng, clearFocus, onGoLeads }: Props) {
  const mapRef = useRef<MapRef>(null);
  const [basemap, setBasemap] = useState<Basemap>('streets');
  const [mapCenter, setMapCenter] = useState<[number, number]>([-46.6333, -23.5505]);
  const [pinned, setPinned] = useState<[number, number] | null>(null);
  const effectiveCenter = pinned ?? mapCenter;
  const [raioKm, setRaioKm] = useState(5);
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('Oficina mecânica');
  const [guideMode, setGuideMode] = useState<'draw' | 'ready'>('draw');
  const [collapsed, setCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tokenInput, setTokenInput] = useState(getApifyToken());
  const [tokenSaved, setTokenSaved] = useState(!!getApifyToken());
  const [maxLeads, setMaxLeads] = useState(50);

  const [scrape, setScrape] = useState<ScrapeState | null>(null);
  const [logIdx, setLogIdx] = useState(0);

  const [leads, setLeads] = useState<LeadMapa[]>([]);
  const leadsRef = useRef(leads); leadsRef.current = leads;
  const [selectedLead, setSelectedLead] = useState<LeadMapa | null>(null);

  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const skipSearch = useRef(false);

  const [minhaLoc, setMinhaLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [modo, setModo] = useState<ModoRota>('carro');
  const [rota, setRota] = useState<Rota | null>(null);
  const [routing, setRouting] = useState(false);

  const activeRegion = useMemo(() => regions.find((r) => r.id === activeRegionId) ?? null, [regions, activeRegionId]);
  const guideModeRef = useRef(guideMode); guideModeRef.current = guideMode;
  const regionsRef = useRef(regions); regionsRef.current = regions;

  // Garante que o MapLibre conheça o tamanho real do container (o mount pode
  // ocorrer antes do layout flex resolver a altura → mapa fica sem pedir tiles).
  useEffect(() => {
    const ts = [60, 250, 600, 1200].map((d) => window.setTimeout(() => mapRef.current?.resize(), d));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, []);

  // Roda só quando a região ATIVA muda (não a cada reload da lista).
  useEffect(() => {
    if (!activeRegionId) { setGuideMode('draw'); setScrape(null); setLeads([]); return; }
    setGuideMode('ready'); setScrape(null);
    const r = regionsRef.current.find((x) => x.id === activeRegionId);
    if (!r) return;
    setSegmento(r.segmento ?? 'Oficina mecânica');
    setRaioKm(Number(r.raio_km));
    mapRef.current?.flyTo({ center: [Number(r.centro_lng), Number(r.centro_lat)], zoom: zoomForRaio(Number(r.raio_km)), duration: 900 });
    void (async () => { try { setLeads(await listLeadsByRegiao(r.nome)); } catch { setLeads([]); } })();
  }, [activeRegionId]);

  useEffect(() => {
    if (focusLatLng) { mapRef.current?.flyTo({ center: [focusLatLng.lng, focusLatLng.lat], zoom: 16, duration: 900 }); clearFocus(); }
  }, [focusLatLng, clearFocus]);

  // Preview da busca enquanto digita (debounced).
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    if (q.trim().length < 3) { setResults([]); return; }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try { setResults(await buscarEndereco(q)); } catch { setResults([]); } finally { setSearching(false); }
    }, 450);
    return () => window.clearTimeout(t);
  }, [q]);

  // Círculo da região (verde) -------------------------------------------------
  const circleCenter: [number, number] = guideMode === 'draw' || !activeRegion
    ? effectiveCenter
    : [Number(activeRegion.centro_lng), Number(activeRegion.centro_lat)];
  const circleRadius = guideMode === 'draw' || !activeRegion ? raioKm : Number(activeRegion.raio_km);
  const circleGeo = useMemo(() => circle(circleCenter, circleRadius, { steps: 96, units: 'kilometers' }), [circleCenter[0], circleCenter[1], circleRadius]);

  const leadsGeo = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: leads.filter((l) => l.latitude != null && l.longitude != null).map((l) => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [l.longitude as number, l.latitude as number] }, properties: { id: l.id, score_cor: l.score_cor },
    })),
  }), [leads]);

  const routeGeo = useMemo(() => rota ? ({ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: rota.coords.map(([la, ln]) => [ln, la]) }, properties: {} }) : null, [rota]);

  function fitToLeads(ls: LeadMapa[]) {
    const pts = ls.filter((l) => l.latitude != null && l.longitude != null);
    if (pts.length === 0) return;
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    for (const l of pts) { minX = Math.min(minX, l.longitude!); maxX = Math.max(maxX, l.longitude!); minY = Math.min(minY, l.latitude!); maxY = Math.max(maxY, l.latitude!); }
    mapRef.current?.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, maxZoom: 15, duration: 800 });
  }

  // Handlers ------------------------------------------------------------------
  function novaRegiao() { setActiveRegionId(null); setGuideMode('draw'); setScrape(null); setLeads([]); setPinned(null); setNome(''); }

  async function salvarRegiao() {
    if (saving) return;
    setSaving(true);
    const nova: NovaRegiao = { nome: nome.trim() || null, centro_lat: Number(effectiveCenter[1].toFixed(6)), centro_lng: Number(effectiveCenter[0].toFixed(6)), raio_km: raioKm, segmento: segmento.trim() || null };
    try {
      const criada = await createRegiao(nova);
      setNome(''); setPinned(null);
      reloadRegions();
      setActiveRegionId(criada.id); // efeito leva pra ready
    } catch (e) { alert(e instanceof Error ? e.message : 'Falha ao salvar.'); }
    finally { setSaving(false); }
  }

  function salvarToken() { setApifyToken(tokenInput); setTokenSaved(!!tokenInput.trim()); }

  async function raspar() {
    if (!activeRegion) return;
    setScrape({ status: 'running' }); setLogIdx(0);
    const timer = window.setInterval(() => setLogIdx((i) => (i + 1) % LOGS.length), 7000);
    try {
      const result = await rasparRegiao(activeRegion.id, maxLeads);
      setScrape({ status: 'done', result });
      reloadRegions();
      const fresh = await listLeadsByRegiao(activeRegion.nome);
      setLeads(fresh);
      fitToLeads(fresh);
    } catch (e) {
      setScrape({ status: 'error', error: e instanceof Error ? e.message : 'Falha na raspagem.' });
    } finally { window.clearInterval(timer); }
  }

  async function localizar() {
    setLocating(true);
    try { const loc = await getMinhaLocalizacao(); setMinhaLoc(loc); mapRef.current?.flyTo({ center: [loc.lng, loc.lat], zoom: 14, duration: 800 }); }
    catch (e) { alert(e instanceof Error ? e.message : 'Não consegui te localizar.'); }
    finally { setLocating(false); }
  }

  async function tracar(m: ModoRota) {
    if (!minhaLoc) { await localizar(); return; }
    setModo(m); setRouting(true);
    const dest = activeRegion ? { lat: Number(activeRegion.centro_lat), lng: Number(activeRegion.centro_lng) } : { lat: effectiveCenter[1], lng: effectiveCenter[0] };
    try { setRota(await tracarRota(minhaLoc, dest, m)); }
    catch (e) { alert(e instanceof Error ? e.message : 'Falha na rota.'); setRota(null); }
    finally { setRouting(false); }
  }

  async function buscar(e: FormEvent) {
    e.preventDefault();
    if (q.trim().length < 3) return;
    setSearching(true);
    try { setResults(await buscarEndereco(q)); } catch { setResults([]); } finally { setSearching(false); }
  }
  function irPara(r: GeocodeResult) {
    setPinned([r.lng, r.lat]); setGuideMode('draw'); setActiveRegionId(null);
    mapRef.current?.flyTo({ center: [r.lng, r.lat], zoom: 14, duration: 900 });
    setResults([]); skipSearch.current = true; setQ(r.label.split(',').slice(0, 2).join(',').trim());
  }

  const stepActive: 1 | 2 | 3 = scrape?.status === 'done' ? 3 : guideMode === 'draw' ? 1 : 2;
  const showMira = guideMode === 'draw' && !pinned && !scrape;

  return (
    <div className="map-screen">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: -46.6333, latitude: -23.5505, zoom: 11 }}
        mapStyle={basemap === 'streets' ? STREETS_STYLE : SATELLITE_STYLE}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
        interactiveLayerIds={['leads-pts']}
        onLoad={(e) => { e.target.resize(); }}
        onMoveEnd={(e) => { const c = e.target.getCenter(); setMapCenter([c.lng, c.lat]); }}
        onClick={(e: MapLayerMouseEvent) => {
          const feat = e.features?.[0];
          if (feat && feat.layer.id === 'leads-pts') { const id = feat.properties?.id as string; const lead = leadsRef.current.find((l) => l.id === id); if (lead) setSelectedLead(lead); return; }
          if (guideModeRef.current === 'draw' && !scrape) setPinned([e.lngLat.lng, e.lngLat.lat]);
        }}
      >
        <Source id="region" type="geojson" data={circleGeo}>
          <Layer id="region-fill" type="fill" paint={{ 'fill-color': '#00C46A', 'fill-opacity': 0.10 }} />
          <Layer id="region-line" type="line" paint={{ 'line-color': '#00A058', 'line-width': 2, 'line-dasharray': [2, 1] }} />
        </Source>

        {routeGeo && (
          <Source id="route" type="geojson" data={routeGeo}>
            <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#2563EB', 'line-width': 5, 'line-opacity': 0.85 }} />
          </Source>
        )}

        <Source id="leads" type="geojson" data={leadsGeo}>
          <Layer id="leads-pts" type="circle" paint={{
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 4, 16, 8],
            'circle-color': ['match', ['get', 'score_cor'], 'verde', '#00C46A', 'amarelo', '#F59E0B', 'vermelho', '#EF4444', '#94A3B8'],
            'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff', 'circle-opacity': 0.95,
          }} />
        </Source>

        {minhaLoc && <Marker longitude={minhaLoc.lng} latitude={minhaLoc.lat}><span style={{ width: 16, height: 16, borderRadius: '50%', background: '#2563EB', border: '3px solid #fff', boxShadow: '0 0 0 4px rgba(37,99,235,0.25)', display: 'block' }} /></Marker>}

        {selectedLead && selectedLead.latitude != null && (
          <Popup longitude={selectedLead.longitude as number} latitude={selectedLead.latitude as number} anchor="bottom" offset={14} closeOnClick={false} onClose={() => setSelectedLead(null)} maxWidth="280px">
            <div className={`lead-popup s-${selectedLead.score_cor}`}>
              <div className="lp-name">{selectedLead.nome_empresa}</div>
              {selectedLead.nota_media != null && <div className="lp-row"><Star size={12} fill="#F59E0B" color="#F59E0B" /> {selectedLead.nota_media} · {selectedLead.num_avaliacoes} avaliações</div>}
              {selectedLead.telefone && <div className="lp-row"><MapPin size={12} /> {selectedLead.telefone}</div>}
              {selectedLead.endereco && <div className="lp-row" style={{ alignItems: 'flex-start' }}>{selectedLead.endereco}</div>}
              <div className="lp-actions">
                {selectedLead.link_maps && <a className="lp-btn" href={selectedLead.link_maps} target="_blank" rel="noreferrer"><Globe size={13} /> Ver no Maps</a>}
                {selectedLead.tem_site && <span className="lp-btn" style={{ cursor: 'default' }}>tem site</span>}
              </div>
            </div>
          </Popup>
        )}
      </Map>

      {/* Mira central (modo desenhar) */}
      {showMira && <div className="map-crosshair"><Crosshair size={30} strokeWidth={1.75} /></div>}

      {/* Busca */}
      <div className="map-search2">
        <form className="map-search-box" onSubmit={buscar}>
          {searching ? <Loader2 size={16} className="spin" style={{ color: 'var(--text-faint)' }} /> : <Search size={16} style={{ color: 'var(--text-faint)' }} />}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar endereço ou lugar…" aria-label="Buscar" />
          {q && <button type="button" className="btn btn-ghost btn-sm" style={{ width: 26, height: 26, padding: 0 }} onClick={() => { setQ(''); setResults([]); }}><X size={14} /></button>}
        </form>
        {results.length > 0 && <div className="map-search-results glass">{results.map((r, i) => <button key={i} className="map-search-result" onClick={() => irPara(r)}>{r.label}</button>)}</div>}
      </div>

      {/* Painel-Guia */}
      {collapsed ? (
        <button className="guide-pill glass" onClick={() => setCollapsed(false)} title="Abrir painel"><ChevronLeft size={20} style={{ transform: 'rotate(180deg)' }} /></button>
      ) : (
        <div className="guide-panel glass">
          <div className="between">
            <Stepper active={stepActive} />
            <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0, marginLeft: 8 }} onClick={() => setCollapsed(true)} title="Recolher"><ChevronLeft size={16} /></button>
          </div>

          {scrape ? (
            scrape.status === 'running' ? (
              <div className="col" style={{ gap: 14, alignItems: 'center', textAlign: 'center', padding: '6px 0' }}>
                <span className="radar-mark" style={{ width: 72, height: 72 }}><span className="radar-ring" /><span className="radar-ring r2" /><span className="radar-ring r3" /><span className="radar-sweep" /><span className="radar-core" /></span>
                <div className="t-h3">Raspando leads…</div>
                <div className="dock-progress" style={{ width: '100%' }} />
                <div className="t-caption t-muted">{LOGS[logIdx]}</div>
                <div className="t-caption t-faint">Pode deixar rodando — te aviso quando terminar.</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(true)}>Rodar em segundo plano</button>
              </div>
            ) : scrape.status === 'done' ? (
              <div className="col" style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: '6px 0' }}>
                <span className="icon-badge" style={{ width: 52, height: 52, borderRadius: 15 }}><CheckCircle2 size={28} /></span>
                <div className="big-num">{scrape.result!.inseridos}</div>
                <div className="t-h3" style={{ fontSize: 16 }}>leads novos salvos</div>
                <div className="t-caption t-muted">{scrape.result!.total} lugares encontrados · {scrape.result!.duplicados} já existiam.</div>
                <div className="row" style={{ gap: 8, marginTop: 4 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => fitToLeads(leads)}><Eye size={15} /> Ver no mapa</button>
                  <button className="btn btn-primary btn-sm" onClick={onGoLeads}>Revisar leads <ArrowRight size={15} /></button>
                </div>
              </div>
            ) : (
              <div className="col" style={{ gap: 10, alignItems: 'center', textAlign: 'center', padding: '6px 0' }}>
                <span className="icon-badge" style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--error-soft)', color: 'var(--error)' }}><AlertCircle size={28} /></span>
                <div className="t-h3" style={{ fontSize: 16 }}>Não deu pra raspar</div>
                <div className="t-caption t-muted">{scrape.error}</div>
                {/token|apify/i.test(scrape.error ?? '') && <div className="t-caption t-faint">Confira seu token do Apify abaixo.</div>}
                <button className="btn btn-primary btn-sm" onClick={() => void raspar()}><RotateCcw size={15} /> Tentar de novo</button>
              </div>
            )
          ) : guideMode === 'draw' ? (
            <>
              <div><div className="t-overline">Passo 1 de 3</div><div className="t-h2" style={{ fontSize: 19 }}>Onde você quer prospectar?</div><div className="t-caption t-muted" style={{ marginTop: 2 }}>Arraste o mapa pra mirar o centro e ajuste o raio.</div></div>
              <div className="field">
                <label className="field-label">Raio: <span className="tnum">{raioKm} km</span></label>
                <input className="range" type="range" min={1} max={50} value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))} />
              </div>
              <div className="field">
                <label className="field-label">O que procurar</label>
                <input className="input" list="segs" value={segmento} onChange={(e) => setSegmento(e.target.value)} placeholder="Ex.: Oficina mecânica" />
                <datalist id="segs">{SEGMENTOS.map((s) => <option key={s} value={s} />)}</datalist>
                <div className="row-wrap" style={{ gap: 6, marginTop: 4 }}>{CHIPS.map((c) => <button key={c} className="badge badge-outline" style={{ cursor: 'pointer' }} onClick={() => setSegmento(c)}>{c}</button>)}</div>
              </div>
              <div className="field">
                <label className="field-label">Nome da região (opcional)</label>
                <input className="input" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Zona Sul — São Paulo" />
              </div>
              <div className="card-soft row" style={{ gap: 10, padding: 10 }}>
                <MapPin size={15} style={{ color: '#00A058', flexShrink: 0 }} />
                <div className="grow mono-code" style={{ fontSize: 11.5 }}>{effectiveCenter[1].toFixed(5)}, {effectiveCenter[0].toFixed(5)}</div>
                {pinned ? <button className="btn btn-ghost btn-sm" style={{ width: 28, padding: 0 }} onClick={() => setPinned(null)} title="Soltar"><RotateCcw size={13} /></button> : <span className="t-caption t-faint">meio do mapa</span>}
              </div>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => void salvarRegiao()} disabled={saving}>
                {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />} Continuar pra raspagem
              </button>
            </>
          ) : (
            <>
              <div><div className="t-overline">Passo 2 de 3</div><div className="t-h2" style={{ fontSize: 19 }}>{activeRegion?.nome ?? 'Região'}</div>
                <div className="row" style={{ gap: 6, marginTop: 4 }}>
                  <span className="badge badge-neutral"><span className="tnum">{Number(activeRegion?.raio_km)} km</span></span>
                  {activeRegion?.segmento && <span className="badge badge-neutral">{activeRegion.segmento}</span>}
                  <span className="badge badge-success">{activeRegion?.leads_encontrados ?? 0} leads</span>
                </div>
              </div>
              <div className="card-soft row" style={{ gap: 12, padding: 14 }}>
                <span className="icon-badge" style={{ flexShrink: 0 }}><DownloadCloud size={18} /></span>
                <div className="t-caption">Vamos buscar <strong>{activeRegion?.segmento || 'comércios'}</strong> nesta região no Google Maps. Leva 1 a 2 minutos.</div>
              </div>
              {!tokenSaved && (
                <div className="card-soft col" style={{ gap: 8, padding: 12, borderLeft: '3px solid var(--warning)' }}>
                  <span className="row" style={{ gap: 6, fontWeight: 600, fontSize: 12.5 }}><KeyRound size={14} /> Pra raspar, cole seu token do Apify</span>
                  <div className="row" style={{ gap: 6 }}>
                    <input className="input" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="apify_api_..." autoComplete="off" />
                    <button className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }} onClick={salvarToken}>Salvar</button>
                  </div>
                </div>
              )}
              {tokenSaved && <div className="t-caption t-faint" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Check size={13} color="#00A058" /> Token conectado</div>}
              <div className="field">
                <label className="field-label">Quantos leads buscar?</label>
                <div className="seg">{QTDS.map((n) => <button key={n} className={`seg-item ${maxLeads === n ? 'is-on' : ''}`} onClick={() => setMaxLeads(n)}>{n}</button>)}</div>
                <div className="field-hint">Mais leads = mais tempo e mais créditos do Apify.</div>
              </div>
              <button className="btn btn-primary btn-block btn-lg" onClick={() => void raspar()} disabled={!tokenSaved}><DownloadCloud size={18} /> Raspar {maxLeads} leads</button>
              <button className="btn btn-ghost btn-sm" onClick={novaRegiao}><Plus size={15} /> Nova região</button>
            </>
          )}
        </div>
      )}

      {/* FABs */}
      <div className="fab-cluster">
        <button className="fab glass" onClick={() => setBasemap((b) => (b === 'streets' ? 'satellite' : 'streets'))} title={basemap === 'streets' ? 'Satélite' : 'Ruas'}><Layers size={18} /></button>
        <button className="fab glass" onClick={() => setRouteOpen((o) => !o)} title="Rota até o centro"><Navigation size={18} /></button>
        <button className="fab glass" onClick={() => void localizar()} disabled={locating} title="Onde estou">{locating ? <Loader2 size={18} className="spin" /> : <LocateFixed size={18} />}</button>
        <div className="fab-stack glass">
          <button className="fab" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></button>
          <button className="fab" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></button>
        </div>
      </div>

      {/* Dock — rota (raspagem aparece no painel) */}
      {routeOpen && !scrape && (
        <div className="map-dock glass">
          <div className="between" style={{ marginBottom: rota ? 12 : 0 }}>
            <div className="seg" style={{ width: 'auto' }}>{MODOS.map(({ id, label, Icon }) => <button key={id} className={`seg-item ${modo === id ? 'is-on' : ''}`} onClick={() => void tracar(id)} style={{ flex: '0 0 auto', padding: '0 12px' }}><Icon size={14} /> {label}</button>)}</div>
            <button className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }} onClick={() => { setRouteOpen(false); setRota(null); }}><X size={15} /></button>
          </div>
          {routing ? <div className="row t-caption t-muted" style={{ gap: 8 }}><Loader2 size={14} className="spin" /> Calculando rota…</div>
            : rota ? <div className="row" style={{ gap: 10 }}><span className="t-h2" style={{ color: '#2563EB' }}>{formatarDuracao(rota.duracaoMin)}</span><span className="t-caption t-muted">{rota.distanciaKm.toFixed(1)} km de {minhaLoc ? 'você' : 'sua localização'} até o centro</span></div>
            : <div className="t-caption t-muted">Escolha o meio de transporte pra ver o tempo até o centro da região.</div>}
        </div>
      )}
    </div>
  );
}
