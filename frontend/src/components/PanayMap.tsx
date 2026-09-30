import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipality, GdacsAlert } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor } from '@/data/mockData';
import { Lock, Loader2, MapPin, Radio, RotateCcw, X } from 'lucide-react';

interface PanayMapProps {
  municipalities: Municipality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  recoveryDate?: string | null;
  isLoading?: boolean;
  gdacsAlerts?: GdacsAlert[];
  activeEventId?: string | null;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
}

const statusLabels: Record<string, string> = {
  restored: 'Power Restored',
  recovering: 'Recovering',
  warning: 'Limited Power',
  critical: 'Critical Outage',
};

function MapLoadingSkeleton() {
  return (
    <div
      className="leaflet-map relative flex flex-col items-center justify-center p-6 text-center overflow-hidden border border-white/5 bg-ink-950/70 select-none"
      aria-label="Loading Panay Island nightlight telemetry"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-60">
        <div className="absolute w-[440px] h-[440px] rounded-full border border-ocean-500/10 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute w-[320px] h-[320px] rounded-full border border-ocean-500/15" />
        <div className="absolute w-[200px] h-[200px] rounded-full border border-ocean-500/20" />
        <div className="absolute w-[90px] h-[90px] rounded-full border border-ocean-500/30" />
        <div className="absolute w-2 h-2 rounded-full bg-ocean-400 shadow-[0_0_12px_#70b0ff]" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-sm">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-ocean-500/10 border border-ocean-500/30 mb-3.5 shadow-[0_0_25px_rgba(89,159,253,0.18)]">
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <Radio className="h-6 w-6 text-ocean-400 animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/15 px-3 py-1 mb-2.5">
          <Loader2 className="h-3 w-3 text-ocean-300 animate-spin" />
          <span className="text-[11px] font-semibold text-ocean-200 uppercase tracking-wider">
            Loading Satellite Telemetry
          </span>
        </div>

        <h4 className="text-base font-bold text-white tracking-tight">
          Calibrating Panay Island Grid
        </h4>
        <p className="text-xs text-ink-300 mt-1 leading-relaxed">
          Retrieving VIIRS radiance baselines and computing spatial restoration indexes across 93 LGUs...
        </p>

        <div className="w-52 h-1.5 bg-ink-800/80 rounded-full mt-4 overflow-hidden relative border border-white/5">
          <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-ocean-400 to-emerald-400 rounded-full animate-shimmer" />
        </div>

        <div className="flex items-center gap-1.5 mt-3.5 text-[10px] text-ink-400 font-medium">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">Iloilo</span>
          <span className="text-ink-600">·</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">Capiz</span>
          <span className="text-ink-600">·</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">Aklan</span>
          <span className="text-ink-600">·</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">Antique</span>
        </div>
      </div>
    </div>
  );
}

