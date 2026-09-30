import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipality, GdacsAlert } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor, createMunicipalities } from '@/data/mockData';
import { Compass, Globe, Lock, Loader2, MapPin, Radio, RotateCcw, X, Layers, Volume2, VolumeX } from 'lucide-react';
import { useAudioSpatialIndicator, type EmergencyAudioStatus } from '@/utils/audioSpatialIndicator';
import { useTheme } from '@/context/ThemeContext';

export interface RegionPreset {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  islandGroup: 'Panay' | 'Nationwide' | 'Luzon' | 'Visayas' | 'Mindanao';
}

export const REGION_PRESETS: Record<string, RegionPreset> = {
  panay: { id: 'panay', name: 'Panay Island (Default)', center: [11.0, 122.5], zoom: 8, islandGroup: 'Panay' },
  iloilo: { id: 'iloilo', name: 'Iloilo Province', center: [11.0050, 122.5373], zoom: 9, islandGroup: 'Panay' },
  capiz: { id: 'capiz', name: 'Capiz Province', center: [11.4500, 122.7000], zoom: 9, islandGroup: 'Panay' },
  aklan: { id: 'aklan', name: 'Aklan Province', center: [11.6000, 122.3000], zoom: 9, islandGroup: 'Panay' },
  antique: { id: 'antique', name: 'Antique Province', center: [11.1500, 122.1000], zoom: 9, islandGroup: 'Panay' },
  philippines: { id: 'philippines', name: 'Nationwide (Philippines)', center: [12.8797, 121.7740], zoom: 6, islandGroup: 'Nationwide' },
  ncr: { id: 'ncr', name: 'NCR (Metro Manila)', center: [14.5995, 121.0364], zoom: 11, islandGroup: 'Luzon' },
  r3: { id: 'r3', name: 'Region III (Central Luzon)', center: [15.4828, 120.7120], zoom: 8, islandGroup: 'Luzon' },
  r4a: { id: 'r4a', name: 'Region IV-A (CALABARZON)', center: [14.1008, 121.0794], zoom: 8, islandGroup: 'Luzon' },
  r5: { id: 'r5', name: 'Region V (Bicol Region)', center: [13.4210, 123.4136], zoom: 8, islandGroup: 'Luzon' },
  r1: { id: 'r1', name: 'Region I (Ilocos Region)', center: [16.8906, 120.5739], zoom: 8, islandGroup: 'Luzon' },
  r2: { id: 'r2', name: 'Region II (Cagayan Valley)', center: [17.6132, 121.7270], zoom: 8, islandGroup: 'Luzon' },
  car: { id: 'car', name: 'CAR (Cordillera)', center: [17.0754, 121.0028], zoom: 8, islandGroup: 'Luzon' },
  r4b: { id: 'r4b', name: 'MIMAROPA (Region IV-B)', center: [12.0000, 120.0000], zoom: 7, islandGroup: 'Luzon' },
  r7: { id: 'r7', name: 'Region VII (Central Visayas / Cebu)', center: [10.3157, 123.8854], zoom: 9, islandGroup: 'Visayas' },
  r8: { id: 'r8', name: 'Region VIII (Eastern Visayas / Leyte)', center: [11.2443, 125.0039], zoom: 8, islandGroup: 'Visayas' },
  r6_negros: { id: 'r6_negros', name: 'Region VI (Negros Occidental)', center: [10.6765, 122.9509], zoom: 8, islandGroup: 'Visayas' },
  r11: { id: 'r11', name: 'Region XI (Davao Region)', center: [7.1907, 125.4504], zoom: 8, islandGroup: 'Mindanao' },
  r10: { id: 'r10', name: 'Region X (Northern Mindanao)', center: [8.4542, 124.6319], zoom: 8, islandGroup: 'Mindanao' },
  r9: { id: 'r9', name: 'Region IX (Zamboanga Peninsula)', center: [7.8385, 122.7560], zoom: 8, islandGroup: 'Mindanao' },
  r12: { id: 'r12', name: 'Region XII (SOCCSKSARGEN)', center: [6.5064, 124.8480], zoom: 8, islandGroup: 'Mindanao' },
  r13: { id: 'r13', name: 'Region XIII (Caraga)', center: [8.9511, 125.5288], zoom: 8, islandGroup: 'Mindanao' },
  barmm: { id: 'barmm', name: 'BARMM (Bangsamoro)', center: [7.2047, 124.2384], zoom: 8, islandGroup: 'Mindanao' },
};

export interface PanayMapProps {
  municipalities: Municipality[];
  selectedId: string | null;
  globalRank?: number | null;
  onSelect: (id: string) => void;
  recoveryDate?: string | null;
  isLoading?: boolean;
  gdacsAlerts?: GdacsAlert[];
  activeEventId?: string | null;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  selectedRegionKey?: string;
  onRegionChange?: (regionKey: string) => void;
  onMunicipalitiesLoaded?: (newItems: Municipality[]) => void;
}

