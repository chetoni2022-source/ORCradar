import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import {
  Radar, MapPin, Save, Loader2, Trash2, RotateCcw, Crosshair,
  CheckCircle2, AlertCircle, Search,
} from 'lucide-react';
import {
  listRegioes, createRegiao, deleteRegiao, type NovaRegiao,
} from '../lib/radarRegioes';
import type { RadarRegiao } from '../types/database';

// Centro inicial da visão do mapa (São Paulo). O usuário clica pra marcar o
// centro da região; isso é independente da visão inicial.
const VISAO_INICIAL: [number, number] = [-23.5505, -46.6333];

const SEGMENTOS = [
  'Oficina mecânica', 'Auto elétrica', 'Funilaria e pintura', 'Centro automotivo',
  'Borracharia', 'Troca de óleo', 'Lava-rápido', 'Acessórios e som',
];

const VERDE = '#00C46A';
const VERDE_DEEP = '#00A058';

type LatLng = { lat: number; lng: number };

function zoomForRaio(km: number): number {
  const z = Math.round(13 - Math.log2(Math.max(km, 0.5)));
  return Math.max(7, Math.min(14, z));
}

/** Captura cliques no mapa pra definir o centro da região. */
function ClickToSetCenter({ onSet }: { onSet: (p: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onSet({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

/** Move o mapa programaticamente quando focamos uma região salva. */
function FlyTo({ target }: { target: { lat: number; lng: number; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function RadarMapPage() {
  const [center, setCenter] = useState<LatLng | null>(null);
  const [raioKm, setRaioKm] = useState(5);
  const [nome, setNome] = useState('');
  const [segmento, setSegmento] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  const [regioes, setRegioes] = useState<RadarRegiao[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ lat: number; lng: number; zoom: number } | null>(null);

  const carregar = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      setRegioes(await listRegioes());
    } catch (e) {
      setListError(e instanceof Error ? e.message : 'Falha ao carregar regiões.');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

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

  return (
    <div className="map-shell">
      {/* Painel de controles ------------------------------------------------ */}
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
          <input
            id="nome" className="input" value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Zona Sul — São Paulo"
          />
        </div>

        <div className="field">
          <label className="field-label" htmlFor="segmento">Segmento (opcional)</label>
          <div className="input-icon-wrap">
            <Search size={16} className="input-icon" />
            <input
              id="segmento" className="input" list="segmentos" value={segmento}
              onChange={(e) => setSegmento(e.target.value)}
              placeholder="Ex.: Oficina mecânica"
            />
          </div>
          <datalist id="segmentos">
            {SEGMENTOS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </div>

        <div className="field">
          <label className="field-label">Raio: <span className="tnum">{raioKm} km</span></label>
          <input
            className="range" type="range" min={1} max={50} step={1}
            value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))}
          />
          <div className="between t-caption t-faint"><span>1 km</span><span>50 km</span></div>
        </div>

        {center ? (
          <div className="card-soft row" style={{ gap: 10, padding: 12 }}>
            <MapPin size={16} style={{ color: VERDE_DEEP, flexShrink: 0 }} />
            <div className="grow mono-code" style={{ fontSize: 12 }}>
              {center.lat.toFixed(5)}, {center.lng.toFixed(5)}
            </div>
            <button
              className="btn btn-ghost btn-sm" style={{ width: 30, padding: 0 }}
              onClick={() => { setCenter(null); setActiveId(null); }}
              title="Limpar centro"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        ) : (
          <div className="card-soft row" style={{ gap: 10, padding: 12, color: 'var(--text-muted)' }}>
            <Crosshair size={16} style={{ flexShrink: 0 }} />
            <div className="t-caption">Clique no mapa para marcar o centro.</div>
          </div>
        )}

        {saveError && (
          <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}>
            <AlertCircle size={15} /> <span>{saveError}</span>
          </div>
        )}

        <button
          className="btn btn-primary btn-block"
          onClick={handleSalvar}
          disabled={!center || saving}
        >
          {saving ? <Loader2 size={17} className="spin" /> : savedFlash ? <CheckCircle2 size={17} /> : <Save size={17} />}
          {saving ? 'Salvando…' : savedFlash ? 'Região salva!' : 'Salvar região'}
        </button>

        <div className="divider" />

        {/* Regiões salvas -------------------------------------------------- */}
        <div className="between">
          <div className="t-overline" style={{ color: 'var(--text-muted)' }}>
            Regiões salvas ({regioes.length})
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => void carregar()} title="Recarregar">
            <RotateCcw size={14} />
          </button>
        </div>

        {loadingList ? (
          <div className="row t-caption t-muted" style={{ gap: 8 }}>
            <Loader2 size={14} className="spin" /> Carregando…
          </div>
        ) : listError ? (
          <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}>
            <AlertCircle size={15} /> <span>{listError}</span>
          </div>
        ) : regioes.length === 0 ? (
          <div className="t-caption t-faint">Nenhuma região ainda. Desenhe a primeira no mapa. 🛰️</div>
        ) : (
          <div className="col" style={{ gap: 8 }}>
            {regioes.map((r) => (
              <div
                key={r.id}
                className={`region-item ${activeId === r.id ? 'is-active' : ''}`}
                onClick={() => handleSelecionar(r)}
                role="button"
                tabIndex={0}
              >
                <span className="icon-badge" style={{ width: 32, height: 32, borderRadius: 9 }}>
                  <Radar size={16} />
                </span>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="t-body" style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.nome ?? 'Sem nome'}
                  </div>
                  <div className="t-caption t-muted">
                    <span className="tnum">{Number(r.raio_km)} km</span>
                    {r.segmento ? ` · ${r.segmento}` : ''}
                    {` · ${r.leads_encontrados} leads`}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: 30, padding: 0, color: 'var(--error)' }}
                  onClick={(e) => { e.stopPropagation(); void handleExcluir(r); }}
                  title="Excluir região"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Mapa --------------------------------------------------------------- */}
      <div className="map-canvas">
        <MapContainer center={VISAO_INICIAL} zoom={11} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToSetCenter onSet={(p) => { setCenter(p); setActiveId(null); }} />
          <FlyTo target={focus} />
          {center && (
            <>
              <Circle
                center={[center.lat, center.lng]}
                radius={raioKm * 1000}
                pathOptions={{ color: VERDE_DEEP, weight: 2, fillColor: VERDE, fillOpacity: 0.12 }}
              />
              <CircleMarker
                center={[center.lat, center.lng]}
                radius={7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: VERDE, fillOpacity: 1 }}
              />
            </>
          )}
        </MapContainer>

        {!center && (
          <div
            style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              zIndex: 1000, pointerEvents: 'none',
              background: 'var(--bg-elev)', border: '1px solid var(--border)',
              borderRadius: 999, padding: '8px 16px', boxShadow: 'var(--shadow-pop)',
              fontSize: 13, fontWeight: 600, color: 'var(--text)',
              display: 'inline-flex', alignItems: 'center', gap: 8,
            }}
          >
            <Crosshair size={15} style={{ color: VERDE_DEEP }} /> Clique no mapa para marcar o centro
          </div>
        )}
      </div>
    </div>
  );
}