export default function PanayMap({
  municipalities,
  selectedId,
  onSelect,
  recoveryDate,
  isLoading = false,
  gdacsAlerts = [],
  activeEventId,
  onSimulateGdacs,
}: PanayMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showGdacsMarkers, setShowGdacsMarkers] = useState(true);

  const hovered = municipalities.find((m) => m.id === hoveredId);
  const selected = municipalities.find((m) => m.id === selectedId);

  const alertsWithCoords = (gdacsAlerts || []).filter(
    (a) => (a.latitude != null && a.longitude != null) || (a.coordinates && a.coordinates.length >= 2)
  );

  return (
    <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
      {/* Map */}
      <div className="lg:col-span-8 flex flex-col">
        <div className="relative rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden flex flex-col h-full shadow-xl">
          {/* Map header */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3.5 border-b border-white/10 bg-ink-950/40">
            <div>
              <h3 className="text-sm font-semibold text-white">Panay Island — Nightlight Recovery Map</h3>
              <p className="text-xs text-ink-400 mt-0.5">
                NASA VIIRS radiance overlay · 93 Municipal boundaries
                {recoveryDate ? ` · Latest reading: ${recoveryDate}` : ''}
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {alertsWithCoords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowGdacsMarkers(!showGdacsMarkers)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                    showGdacsMarkers
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                      : 'bg-white/5 text-ink-400 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                  title="Toggle live GDACS hazard epicenter markers on map"
                >
                  <Radio className={`h-3 w-3 ${showGdacsMarkers ? 'text-rose-400 animate-pulse' : 'text-ink-400'}`} />
                  <span>Live Hazards ({alertsWithCoords.length})</span>
                </button>
              )}
              <LegendDot color="#10b981" label="Restored" />
              <LegendDot color="#599ffd" label="Recovering" />
              <LegendDot color="#fbbf24" label="Limited" />
              <LegendDot color="#f43f5e" label="Critical" />
            </div>
          </div>

          {/* Leaflet GeoJSON map */}
          <div className="relative dot-bg p-2 flex-1 min-h-[360px] flex flex-col justify-center">
            {isLoading || municipalities.length === 0 ? (
              <MapLoadingSkeleton />
            ) : (
              <>
                <LeafletMap
                  municipalities={municipalities}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onHover={setHoveredId}
                  gdacsAlerts={gdacsAlerts}
                  showGdacsMarkers={showGdacsMarkers}
                  activeEventId={activeEventId}
                  onSimulateGdacs={onSimulateGdacs}
                />

                {/* Hover tooltip */}
                {hovered && !selected && (
                  <div className="absolute pointer-events-none bottom-4 left-4 z-[1001] glass rounded-xl px-4 py-3 max-w-xs animate-fade-in shadow-2xl">
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
                    <p className="text-[11px] text-ink-400 mt-1.5">Click municipality to pin telemetry</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scale bar */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-white/10 bg-ink-950/40">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-28 sm:w-36 rounded-full overflow-hidden">
                <div className="flex-1 bg-rose-500" />
                <div className="flex-1 bg-amber-400" />
                <div className="flex-1 bg-ocean-400" />
                <div className="flex-1 bg-emerald-500" />
              </div>
              <span className="text-[11px] text-ink-400">Recovery Score (0–100)</span>
            </div>
            <span className="text-[11px] text-ink-400 hidden sm:inline">
              Projection model: VIIRS-DNB vs Pre-event Baseline
            </span>
          </div>
        </div>
      </div>

      {/* Detail side panel */}
      <div className="lg:col-span-4 flex flex-col">
        {selected ? (
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm p-5 animate-slide-in flex flex-col justify-between h-full shadow-xl">
            <div>
              <div className="flex items-start justify-between pb-3 mb-4 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-ocean-400" />
                    <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{selected.province} Province</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-white">{selected.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect('')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                  title="Deselect municipality"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Recovery gauge */}
              <div className="mb-5 bg-ink-950/50 rounded-xl p-3.5 border border-white/5">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Recovery Indicator</span>
                  <span
                    className="text-3xl font-black tracking-tight"
                    style={{ color: getRecoveryColor(selected.recoveryScore) }}
                  >
                    {selected.recoveryScore}
                    <span className="text-base text-ink-500 font-normal">/100</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-ink-800 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${selected.recoveryScore}%`,
                      backgroundColor: getRecoveryColor(selected.recoveryScore),
                    }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: getRecoveryStatusColor(selected.status) }}
                    />
                    <span className="font-semibold" style={{ color: getRecoveryStatusColor(selected.status) }}>
                      {statusLabels[selected.status]}
                    </span>
                  </div>
                  <span className="text-ink-400">Target: 90%+ restored</span>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <MiniStat label="Population" value={selected.population.toLocaleString()} />
                <MiniStat label="Days Elapsed" value={`${selected.daysSinceEvent}d`} />
                <MiniStat
                  label="Baseline Radiance"
                  value={`${selected.baselineRadiance.toFixed(1)} nW`}
                />
                <MiniStat
                  label="Observed Radiance"
                  value={`${selected.currentRadiance.toFixed(1)} nW`}
                />
              </div>
            </div>

            {/* Recovery projection */}
            <div className="rounded-xl bg-ink-950/50 border border-white/5 p-3.5 mt-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-ink-400">Est. Full Restoration</span>
                <span className="text-base font-bold text-white">
                  {selected.estimatedDaysToRecover === 0 ? 'Restored' : `~${selected.estimatedDaysToRecover} days`}
                </span>
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
                <span className="text-[11px] text-ink-400 whitespace-nowrap">
                  {selected.estimatedDaysToRecover === 0 ? '100% capacity' : `${selected.estimatedDaysToRecover}d remaining`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm p-5 h-full flex flex-col justify-between shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                Municipality Telemetry
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-ocean-500/10 text-ocean-300 border border-ocean-500/20">
                Panay Grid
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 mb-3 shadow-inner">
                <MapPin className="h-6 w-6 text-ocean-400 animate-bounce" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">Select an LGU Boundary</h4>
              <p className="text-xs text-ink-400 max-w-xs leading-relaxed">
                Click any municipality polygon or live hazard epicenter on the map to pin its satellite radiance indicators.
              </p>

              {/* Quick sample town buttons */}
              <div className="mt-5 w-full">
                <span className="text-[11px] font-semibold text-ink-400 uppercase tracking-wider block mb-2">
                  Quick Select Major Hubs
                </span>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {['PH063022000', 'PH060407000', 'PH061914000', 'PH060613000'].map((pcode) => {
                    const m = municipalities.find((item) => item.id === pcode);
                    if (!m) return null;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelect(m.id)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-ocean-500/20 hover:border-ocean-500/40 text-ink-300 hover:text-white transition-all cursor-pointer"
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 text-[11px] text-ink-400 text-center">
              Covers 93 LGUs in Iloilo, Capiz, Aklan, and Antique
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isMobileOrTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.innerWidth < 768 ||
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

function LeafletMap({
  municipalities,
  selectedId,
  onSelect,
  onHover,
  gdacsAlerts = [],
  showGdacsMarkers = true,
  activeEventId,
  onSimulateGdacs,
}: {
  municipalities: Municipality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  gdacsAlerts?: GdacsAlert[];
  showGdacsMarkers?: boolean;
  activeEventId?: string | null;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
}) {
  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<Record<string, L.Path>>({});
  const gdacsGroupRef = useRef<L.LayerGroup | null>(null);
  const defaultBoundsRef = useRef<L.LatLngBounds | null>(null);

  // Default mobile view to locked so users can scroll past without getting trapped
  const [isLocked, setIsLocked] = useState<boolean>(() => isMobileOrTouchDevice());

  const resetToPanayBounds = (animate = true) => {
    const map = mapRef.current;
    if (!map) return;
    if (defaultBoundsRef.current) {
      map.fitBounds(defaultBoundsRef.current, { padding: [18, 18], animate });
    } else {
      map.setView([11.2, 122.5], 8, { animate });
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
  };

  const handleLock = () => {
    setIsLocked(true);
    resetToPanayBounds(true);
  };

  const handleReset = () => {
    resetToPanayBounds(true);
  };

  // Sync Leaflet drag, touch, and zoom handlers with lock state
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (isLocked) {
      map.dragging?.disable();
      map.touchZoom?.disable();
      map.doubleClickZoom?.disable();
      map.boxZoom?.disable();
    } else {
      map.dragging?.enable();
      map.touchZoom?.enable();
      map.doubleClickZoom?.enable();
      map.boxZoom?.enable();
    }
  }, [isLocked]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current || municipalities.length === 0) return;

    const initialLocked = isMobileOrTouchDevice();
    const map = L.map(mapElement.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      dragging: !initialLocked,
      touchZoom: !initialLocked,
      doubleClickZoom: !initialLocked,
      boxZoom: !initialLocked,
    });
    mapRef.current = map;

    // Dedicated layer group for GDACS live hazard pins and impact zones
    const gdacsGroup = L.layerGroup().addTo(map);
    gdacsGroupRef.current = gdacsGroup;

    let disposed = false;

    fetch('/panay_municipalities.geojson')
      .then((response) => response.json())
      .then((geojson: GeoJSON.FeatureCollection) => {
        if (disposed || mapRef.current !== map) return;

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

        const bounds = layer.getBounds();
        if (!disposed && mapRef.current === map && bounds.isValid()) {
          defaultBoundsRef.current = bounds;
          map.fitBounds(bounds, { padding: [18, 18] });
        }
      })
      .catch(() => {
        // Ignore aborted or unavailable map data during component cleanup.
      });

    return () => {
      disposed = true;
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
      gdacsGroupRef.current = null;
    };
  }, [municipalities, onHover, onSelect]);

  // Update GeoJSON polygon styles on selection change
  useEffect(() => {
    Object.entries(layersRef.current).forEach(([id, layer]) => {
      const municipality = municipalities.find((item) => item.id === id);
      if (municipality) updateLayerStyle(layer, municipality, id === selectedId);
    });
  }, [municipalities, selectedId]);

  // Render distinct color-coded GDACS hazard markers and interactive popups
  useEffect(() => {
    const group = gdacsGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!showGdacsMarkers || !gdacsAlerts || gdacsAlerts.length === 0) return;

    gdacsAlerts.forEach((alert) => {
      const lat = alert.latitude ?? alert.coordinates?.[0];
      const lng = alert.longitude ?? alert.coordinates?.[1];
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

      const alertLvl = (alert.alert_level || 'Green').toLowerCase();
      const color = alertLvl === 'red' ? '#f43f5e' : alertLvl === 'orange' ? '#f59e0b' : '#10b981';
      const isActive =
        activeEventId === alert.id ||
        activeEventId === `gdacs-${alert.event_id}` ||
        activeEventId === String(alert.event_id);

      const iconHtml = `
        <div class="gdacs-marker-container ${isActive ? 'is-active' : ''}">
          <div class="gdacs-marker-pulse" style="background-color: ${color};"></div>
          <div class="gdacs-marker-core" style="background: radial-gradient(circle, ${color}, #080d16); border-color: ${color};">
            <div class="gdacs-marker-dot" style="background-color: ${color};"></div>
          </div>
          ${isActive ? `<div class="gdacs-marker-halo" style="border-color: ${color};"></div>` : ''}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-gdacs-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -18],
      });

      const marker = L.marker([lat, lng], {
        icon: customIcon,
        zIndexOffset: isActive ? 1200 : 800,
        title: `${alert.name} (${alert.alert_level} Alert)`,
      });

      // Concentric radar circle around hazard epicenter
      const circleRadius = alert.type === 'TC' ? 38000 : alert.type === 'EQ' ? 22000 : 15000;
      const circle = L.circle([lat, lng], {
        radius: circleRadius,
        color: color,
        weight: 1.5,
        opacity: 0.5,
        fillColor: color,
        fillOpacity: 0.07,
        dashArray: '4, 6',
      });
      group.addLayer(circle);

      // Build Interactive Leaflet Popup with direct DOM click listeners
      const popupContainer = document.createElement('div');
      popupContainer.className = 'gdacs-popup-content p-3.5 text-ink-100 max-w-[285px] font-sans';
      popupContainer.innerHTML = `
        <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-white/10">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" 
                style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}45;">
            ${alert.alert_level || 'Green'} Alert
          </span>
          <span class="text-[10px] text-ink-400 font-mono">${alert.type || 'HAZARD'}</span>
        </div>
        <h4 class="text-xs font-bold text-white mb-1 leading-snug">${alert.name}</h4>
        <p class="text-[11px] text-ink-300 mb-2.5 leading-relaxed line-clamp-2">${alert.description || ''}</p>
        <div class="bg-black/50 rounded-lg p-2 mb-2.5 border border-white/5 space-y-1 text-[10px]">
          <div class="flex items-center justify-between text-ink-300">
            <span class="text-ink-400">Coordinates:</span>
            <span class="font-mono text-white font-medium">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span>
          </div>
          <div class="flex items-center justify-between text-ink-300">
            <span class="text-ink-400">Date:</span>
            <span class="text-white">${alert.date}</span>
          </div>
          ${alert.severity_text ? `
          <div class="flex items-center justify-between text-amber-300 font-medium pt-0.5 border-t border-white/5">
            <span class="text-ink-400">Severity:</span>
            <span class="truncate ml-1 font-semibold">${alert.severity_text}</span>
          </div>` : ''}
        </div>
        <div class="action-btn-placeholder"></div>
      `;

      const btnPlaceholder = popupContainer.querySelector('.action-btn-placeholder');
      if (btnPlaceholder && onSimulateGdacs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        if (isActive) {
          btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1.5 cursor-default';
          btn.innerHTML = '<span>✓ Active Simulation</span>';
        } else {
          btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-ocean-600 to-ocean-500 hover:from-ocean-500 hover:to-ocean-400 shadow-md shadow-ocean-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95';
          btn.innerHTML = '<span>Simulate Event</span>';
          btn.onclick = (e) => {
            e.stopPropagation();
            marker.closePopup();
            onSimulateGdacs(alert);
          };
        }
        btnPlaceholder.appendChild(btn);
      }

      marker.bindPopup(popupContainer, {
        className: 'gdacs-leaflet-popup',
        maxWidth: 290,
      });

      group.addLayer(marker);
    });
  }, [gdacsAlerts, showGdacsMarkers, activeEventId, onSimulateGdacs]);

  return (
    <div className="relative w-full overflow-hidden rounded-xl">
      <div
        ref={mapElement}
        className={`leaflet-map ${isLocked ? 'is-locked' : 'is-unlocked'}`}
        aria-label="Panay municipality recovery map"
      />

      {/* Sleek UI overlay controls */}
      <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
        {isLocked ? (
          <button
            type="button"
            onClick={handleUnlock}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ink-950/90 hover:bg-ink-900 text-ocean-300 hover:text-white border border-ocean-500/35 hover:border-ocean-400/60 shadow-lg shadow-black/50 backdrop-blur-md transition-all text-xs font-semibold cursor-pointer active:scale-95 group focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
            aria-label="Unlock map to interact, pan, and zoom"
            title="Unlock map to pan and zoom"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ocean-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-ocean-500"></span>
            </span>
            <Lock className="w-3.5 h-3.5 text-ocean-400 group-hover:text-ocean-300 transition-colors" />
            <span>Tap to Interact</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-950/90 hover:bg-ink-900 text-ink-300 hover:text-white border border-white/10 hover:border-white/25 shadow-lg shadow-black/50 backdrop-blur-md transition-all text-xs font-medium cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
              aria-label="Reset map view to Panay Island"
              title="Re-center on Panay Island"
            >
              <RotateCcw className="w-3.5 h-3.5 text-ink-400" />
              <span className="hidden sm:inline">Reset View</span>
              <span className="sm:hidden">Reset</span>
            </button>

            <button
              type="button"
              onClick={handleLock}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ocean-500/20 hover:bg-ocean-500/30 text-ocean-200 hover:text-white border border-ocean-500/40 hover:border-ocean-400/70 shadow-lg shadow-black/50 backdrop-blur-md transition-all text-xs font-semibold cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
              aria-label="Lock map viewport and re-center on Panay Island"
              title="Lock map and re-center on Panay Island"
            >
              <Lock className="w-3.5 h-3.5 text-ocean-300" />
              <span>Lock Map</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
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