export interface LeafletMapProps {
  municipalities: Municipality[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onMapHoverChange?: (hovered: boolean) => void;
  gdacsAlerts?: GdacsAlert[];
  showGdacsMarkers?: boolean;
  activeEventId?: string | null;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  selectedRegionKey?: string;
  onRegionChange?: (key: string) => void;
  onChunkLoaded?: (newItems: Municipality[]) => void;
  onChunkLoadingChange?: (loading: boolean) => void;
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
  globalRank,
  onSelect,
  recoveryDate,
  isLoading = false,
  gdacsAlerts = [],
  activeEventId,
  onSimulateGdacs,
  selectedRegionKey: externalRegionKey,
  onRegionChange: externalOnRegionChange,
  onMunicipalitiesLoaded,
}: PanayMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showGdacsMarkers, setShowGdacsMarkers] = useState(true);
  const [internalRegionKey, setInternalRegionKey] = useState<string>('panay');
  const [extraMunicipalities, setExtraMunicipalities] = useState<Municipality[]>([]);
  const [isRegionChunkLoading, setIsRegionChunkLoading] = useState<boolean>(false);

  const currentRegionKey = externalRegionKey ?? internalRegionKey;
  const handleRegionChange = (newKey: string) => {
    setInternalRegionKey(newKey);
    externalOnRegionChange?.(newKey);
  };

  const handleChunkLoaded = (newItems: Municipality[]) => {
    setExtraMunicipalities((prev) => {
      const existing = new Set(prev.map((m: Municipality) => m.id));
      const toAdd = newItems.filter((m: Municipality) => !existing.has(m.id));
      return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
    });
    onMunicipalitiesLoaded?.(newItems);
  };

  // Merge default Panay telemetry with newly loaded regional chunk municipalities
  const allMunicipalities: Municipality[] = useMemo(() => {
    const map = new Map<string, Municipality>();
    municipalities.forEach((m: Municipality) => map.set(m.id, m));
    extraMunicipalities.forEach((m: Municipality) => {
      if (!map.has(m.id)) map.set(m.id, m);
    });
    return Array.from(map.values());
  }, [municipalities, extraMunicipalities]);

  // Uniform ranking lookup based on Municipal Resilience Index
  const resilienceRankMap = useMemo(() => {
    const sorted = [...allMunicipalities].sort(
      (a, b) => (a.recoveryScore ?? 50) - (b.recoveryScore ?? 50) || a.name.localeCompare(b.name)
    );
    const map = new Map<string, number>();
    sorted.forEach((m, idx) => {
      map.set(m.id, idx + 1);
      if (m.pcode) map.set(m.pcode, idx + 1);
    });
    return map;
  }, [allMunicipalities]);

  const hovered = allMunicipalities.find((m: Municipality) => m.id === hoveredId);
  const selected = allMunicipalities.find((m: Municipality) => m.id === selectedId);

  // Audio-Spatial Emergency Indicator: dynamically resolve target municipality
  // Prioritizes hovered municipality first for instant spatial acoustic feedback,
  // then selected municipality, then falls back to regional baseline.
  const activeFocusMunicipality = hovered ?? selected ?? null;

  const currentTargetAudioStatus: EmergencyAudioStatus = useMemo(() => {
    if (activeFocusMunicipality) {
      if (
        activeFocusMunicipality.status === 'critical' ||
        (activeFocusMunicipality.recoveryScore !== undefined && activeFocusMunicipality.recoveryScore < 40)
      ) {
        return 'critical';
      }
      if (
        activeFocusMunicipality.status === 'warning' ||
        (activeFocusMunicipality.recoveryScore !== undefined && activeFocusMunicipality.recoveryScore < 60)
      ) {
        return 'warning';
      }
      if (
        activeFocusMunicipality.status === 'recovering' ||
        (activeFocusMunicipality.recoveryScore !== undefined && activeFocusMunicipality.recoveryScore < 80)
      ) {
        return 'recovering';
      }
      return 'restored';
    }

    // Default regional baseline when no municipality is specifically hovered or selected
    const criticals = allMunicipalities.filter((m) => m.status === 'critical');
    if (criticals.length >= 4) return 'critical';
    if (criticals.length > 0) return 'warning';

    const warnings = allMunicipalities.filter((m) => m.status === 'warning');
    if (warnings.length > 0) return 'warning';

    const recovering = allMunicipalities.filter((m) => m.status === 'recovering');
    if (recovering.length > 0) return 'recovering';

    return 'restored';
  }, [activeFocusMunicipality, allMunicipalities]);

  const {
    isActive: isAudioActive,
    isEnabled: isAudioEnabled,
    isHovered: isMapAudioHovered,
    isPlaying: isMapAudioPlaying,
    status: liveAudioStatus,
    toggle: toggleAudio,
    setHovered: setAudioHovered,
    statusLabel: audioStatusLabel,
  } = useAudioSpatialIndicator(currentTargetAudioStatus);

  useEffect(() => {
    return () => {
      setAudioHovered(false);
    };
  }, [setAudioHovered]);

  const alertsWithCoords = (gdacsAlerts || []).filter(
    (a: GdacsAlert) => (a.latitude != null && a.longitude != null) || (a.coordinates && a.coordinates.length >= 2)
  );

  const activePreset = REGION_PRESETS[currentRegionKey] || REGION_PRESETS.panay;

  return (
    <div className="grid lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
      {/* Map */}
      <div className="lg:col-span-8 flex flex-col">
        <div className="relative rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 backdrop-blur-sm overflow-hidden flex flex-col h-full shadow-sm dark:shadow-xl">
          {/* Map header with Region Selector */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-ink-950/40">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Philippine Satellite Grid</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ocean-500/20 text-ocean-700 dark:text-ocean-300 border border-ocean-500/30">
                  {currentRegionKey === 'panay' ? 'Panay Default' : activePreset.name}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25" title="Hardware-accelerated HTML5 Canvas (L.canvas) renderer">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  Canvas 2D Engine
                </span>
                {isRegionChunkLoading && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ocean-700 dark:text-ocean-300 bg-ocean-500/15 border border-ocean-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin text-ocean-500 dark:text-ocean-300" />
                    Loading {activePreset.name}...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">
                NASA VIIRS radiance overlay · Nationwide Philippine boundaries (Panay-First Default)
                {recoveryDate ? ` · Latest reading: ${recoveryDate}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {/* Region Navigator Selector */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-ocean-500/35 bg-ocean-500/10 text-ocean-700 dark:text-ocean-200">
                <Compass className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400 shrink-0" />
                <label htmlFor="panay-map-region-selector" className="text-[11px] font-semibold text-ocean-700 dark:text-ocean-300 hidden sm:inline">Region:</label>
                <select
                  id="panay-map-region-selector"
                  value={currentRegionKey}
                  onChange={(e) => handleRegionChange(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-white focus:outline-none cursor-pointer pr-1"
                  aria-label="Select Philippine Region or Province"
                >
                  <optgroup label="Primary Scope">
                    <option value="panay" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Panay Island (Default)</option>
                    <option value="iloilo" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">↳ Iloilo Province</option>
                    <option value="capiz" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">↳ Capiz Province</option>
                    <option value="aklan" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">↳ Aklan Province</option>
                    <option value="antique" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">↳ Antique Province</option>
                  </optgroup>
                  <optgroup label="Nationwide">
                    <option value="philippines" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Nationwide Overview (Philippines)</option>
                  </optgroup>
                  <optgroup label="Luzon">
                    <option value="ncr" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">NCR (Metro Manila)</option>
                    <option value="r3" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region III (Central Luzon)</option>
                    <option value="r4a" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region IV-A (CALABARZON)</option>
                    <option value="r5" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region V (Bicol Region)</option>
                    <option value="r1" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region I (Ilocos Region)</option>
                    <option value="r2" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region II (Cagayan Valley)</option>
                    <option value="car" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">CAR (Cordillera)</option>
                    <option value="r4b" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">MIMAROPA (Region IV-B)</option>
                  </optgroup>
                  <optgroup label="Visayas">
                    <option value="r7" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region VII (Central Visayas / Cebu)</option>
                    <option value="r8" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region VIII (Eastern Visayas / Leyte)</option>
                    <option value="r6_negros" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region VI (Negros Occidental)</option>
                  </optgroup>
                  <optgroup label="Mindanao">
                    <option value="r11" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region XI (Davao Region)</option>
                    <option value="r10" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region X (Northern Mindanao)</option>
                    <option value="r9" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region IX (Zamboanga Peninsula)</option>
                    <option value="r12" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region XII (SOCCSKSARGEN)</option>
                    <option value="r13" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Region XIII (Caraga)</option>
                    <option value="barmm" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">BARMM (Bangsamoro)</option>
                  </optgroup>
                </select>
              </div>

              {alertsWithCoords.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowGdacsMarkers(!showGdacsMarkers)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${showGdacsMarkers
                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/20'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-ink-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  title="Toggle live GDACS hazard epicenter markers on map"
                >
                  <Radio className={`h-3 w-3 ${showGdacsMarkers ? 'text-rose-500 dark:text-rose-400 animate-pulse' : 'text-slate-500 dark:text-ink-400'}`} />
                  <span>Live Hazards ({alertsWithCoords.length})</span>
                </button>
              )}
              {/* Audio-Spatial Emergency Indicator Toggle */}
              <button
                type="button"
                id="audio-spatial-indicator-toggle"
                onClick={() => toggleAudio()}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${isAudioEnabled
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-ink-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                  }`}
                title={
                  isAudioEnabled
                    ? isMapAudioPlaying
                      ? `Audio-Spatial Indicator: ACTIVE (${audioStatusLabel}) - Click to turn off`
                      : `Audio-Spatial Indicator: ON (Standby · Hover map to listen) - Click to turn off`
                    : 'Enable Audio-Spatial Emergency Indicator (Simulated Nighttime Cricket Telemetry · Plays on map hover)'
                }
                aria-pressed={isAudioEnabled}
              >
                {isAudioEnabled ? (
                  <>
                    <Volume2 className={`h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 ${isMapAudioPlaying ? 'animate-pulse' : 'opacity-70'}`} />
                    <span className="hidden sm:inline">Audio</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-mono">
                      {isMapAudioPlaying ? (liveAudioStatus === 'critical' ? 'MAX' : liveAudioStatus === 'warning' ? 'MID' : 'LOW') : 'Hover Map'}
                    </span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-slate-500 dark:text-ink-400" />
                    <span className="hidden sm:inline">Spatial Audio</span>
                  </>
                )}
              </button>

              <LegendDot color="#10b981" label="Restored" />
              <LegendDot color="#599ffd" label="Recovering" />
              <LegendDot color="#fbbf24" label="Limited" />
              <LegendDot color="#f43f5e" label="Critical" />
            </div>
          </div>

          {/* Leaflet GeoJSON map */}
          <div
            className="relative dot-bg p-2 flex-1 min-h-[360px] flex flex-col justify-center"
            onMouseEnter={() => setAudioHovered(true)}
            onMouseLeave={() => setAudioHovered(false)}
          >
            {isLoading && allMunicipalities.length === 0 ? (
              <MapLoadingSkeleton />
            ) : (
              <>
                <LeafletMap
                  municipalities={allMunicipalities}
                  selectedId={selectedId}
                  onSelect={onSelect}
                  onHover={setHoveredId}
                  onMapHoverChange={setAudioHovered}
                  gdacsAlerts={gdacsAlerts}
                  showGdacsMarkers={showGdacsMarkers}
                  activeEventId={activeEventId}
                  onSimulateGdacs={onSimulateGdacs}
                  selectedRegionKey={currentRegionKey}
                  onRegionChange={handleRegionChange}
                  onChunkLoaded={handleChunkLoaded}
                  onChunkLoadingChange={setIsRegionChunkLoading}
                />

                {isLoading && municipalities.length > 0 && (
                  <div className="absolute top-4 left-4 z-[1001] flex items-center gap-2 px-3 py-1.5 rounded-full bg-ink-950/85 border border-ocean-500/30 text-ocean-300 text-xs backdrop-blur-md shadow-lg pointer-events-none animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Calibrating radiance...</span>
                  </div>
                )}

                {/* Hover tooltip */}
                {hovered && !selected && (
                  <div className="absolute pointer-events-none bottom-4 left-4 z-[1001] glass rounded-xl px-4 py-3 max-w-xs animate-fade-in shadow-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/90 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: getRecoveryColor(hovered.recoveryScore) }}
                        />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{hovered.name}</span>
                        <span className="text-xs text-gray-500 dark:text-ink-400">{hovered.province}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-500/30">
                        #{hovered.resilienceRank ?? hovered.rank ?? (resilienceRankMap.get(hovered.id) || 1)} Lowest
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-gray-600 dark:text-ink-300">
                        Recovery: <span className="font-semibold text-gray-900 dark:text-white">{hovered.recoveryScore}%</span>
                      </span>
                      <span className="text-gray-600 dark:text-ink-300">
                        Status: <span style={{ color: getRecoveryStatusColor(hovered.status) }}>
                          {statusLabels[hovered.status]}
                        </span>
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-ink-400 mt-1.5">Click municipality to pin telemetry</p>
                    {isAudioEnabled && (
                      <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-300/90 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-white/5">
                        <Volume2 className={`h-3 w-3 text-emerald-500 dark:text-emerald-400 ${isMapAudioPlaying ? 'animate-pulse' : 'opacity-60'}`} />
                        <span>Spatial Audio: {isMapAudioPlaying ? audioStatusLabel : `${audioStatusLabel} (Hover Map)`}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Scale bar */}
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-ink-900/80 text-gray-700 dark:text-gray-300 transition-colors">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-28 sm:w-36 rounded-full overflow-hidden">
                <div className="flex-1 bg-rose-500" />
                <div className="flex-1 bg-amber-400" />
                <div className="flex-1 bg-ocean-400" />
                <div className="flex-1 bg-emerald-500" />
              </div>
              <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300">Recovery Score (0–100)</span>
            </div>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">
              Projection model: VIIRS-DNB vs Pre-event Baseline
            </span>
          </div>
        </div>
      </div>

      {/* Detail side panel */}
      <div className="lg:col-span-4 flex flex-col">
        {selected ? (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 backdrop-blur-sm p-5 animate-slide-in flex flex-col justify-between h-full shadow-lg dark:shadow-xl transition-colors">
            <div>
              <div className="flex items-start justify-between pb-3 mb-4 border-b border-slate-200 dark:border-white/10">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <MapPin className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400" />
                    <span className="text-xs font-semibold text-slate-500 dark:text-ink-400 uppercase tracking-wider">{selected.province} Province</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">{selected.name}</h3>
                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/20 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-500/30">
                      #{selected.resilienceRank ?? selected.rank ?? (selected.id === selectedId && globalRank ? globalRank : null) ?? (resilienceRankMap.get(selected.id) || 1)} Lowest ({selected.recoveryScore}%)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelect('')}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-ink-400 dark:hover:text-white dark:hover:bg-white/10 transition-all cursor-pointer"
                  title="Deselect municipality"
                  aria-label="Close details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Audio-Spatial Indicator Status Badge */}
              {isAudioEnabled && (
                <div className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 dark:bg-ink-950/60 border border-emerald-500/30 dark:border-emerald-500/20 mb-4 transition-colors">
                  <span className="flex items-center gap-1.5 text-slate-700 dark:text-ink-300">
                    <Volume2 className={`h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 ${isMapAudioPlaying ? 'animate-pulse' : 'opacity-60'}`} />
                    <span>Spatial Audio Profile</span>
                  </span>
                  <span className={`font-semibold text-[11px] px-2 py-0.5 rounded ${liveAudioStatus === 'critical'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                    : liveAudioStatus === 'warning'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                      : liveAudioStatus === 'recovering'
                        ? 'bg-ocean-100 text-ocean-700 dark:bg-ocean-500/20 dark:text-ocean-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                    }`}>
                    {isMapAudioPlaying ? audioStatusLabel : `${audioStatusLabel} (Hover Map)`}
                  </span>
                </div>
              )}

              {/* Recovery gauge */}
              <div className="mb-5 bg-slate-50 dark:bg-ink-950/50 rounded-xl p-3.5 border border-slate-200 dark:border-white/5 transition-colors">
                <div className="flex items-end justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-ink-400 uppercase tracking-wider">Recovery Indicator</span>
                  <span
                    className="text-3xl font-black tracking-tight"
                    style={{ color: getRecoveryColor(selected.recoveryScore) }}
                  >
                    {selected.recoveryScore}
                    <span className="text-base text-slate-400 dark:text-ink-500 font-normal">/100</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-200 dark:bg-ink-800 overflow-hidden">
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
                  <span className="text-slate-500 dark:text-ink-400">Target: 90%+ restored</span>
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
            <div className="rounded-xl bg-slate-50 dark:bg-ink-950/50 border border-slate-200 dark:border-white/5 p-3.5 mt-auto transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500 dark:text-ink-400">Est. Full Restoration</span>
                <span className="text-base font-bold text-slate-900 dark:text-white">
                  {selected.estimatedDaysToRecover === 0 ? 'Restored' : `~${selected.estimatedDaysToRecover} days`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-ink-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-ocean-500 to-emerald-500 transition-all duration-700"
                    style={{
                      width: `${Math.max(5, 100 - (selected.estimatedDaysToRecover / 20) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-ink-400 whitespace-nowrap">
                  {selected.estimatedDaysToRecover === 0 ? '100% capacity' : `${selected.estimatedDaysToRecover}d remaining`}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 backdrop-blur-sm p-5 h-full flex flex-col justify-between shadow-lg dark:shadow-xl transition-colors">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-ink-300">
                Municipality Telemetry
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-ocean-50 text-ocean-700 border border-ocean-200 dark:bg-ocean-500/10 dark:text-ocean-300 dark:border-ocean-500/20 font-medium">
                {currentRegionKey === 'panay' ? 'Panay Grid' : activePreset.name}
              </span>
            </div>

            <div className="flex flex-col items-center justify-center text-center py-8">
              <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-3 shadow-inner">
                <MapPin className="h-6 w-6 text-ocean-500 dark:text-ocean-400 animate-bounce" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Select an LGU Boundary</h4>
              <p className="text-xs text-slate-500 dark:text-ink-400 max-w-xs leading-relaxed">
                Click any fine-grained municipality polygon or live hazard epicenter on the map to pin its satellite radiance indicators.
              </p>

              {/* Quick sample town buttons */}
              <div className="mt-5 w-full">
                <span className="text-[11px] font-semibold text-slate-500 dark:text-ink-400 uppercase tracking-wider block mb-2">
                  Quick Select Major Hubs
                </span>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {(() => {
                    let targetIds: string[] = ['PH063022000', 'PH060407000', 'PH061914000', 'PH060613000'];
                    if (currentRegionKey === 'ncr') {
                      targetIds = ['PH133901000', 'PH137404000', 'PH137601000', 'PH137403000'];
                    } else if (currentRegionKey === 'r7') {
                      targetIds = ['PH072217000', 'PH072230000', 'PH072226000', 'PH071242000'];
                    } else if (currentRegionKey === 'r11') {
                      targetIds = ['PH112402000', 'PH112319000', 'PH112315000', 'PH112403000'];
                    } else if (currentRegionKey === 'r3') {
                      targetIds = ['PH035416000', 'PH035401000', 'PH031410000', 'PH036916000'];
                    } else if (currentRegionKey === 'r4a') {
                      targetIds = ['PH045801000', 'PH043405000', 'PH042106000', 'PH041005000'];
                    } else if (currentRegionKey === 'r8') {
                      targetIds = ['PH083747000', 'PH083738000', 'PH083710000', 'PH086003000'];
                    } else if (currentRegionKey === 'r6_negros') {
                      targetIds = ['PH060450100', 'PH060452600', 'PH060450200', 'PH060451400'];
                    } else if (currentRegionKey === 'r1') {
                      targetIds = ['PH012805000', 'PH012928000', 'PH013314000', 'PH015518000'];
                    } else if (currentRegionKey === 'r2') {
                      targetIds = ['PH021529000', 'PH023134000', 'PH025007000'];
                    } else if (currentRegionKey === 'car') {
                      targetIds = ['PH141102000', 'PH141114000', 'PH143213000'];
                    } else if (currentRegionKey === 'r5') {
                      targetIds = ['PH050506000', 'PH051724000', 'PH056216000'];
                    } else if (currentRegionKey === 'r10') {
                      targetIds = ['PH104305000', 'PH103504000', 'PH101312000'];
                    } else if (currentRegionKey === 'r9') {
                      targetIds = ['PH097332000', 'PH097322000'];
                    } else if (currentRegionKey === 'r12') {
                      targetIds = ['PH126303000', 'PH126306000'];
                    } else if (currentRegionKey === 'r13') {
                      targetIds = ['PH160202000', 'PH166724000'];
                    } else if (currentRegionKey === 'barmm') {
                      targetIds = ['PH199901000', 'PH193601000'];
                    }

                    const items = targetIds
                      .map((id) => allMunicipalities.find((item: Municipality) => item.id === id))
                      .filter((m: Municipality | undefined): m is Municipality => Boolean(m));

                    if (items.length === 0) {
                      return allMunicipalities.slice(0, 4).map((m: Municipality) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelect(m.id)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-ocean-100 hover:border-ocean-300 text-slate-700 hover:text-ocean-900 dark:bg-white/5 dark:hover:bg-ocean-500/20 dark:hover:border-ocean-500/40 dark:text-ink-300 dark:hover:text-white transition-all cursor-pointer"
                        >
                          {m.name}
                        </button>
                      ));
                    }

                    return items.map((m: Municipality) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onSelect(m.id)}
                        className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-ocean-100 hover:border-ocean-300 text-slate-700 hover:text-ocean-900 dark:bg-white/5 dark:hover:bg-ocean-500/20 dark:hover:border-ocean-500/40 dark:text-ink-300 dark:hover:text-white transition-all cursor-pointer"
                      >
                        {m.name}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-ink-400 text-center">
              {currentRegionKey === 'panay'
                ? 'Covers 93 fine-grained LGUs in Iloilo, Capiz, Aklan, and Antique'
                : `Covers fine-grained municipalities in ${activePreset.name}`}
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

function getBaseTileUrl(isLightMode: boolean): string {
  const apiKey = (import.meta.env.VITE_MY_API_KEY as string | undefined)?.trim();
  const queryParam = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';

  return isLightMode
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${queryParam}`
    : `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${queryParam}`;
}

function LeafletMap({
  municipalities,
  selectedId,
  onSelect,
  onHover,
  onMapHoverChange,
  gdacsAlerts = [],
  showGdacsMarkers = true,
  activeEventId,
  onSimulateGdacs,
  selectedRegionKey = 'panay',
  onRegionChange,
  onChunkLoaded,
  onChunkLoadingChange,
}: LeafletMapProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const isLightRef = useRef(isLight);
  isLightRef.current = isLight;

  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<Record<string, any>>({});
  const gdacsGroupRef = useRef<L.LayerGroup | null>(null);
  const defaultBoundsRef = useRef<L.LatLngBounds | null>(null);
  const municipalitiesByIdRef = useRef<Map<string, Municipality>>(new Map());
  const selectedIdRef = useRef<string | null>(selectedId);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onMapHoverChangeRef = useRef(onMapHoverChange);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const regionCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());

  // Panay coordinates constant
  const PANAY_CENTER: [number, number] = [11.0, 122.5];
  const PANAY_ZOOM = 8;
  const PANAY_BOUNDS = L.latLngBounds([
    [10.35, 121.75],
    [11.95, 123.25],
  ]);

  // Keep callback refs synchronized
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onHoverRef.current = onHover;
  }, [onHover]);

  useEffect(() => {
    onMapHoverChangeRef.current = onMapHoverChange;
  }, [onMapHoverChange]);

  // Track lock state imperatively so toggling NEVER causes a LeafletMap re-render.
  // All side-effects (Leaflet handlers + container classList) are applied directly
  // via applyMapLock(), avoiding any React render cycle for the tile layer.
  const isLockedRef = useRef<boolean>(true);

  // Imperatively enable/disable Leaflet interaction handlers and update the
  // container CSS class. Does NOT call setState, so the tile layer is safe.
  const applyMapLock = (locked: boolean) => {
    isLockedRef.current = locked;
    const map = mapRef.current;
    if (map) {
      if (locked) {
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
    }
    const el = mapElement.current;
    if (el) {
      el.classList.toggle('is-locked', locked);
      el.classList.toggle('is-unlocked', !locked);
    }
  };

  // Asynchronous lazy-loader for regional GeoJSON chunks with in-memory caching
  const fetchRegionChunk = async (key: string): Promise<GeoJSON.FeatureCollection | null> => {
    if (regionCacheRef.current.has(key)) {
      return regionCacheRef.current.get(key)!;
    }

    // If selecting a Panay sub-province (iloilo, capiz, aklan, antique), derive from Panay if already cached
    if (['iloilo', 'capiz', 'aklan', 'antique'].includes(key) && regionCacheRef.current.has('panay')) {
      const panayData = regionCacheRef.current.get('panay')!;
      const filtered = panayData.features.filter((f: GeoJSON.Feature) =>
        (f.properties?.ADM2_EN || '').toLowerCase().includes(key)
      );
      if (filtered.length > 0) {
        const subCol: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: filtered,
        };
        regionCacheRef.current.set(key, subCol);
        return subCol;
      }
    }

    onChunkLoadingChange?.(true);
    try {
      const url = key === 'panay' ? '/regions/panay.geojson' : `/regions/${key}.geojson`;
      let res = await fetch(url);
      if (!res.ok && key === 'panay') {
        res = await fetch('/panay_municipalities.geojson');
      }
      if (!res.ok && key === 'philippines') {
        res = await fetch('/philippines_boundaries.geojson');
      }
      if (res.ok) {
        const geojson: GeoJSON.FeatureCollection = await res.json();
        regionCacheRef.current.set(key, geojson);
        return geojson;
      }
    } catch (err) {
      console.warn(`Failed to fetch region chunk for ${key}:`, err);
    } finally {
      onChunkLoadingChange?.(false);
    }

    // Graceful fallback to Panay dataset
    return regionCacheRef.current.get('panay') || null;
  };

  // Function to bind fine-grained municipal features for the active region using HTML5 Canvas
  const renderRegionGeoJson = (regionKey: string, data: GeoJSON.FeatureCollection) => {
    const map = mapRef.current;
    if (!map || !data || !data.features) return;

    // Safely remove prior layer before binding new municipal collection
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }
    layersRef.current = {};

    // Register any newly encountered municipalities into municipalitiesByIdRef and propagate to parent
    const newToRegister: GeoJSON.Feature[] = [];
    data.features.forEach((feat: GeoJSON.Feature) => {
      const props = feat.properties || {};
      const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
      if (id && !municipalitiesByIdRef.current.has(id)) {
        newToRegister.push(feat);
      }
    });

    if (newToRegister.length > 0) {
      const generated = createMunicipalities(newToRegister);
      generated.forEach((m: Municipality) => {
        if (!municipalitiesByIdRef.current.has(m.id)) {
          municipalitiesByIdRef.current.set(m.id, m);
        }
      });
      onChunkLoaded?.(generated);
    }

    // HTML5 Canvas renderer configuration: eliminates DOM node bloat for hundreds/thousands of polygons
    const newLayer = L.geoJSON(data, {
      style: (feature) => {
        const props = feature?.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const score = municipality?.recoveryScore ?? 50;
        const color = getRecoveryColor(score);
        const isSelected = id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current);
        const lightMode = isLightRef.current;
        return {
          renderer: canvasRendererRef.current || undefined,
          color: isSelected
            ? (lightMode ? '#0f172a' : '#ffffff')
            : (lightMode ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.4)'),
          weight: isSelected ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: isSelected ? 0.95 : (lightMode ? 0.68 : 0.65),
          lineJoin: 'round',
          lineCap: 'round',
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        if (!featureLayer || (!('setStyle' in featureLayer) && !(featureLayer instanceof L.Path))) return;

        layersRef.current[id] = featureLayer;
        const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
        const rawName = String(props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || 'Municipality');
        const normName = rawName ? rawName.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const initialName = municipality?.name || rawName;
        const initialProvince = municipality?.province || String(props.ADM2_EN || props.province || '');
        const initialScore = municipality?.recoveryScore ?? 50;

        const tooltipText = initialProvince
          ? `${initialName} (${initialProvince}) · ${initialScore}% recovery`
          : `${initialName} · ${initialScore}% recovery`;

        featureLayer.bindTooltip(tooltipText, {
          sticky: true,
          direction: 'top',
        });
        featureLayer.on({
          click: () => onSelectRef.current(id),
          mouseover: () => {
            onHoverRef.current(id);
            const activeLight = isLightRef.current;
            if (typeof (featureLayer as any).setStyle === 'function') {
              (featureLayer as any).setStyle({
                weight: 2.8,
                color: activeLight ? '#0f172a' : '#ffffff',
                fillOpacity: 0.95
              });
            }
            if (typeof (featureLayer as any).bringToFront === 'function') {
              (featureLayer as any).bringToFront();
            }
          },
          mouseout: () => {
            onHoverRef.current(null);
            const activeLight = isLightRef.current;
            const currentM =
              municipalitiesByIdRef.current.get(id) ||
              (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
              (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
              (normName ? municipalitiesByIdRef.current.get(normName) : null);
            if (currentM) {
              updateLayerStyle(featureLayer, currentM, id === selectedIdRef.current || currentM.id === selectedIdRef.current, activeLight);
            } else if (typeof (featureLayer as any).setStyle === 'function') {
              (featureLayer as any).setStyle({
                weight: 1.2,
                color: activeLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.4)',
                fillOpacity: activeLight ? 0.68 : 0.65
              });
            }
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = newLayer;

    // Apply any telemetry scores already in memory
    Object.entries(layersRef.current).forEach(([id, featureLayer]) => {
      const props = (featureLayer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

      const m =
        municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);

      if (m) {
        updateLayerStyle(featureLayer, m, id === selectedIdRef.current || m.id === selectedIdRef.current);
        featureLayer.setTooltipContent(`${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery`);
      }
    });
  };

  const resetToPanayBounds = (animate = true) => {
    const map = mapRef.current;
    if (!map) return;
    onRegionChange?.('panay');
    fetchRegionChunk('panay').then((data) => {
      if (data) renderRegionGeoJson('panay', data);
      map.setView(PANAY_CENTER, PANAY_ZOOM, { animate });
    });
  };

  const handleReset = () => {
    resetToPanayBounds(true);
  };

  // Initialize Map with Canvas renderer and Panay Island default fast-load
  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const initialLocked = true;
    const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 10 });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapElement.current, {
      center: PANAY_CENTER,
      zoom: PANAY_ZOOM,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      preferCanvas: true,
      renderer: canvasRenderer,
      dragging: !initialLocked,
      touchZoom: !initialLocked,
      doubleClickZoom: !initialLocked,
      boxZoom: !initialLocked,
    });
    mapRef.current = map;
    defaultBoundsRef.current = PANAY_BOUNDS;

    // Initialize CartoDB base tile layer based on active theme
    const initialTileUrl = getBaseTileUrl(isLightRef.current);
    const initialTileLayer = L.tileLayer(initialTileUrl, {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    initialTileLayer.addTo(map);
    tileLayerRef.current = initialTileLayer;

    // Track mouse hover state across the interactive map surface
    map.on('mouseover', () => {
      onMapHoverChangeRef.current?.(true);
    });
    map.on('mouseout', (e) => {
      const container = map.getContainer();
      if (!container) {
        onMapHoverChangeRef.current?.(false);
        return;
      }
      const rect = container.getBoundingClientRect();
      const clientX = (e.originalEvent as MouseEvent)?.clientX;
      const clientY = (e.originalEvent as MouseEvent)?.clientY;
      if (
        clientX == null || clientY == null ||
        clientX < rect.left || clientX > rect.right ||
        clientY < rect.top || clientY > rect.bottom
      ) {
        onMapHoverChangeRef.current?.(false);
      }
    });

    // Dedicated layer group for GDACS live hazard pins and impact zones
    const gdacsGroup = L.layerGroup().addTo(map);
    gdacsGroupRef.current = gdacsGroup;

    let disposed = false;

    // Fast-load Panay Island boundaries by default
    fetchRegionChunk('panay')
      .then((geojson) => {
        if (disposed || mapRef.current !== map || !geojson) return;
        const targetKey = selectedRegionKey || 'panay';
        if (targetKey === 'panay') {
          renderRegionGeoJson('panay', geojson);
          map.setView(PANAY_CENTER, PANAY_ZOOM);
        } else {
          fetchRegionChunk(targetKey).then((chunk) => {
            if (chunk && !disposed && mapRef.current === map) {
              renderRegionGeoJson(targetKey, chunk);
              const preset = REGION_PRESETS[targetKey];
              if (preset) map.setView(preset.center, preset.zoom);
            }
          });
        }
      })
      .catch(() => {
        // Ignore aborted or unavailable map data during component cleanup.
      });

    return () => {
      disposed = true;
      if (tileLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      if (geoJsonLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(geoJsonLayerRef.current);
        geoJsonLayerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      layersRef.current = {};
      gdacsGroupRef.current = null;
    };
  }, []);

  // Dynamically swap Leaflet base tile layer and polygon borders when theme changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const tileUrl = getBaseTileUrl(isLight);

    const newTileLayer = L.tileLayer(tileUrl, {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    newTileLayer.addTo(map);
    if (typeof (newTileLayer as any).bringToBack === 'function') {
      (newTileLayer as any).bringToBack();
    }
    tileLayerRef.current = newTileLayer;

    // Immediately re-paint all GeoJSON polygons with appropriate boundary stroke contrast
    if (geoJsonLayerRef.current && typeof (geoJsonLayerRef.current as any).setStyle === 'function') {
      (geoJsonLayerRef.current as any).setStyle((feature: any) => {
        const props = feature?.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const score = municipality?.recoveryScore ?? 50;
        const color = getRecoveryColor(score);
        const isSelected = id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current);

        return {
          renderer: canvasRendererRef.current || undefined,
          color: isSelected
            ? (isLight ? '#0f172a' : '#ffffff')
            : (isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.4)'),
          weight: isSelected ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: isSelected ? 0.95 : (isLight ? 0.68 : 0.65),
          lineJoin: 'round',
          lineCap: 'round',
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      const props = (layer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';
      const m =
        municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);
      if (m) {
        updateLayerStyle(layer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLight);
      }
    });
  }, [isLight]);

  // Smoothly pan & zoom and lazy-load regional chunk when user selects a different Philippine region
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedRegionKey) return;

    fetchRegionChunk(selectedRegionKey).then((chunkData) => {
      if (!chunkData) return;
      renderRegionGeoJson(selectedRegionKey, chunkData);

      const preset = REGION_PRESETS[selectedRegionKey];
      if (preset) {
        if (selectedRegionKey === 'panay') {
          map.setView(PANAY_CENTER, PANAY_ZOOM, { animate: true });
        } else {
          map.flyTo(preset.center, preset.zoom, { duration: 1.2 });
        }
      }
    });
  }, [selectedRegionKey]);

  // Update GeoJSON polygon styles and tooltip content dynamically when municipality scores or selection change
  useEffect(() => {
    const map = new Map<string, Municipality>();
    municipalities.forEach((item) => {
      if (item.id) map.set(item.id, item);
      if (item.pcode) map.set(item.pcode, item);
      if (item.name) {
        map.set(item.name.toLowerCase().trim(), item);
        const norm = item.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');
        if (norm) map.set(norm, item);
      }
    });
    municipalitiesByIdRef.current = map;

    // Direct GeoJSON layer-level restyling ensures canvas renderer re-paints all polygons immediately
    if (geoJsonLayerRef.current && typeof (geoJsonLayerRef.current as any).setStyle === 'function') {
      (geoJsonLayerRef.current as any).setStyle((feature: any) => {
        const props = feature?.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          map.get(id) ||
          (pcode ? map.get(pcode) : null) ||
          (name ? map.get(name.toLowerCase().trim()) : null) ||
          (normName ? map.get(normName) : null);

        const score = municipality?.recoveryScore ?? 50;
        const color = getRecoveryColor(score);
        const isSelected = id === selectedId || (municipality && municipality.id === selectedId);
        const lightMode = isLightRef.current;
        return {
          renderer: canvasRendererRef.current || undefined,
          color: isSelected
            ? (lightMode ? '#0f172a' : '#ffffff')
            : (lightMode ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.4)'),
          weight: isSelected ? 2.5 : 1.2,
          fillColor: color,
          fillOpacity: isSelected ? 0.95 : (lightMode ? 0.68 : 0.65),
          lineJoin: 'round',
          lineCap: 'round',
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      const props = (layer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

      const municipality =
        map.get(id) ||
        (pcode ? map.get(pcode) : null) ||
        (name ? map.get(name.toLowerCase().trim()) : null) ||
        (normName ? map.get(normName) : null);

      if (municipality) {
        updateLayerStyle(layer, municipality, id === selectedId || municipality.id === selectedId, isLightRef.current);
        layer.setTooltipContent(`${municipality.name}${municipality.province ? ` (${municipality.province})` : ''} · ${municipality.recoveryScore}% recovery`);
      }
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
      popupContainer.className = 'gdacs-popup-content p-3.5 text-slate-700 dark:text-ink-100 max-w-[285px] font-sans';
      popupContainer.innerHTML = `
        <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200 dark:border-white/10">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" 
                style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}45;">
            ${alert.alert_level || 'Green'} Alert
          </span>
          <span class="text-[10px] text-slate-500 dark:text-ink-400 font-mono">${alert.type || 'HAZARD'}</span>
        </div>
        <h4 class="text-xs font-bold text-slate-900 dark:text-white mb-1 leading-snug">${alert.name}</h4>
        <p class="text-[11px] text-slate-600 dark:text-ink-300 mb-2.5 leading-relaxed line-clamp-2">${alert.description || ''}</p>
        <div class="bg-slate-100/80 dark:bg-black/50 rounded-lg p-2 mb-2.5 border border-slate-200/80 dark:border-white/5 space-y-1 text-[10px]">
          <div class="flex items-center justify-between text-slate-600 dark:text-ink-300">
            <span class="text-slate-500 dark:text-ink-400">Coordinates:</span>
            <span class="font-mono text-slate-900 dark:text-white font-medium">${lat.toFixed(4)}°, ${lng.toFixed(4)}°</span>
          </div>
          <div class="flex items-center justify-between text-slate-600 dark:text-ink-300">
            <span class="text-slate-500 dark:text-ink-400">Date:</span>
            <span class="text-slate-900 dark:text-white font-medium">${alert.date}</span>
          </div>
          ${alert.severity_text ? `
          <div class="flex items-center justify-between text-amber-700 dark:text-amber-300 font-medium pt-0.5 border-t border-slate-200 dark:border-white/5">
            <span class="text-slate-500 dark:text-ink-400">Severity:</span>
            <span class="truncate ml-1 font-semibold">${alert.severity_text}</span>
          </div>` : ''}
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200 dark:border-white/10">
            <span class="text-slate-500 dark:text-ink-400">VIIRS Radiance:</span>
            <span class="${alert.viirs_data_available !== false ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-amber-700 dark:text-amber-300 font-medium'} flex items-center gap-1">
              ${alert.viirs_data_available !== false ? '✓ Ready to Simulate' : '⏳ VIIRS Data Pending'}
            </span>
          </div>
        </div>
        <div class="action-btn-placeholder"></div>
      `;

      const btnPlaceholder = popupContainer.querySelector('.action-btn-placeholder');
      if (btnPlaceholder && onSimulateGdacs) {
        const btn = document.createElement('button');
        btn.type = 'button';
        const isViirsAvailable = alert.viirs_data_available !== false;

        if (isActive) {
          btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center justify-center gap-1.5 cursor-default';
          btn.innerHTML = '<span>✓ Active Simulation</span>';
        } else if (!isViirsAvailable) {
          btn.disabled = true;
          btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-medium text-ink-400 bg-white/5 border border-white/10 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-60';
          btn.title = 'Simulation disabled: Live hazard pending NASA VIIRS nightlight radiance data';
          btn.innerHTML = '<span>🔒 Simulate Event (VIIRS Pending)</span>';
        } else {
          btn.className = 'w-full py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-ocean-600 to-ocean-500 hover:from-ocean-500 hover:to-ocean-400 shadow-md shadow-ocean-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.02] active:scale-95';
          btn.innerHTML = '<span>Simulate Event</span>';
          btn.title = 'Ready to Simulate: Confirmed NASA VIIRS radiance data available';
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
    <div
      className="relative w-full overflow-hidden rounded-xl"
      onMouseEnter={() => onMapHoverChange?.(true)}
      onMouseLeave={() => onMapHoverChange?.(false)}
    >
      {/* Static initial class; applyMapLock() mutates classList directly without re-rendering LeafletMap */}
      <div
        ref={mapElement}
        className="leaflet-map is-locked"
        aria-label="Philippine municipality recovery map"
      />

      {/* Overlay buttons live in their own component so their state changes
          never propagate back up into LeafletMap and never touch the tile layer. */}
      <MapLockOverlay
        onUnlock={() => applyMapLock(false)}
        onLock={() => { applyMapLock(true); resetToPanayBounds(true); }}
        onReset={handleReset}
      />
    </div>
  );
}

// ─── MapLockOverlay ──────────────────────────────────────────────────────────
// Isolated button component whose re-renders are fully decoupled from LeafletMap.
// It owns the visual toggle state; all Leaflet side-effects are handled by the
// callbacks passed from LeafletMap via applyMapLock().
interface MapLockOverlayProps {
  onUnlock: () => void;
  onLock: () => void;
  onReset: () => void;
}
function MapLockOverlay({ onUnlock, onLock, onReset }: MapLockOverlayProps) {
  const [isLocked, setIsLocked] = useState<boolean>(true);

  const handleUnlock = () => {
    setIsLocked(false);
    onUnlock();
  };

  const handleLock = () => {
    setIsLocked(true);
    onLock();
  };

  return (
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
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ink-950/90 hover:bg-ink-900 text-ink-300 hover:text-white border border-white/10 hover:border-white/25 shadow-lg shadow-black/50 backdrop-blur-md transition-all text-xs font-medium cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
            aria-label="Reset map view to Panay Island"
            title="Re-center on Panay Island (Default)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-ink-400" />
            <span className="hidden sm:inline">Reset Panay</span>
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
  );
}

function updateLayerStyle(layer: any, municipality: Municipality, selected: boolean, isLight = false) {
  if (layer && typeof layer.setStyle === 'function') {
    layer.setStyle({
      color: selected
        ? (isLight ? '#0f172a' : '#ffffff')
        : (isLight ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255,255,255,0.4)'),
      weight: selected ? 2.5 : 1.2,
      fillColor: getRecoveryColor(municipality.recoveryScore),
      fillOpacity: selected ? 0.95 : (isLight ? 0.68 : 0.65),
    });
  }
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-slate-600 dark:text-ink-400 hidden sm:inline">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-ink-950/50 border border-slate-200 dark:border-white/5 p-3 transition-colors">
      <p className="text-[11px] text-slate-500 dark:text-ink-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}
