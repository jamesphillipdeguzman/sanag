import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipality } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor } from '@/data/mockData';
import { MapPin, X } from 'lucide-react';

interface PanayMapProps {
  municipalities: Municipality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const statusLabels: Record<string, string> = {
  restored: 'Power Restored',
  recovering: 'Recovering',
  warning: 'Limited Power',
  critical: 'Critical Outage',
};

export default function PanayMap({ municipalities, selectedId, onSelect }: PanayMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const hovered = municipalities.find((m) => m.id === hoveredId);
  const selected = municipalities.find((m) => m.id === selectedId);

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      {/* Map */}
      <div className="lg:col-span-8">
        <div className="relative rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden">
          {/* Map header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <h3 className="text-sm font-semibold text-white">Panay Island — Nightlight Recovery Map</h3>
              <p className="text-xs text-ink-400 mt-0.5">NASA VIIRS radiance overlay · Municipal boundaries</p>
            </div>
            <div className="flex items-center gap-3">
              <LegendDot color="#10b981" label="Restored" />
              <LegendDot color="#599ffd" label="Recovering" />
              <LegendDot color="#fbbf24" label="Limited" />
              <LegendDot color="#f43f5e" label="Critical" />
            </div>
          </div>

          {/* Leaflet GeoJSON map */}
          <div className="relative dot-bg p-2">
            <LeafletMap
              municipalities={municipalities}
              selectedId={selectedId}
              onSelect={onSelect}
              onHover={setHoveredId}
            />

            {/* Hover tooltip */}
            {hovered && !selected && (
              <div className="absolute pointer-events-none top-4 left-4 glass rounded-xl px-4 py-3 max-w-xs animate-fade-in">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: getRecoveryColor(hovered.recoveryScore) }}
                  />
                  <span className="text-sm font-semibold text-white">{hovered.name}</span>
                  <span className="text-xs text-ink-400">{hovered.province}</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-ink-300">
                    Recovery: <span className="font-semibold text-white">{hovered.recoveryScore}%</span>
                  </span>
                  <span className="text-ink-300">
                    Status: <span style={{ color: getRecoveryStatusColor(hovered.status) }}>
                      {statusLabels[hovered.status]}
                    </span>
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mt-1.5">Click to view detailed recovery data</p>
              </div>
            )}
          </div>

          {/* Scale bar */}
          <div className="flex items-center gap-2 px-5 py-3 border-t border-white/10">
            <div className="flex h-2 w-32 rounded-full overflow-hidden">
              <div className="flex-1 bg-rose-500" />
              <div className="flex-1 bg-amber-400" />
              <div className="flex-1 bg-emerald-400" />
              <div className="flex-1 bg-emerald-500" />
            </div>
            <span className="text-xs text-ink-400">Recovery Score (0–100)</span>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      <div className="lg:col-span-4">
        {selected ? (
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm p-5 animate-slide-in">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-4 w-4 text-ocean-400" />
                  <span className="text-xs text-ink-400">{selected.province} Province</span>
                </div>
                <h3 className="text-xl font-bold text-white">{selected.name}</h3>
              </div>
              <button
                onClick={() => onSelect('')}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-white/10 hover:text-white transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Recovery gauge */}
            <div className="mb-5">
              <div className="flex items-end justify-between mb-2">
                <span className="text-xs text-ink-400 uppercase tracking-wider">Recovery Score</span>
                <span
                  className="text-3xl font-extrabold"
                  style={{ color: getRecoveryColor(selected.recoveryScore) }}
                >
                  {selected.recoveryScore}
                  <span className="text-lg text-ink-500">/100</span>
                </span>
              </div>
              <div className="h-3 rounded-full bg-ink-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selected.recoveryScore}%`,
                    backgroundColor: getRecoveryColor(selected.recoveryScore),
                  }}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: getRecoveryStatusColor(selected.status) }}
                />
                <span className="text-sm font-medium" style={{ color: getRecoveryStatusColor(selected.status) }}>
                  {statusLabels[selected.status]}
                </span>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <MiniStat label="Population" value={selected.population.toLocaleString()} />
              <MiniStat label="Days Since Event" value={selected.daysSinceEvent.toString()} />
              <MiniStat
                label="Baseline Radiance"
                value={`${selected.baselineRadiance.toFixed(1)} nW`}
              />
              <MiniStat
                label="Current Radiance"
                value={`${selected.currentRadiance.toFixed(1)} nW`}
              />
            </div>

            {/* Recovery projection */}
            <div className="rounded-xl bg-ink-950/50 border border-white/5 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-ink-400">Est. Days to Full Recovery</span>
                <span className="text-lg font-bold text-white">{selected.estimatedDaysToRecover}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-ink-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ocean-500 to-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.max(5, 100 - (selected.estimatedDaysToRecover / 20) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-ink-400 whitespace-nowrap">
                  {selected.estimatedDaysToRecover === 0 ? 'Fully restored' : `${selected.estimatedDaysToRecover}d remaining`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm p-5 h-full flex flex-col items-center justify-center text-center min-h-[300px]">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ocean-500/10 mb-4">
              <MapPin className="h-7 w-7 text-ocean-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Select a Municipality</h3>
            <p className="text-sm text-ink-400 max-w-xs">
              Click any town on the map to see its recovery score, radiance data, and projected timeline.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LeafletMap({
  municipalities,
  selectedId,
  onSelect,
  onHover,
}: {
  municipalities: Municipality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.Path>>({});

  useEffect(() => {
    if (!mapElement.current || mapRef.current || municipalities.length === 0) return;

    const map = L.map(mapElement.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    mapRef.current = map;

    fetch('/panay_municipalities.geojson')
      .then((response) => response.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        const municipalityById = new Map(municipalities.map((municipality) => [municipality.id, municipality]));
        const layer = L.geoJSON(geojson, {
          style: (feature) => {
            const id = String(feature?.properties?.ADM3_PCODE ?? '');
            const municipality = municipalityById.get(id);
            const color = getRecoveryColor(municipality?.recoveryScore ?? 40);
            return {
              color: 'rgba(255,255,255,0.3)',
              weight: 1,
              fillColor: color,
              fillOpacity: 0.62,
            };
          },
          onEachFeature: (feature, featureLayer) => {
            const id = String(feature.properties?.ADM3_PCODE ?? '');
            const municipality = municipalityById.get(id);
            if (!municipality || !(featureLayer instanceof L.Path)) return;

            layersRef.current[id] = featureLayer;
            featureLayer.bindTooltip(`${municipality.name} · ${municipality.recoveryScore}% recovery`, {
              sticky: true,
              direction: 'top',
            });
            featureLayer.on({
              click: () => onSelect(id),
              mouseover: () => {
                onHover(id);
                featureLayer.setStyle({ weight: 2, fillOpacity: 0.9 });
              },
              mouseout: () => {
                onHover(null);
                updateLayerStyle(featureLayer, municipality, false);
              },
            });
          },
        }).addTo(map);

        map.fitBounds(layer.getBounds(), { padding: [18, 18] });
      });

    return () => {
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
  }, [municipalities, onHover, onSelect]);

  useEffect(() => {
    Object.entries(layersRef.current).forEach(([id, layer]) => {
      const municipality = municipalities.find((item) => item.id === id);
      if (municipality) updateLayerStyle(layer, municipality, id === selectedId);
    });
  }, [municipalities, selectedId]);

  return <div ref={mapElement} className="leaflet-map" aria-label="Panay municipality recovery map" />;
}

function updateLayerStyle(layer: L.Path, municipality: Municipality, selected: boolean) {
  layer.setStyle({
    color: selected ? '#ffffff' : 'rgba(255,255,255,0.3)',
    weight: selected ? 2.5 : 1,
    fillColor: getRecoveryColor(municipality.recoveryScore),
    fillOpacity: selected ? 0.95 : 0.62,
  });
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-ink-400 hidden sm:inline">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-ink-950/50 border border-white/5 p-3">
      <p className="text-[11px] text-ink-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
