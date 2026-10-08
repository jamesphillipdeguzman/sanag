import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipality, GdacsAlert, DisasterEvent } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor, createMunicipalities } from '@/data/mockData';
import { Compass, Globe, Lock, Loader2, MapPin, Radio, RotateCcw, X, Layers, Volume2, VolumeX, Sparkles, Moon, Ruler } from 'lucide-react';
import { useAudioSpatialIndicator, type EmergencyAudioStatus } from '@/utils/audioSpatialIndicator';
import { useTheme } from '@/context/ThemeContext';
import { useSettings, type BasemapSource } from '@/context/SettingsContext';

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
  activeEvent?: DisasterEvent | null;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  selectedRegionKey?: string;
  onRegionChange?: (regionKey: string) => void;
  onMunicipalitiesLoaded?: (newItems: Municipality[]) => void;
  isActiveTab?: boolean;
  nightGlowMode?: boolean;
  onNightGlowModeChange?: (enabled: boolean) => void;
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
  activeEvent?: DisasterEvent | null;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  selectedRegionKey?: string;
  onRegionChange?: (key: string) => void;
  onChunkLoaded?: (newItems: Municipality[]) => void;
  onChunkLoadingChange?: (loading: boolean) => void;
  isActiveTab?: boolean;
  nightGlowMode?: boolean;
  onNightGlowModeChange?: (enabled: boolean) => void;
  onZoomChange?: (zoom: number) => void;
}

const statusLabels: Record<string, string> = {
  restored: 'Near-Full Recovery',
  recovering: 'Active Restoration',
  warning: 'Active Restoration',
  critical: 'Critical Deficit',
};

function MapLoadingSkeleton() {
  return (
    <div
      className="leaflet-map relative flex flex-col items-center justify-center p-6 text-center overflow-hidden border border-slate-200 dark:border-white/5 bg-slate-50/90 dark:bg-ink-950/70 select-none rounded-xl transition-colors"
      aria-label="Loading Panay Island nightlight telemetry"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden opacity-60">
        <div className="absolute w-[440px] h-[440px] rounded-full border border-ocean-500/20 dark:border-ocean-500/10 animate-ping" style={{ animationDuration: '4s' }} />
        <div className="absolute w-[320px] h-[320px] rounded-full border border-ocean-500/25 dark:border-ocean-500/15" />
        <div className="absolute w-[200px] h-[200px] rounded-full border border-ocean-500/30 dark:border-ocean-500/20" />
        <div className="absolute w-[90px] h-[90px] rounded-full border border-ocean-500/35 dark:border-ocean-500/30" />
        <div className="absolute w-2 h-2 rounded-full bg-ocean-500 dark:bg-ocean-400 shadow-[0_0_12px_#3b82f6] dark:shadow-[0_0_12px_#70b0ff]" />
      </div>

      <div className="relative z-10 flex flex-col items-center max-w-sm p-6 sm:p-7 rounded-2xl bg-white/95 dark:bg-ink-900/85 border border-slate-200 dark:border-white/10 shadow-xl dark:shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-md transition-colors">
        <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-ocean-100/80 dark:bg-ocean-500/10 border border-ocean-300/80 dark:border-ocean-500/30 mb-3.5 shadow-sm dark:shadow-[0_0_25px_rgba(89,159,253,0.18)]">
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
          </span>
          <Radio className="h-6 w-6 text-ocean-600 dark:text-ocean-400 animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-ocean-200 dark:border-ocean-500/30 bg-ocean-50 dark:bg-ocean-500/15 px-3 py-1 mb-2.5">
          <Loader2 className="h-3 w-3 text-ocean-600 dark:text-ocean-300 animate-spin" />
          <span className="text-[11px] font-semibold text-ocean-700 dark:text-ocean-200 uppercase tracking-wider">
            Loading Satellite Telemetry
          </span>
        </div>

        <h4 className="text-base font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Loading Panay Island Municipality Boundaries
        </h4>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
          Retrieving VIIRS radiance baselines and computing spatial restoration indexes across Panay Island LGUs...
        </p>

        <div className="w-52 h-1.5 bg-slate-200 dark:bg-ink-800/80 rounded-full mt-4 overflow-hidden relative border border-slate-300/50 dark:border-white/5">
          <div className="absolute inset-y-0 w-2/5 bg-gradient-to-r from-transparent via-ocean-500 dark:via-ocean-400 to-emerald-500 dark:to-emerald-400 rounded-full animate-shimmer" />
        </div>

        <div className="flex items-center gap-1.5 mt-3.5 text-[10px] font-medium text-slate-500 dark:text-ink-400">
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">Iloilo</span>
          <span className="text-slate-400 dark:text-ink-600">·</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">Capiz</span>
          <span className="text-slate-400 dark:text-ink-600">·</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">Aklan</span>
          <span className="text-slate-400 dark:text-ink-600">·</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-600 dark:text-slate-300">Antique</span>
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
  activeEvent,
  onSimulateGdacs,
  selectedRegionKey: externalRegionKey,
  onRegionChange: externalOnRegionChange,
  onMunicipalitiesLoaded,
  isActiveTab = true,
  nightGlowMode: externalNightGlowMode,
  onNightGlowModeChange,
}: PanayMapProps) {
  const { settings, updateSetting } = useSettings();
  const [internalNightGlow, setInternalNightGlow] = useState<boolean>(() => settings?.defaultNightGlow || false);
  const nightGlowMode = externalNightGlowMode ?? internalNightGlow;
  const handleNightGlowToggle = () => {
    const next = !nightGlowMode;
    setInternalNightGlow(next);
    onNightGlowModeChange?.(next);
    updateSetting('defaultNightGlow', next);
  };
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showGdacsMarkers, setShowGdacsMarkers] = useState(true);
  const [internalRegionKey, setInternalRegionKey] = useState<string>(() => settings?.defaultRegion || 'panay');
  const [extraMunicipalities, setExtraMunicipalities] = useState<Municipality[]>([]);
  const [isRegionChunkLoading, setIsRegionChunkLoading] = useState<boolean>(false);
  const [showScaleRuler, setShowScaleRuler] = useState<boolean>(() => settings?.showScaleRuler || false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [mapZoom, setMapZoom] = useState(8);

  // Synchronize internal states if user updates preferences in SettingsModal
  useEffect(() => {
    if (settings?.defaultRegion && !externalRegionKey) {
      setInternalRegionKey(settings.defaultRegion);
    }
  }, [settings?.defaultRegion, externalRegionKey]);

  useEffect(() => {
    if (settings?.defaultNightGlow !== undefined && externalNightGlowMode === undefined) {
      setInternalNightGlow(settings.defaultNightGlow);
    }
  }, [settings?.defaultNightGlow, externalNightGlowMode]);

  useEffect(() => {
    if (settings?.showScaleRuler !== undefined) {
      setShowScaleRuler(settings.showScaleRuler);
    }
  }, [settings?.showScaleRuler]);

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
        {/* Keep the panel chrome on the app theme; night glow darkens only the map viewport. */}
        <div className={`relative rounded-2xl border ${nightGlowMode ? 'border-amber-500/25 bg-white/95 dark:bg-ink-900/60 shadow-[0_0_35px_rgba(255,170,51,0.08)]' : 'border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 shadow-sm dark:shadow-xl'} backdrop-blur-sm overflow-hidden flex flex-col h-full transition-all duration-300`}>
          {/* Map header with Region Selector */}
          <div className={`flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-3 border-b ${nightGlowMode ? 'border-amber-500/20 bg-slate-50/80 dark:bg-ink-950/40' : 'border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-ink-950/40'} transition-colors`}>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Philippine Satellite Grid</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-ocean-500/20 text-ocean-700 dark:text-ocean-300 border border-ocean-500/30">
                  {currentRegionKey === 'panay' ? 'Panay Island (Default)' : activePreset.name}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25" title="Hardware-accelerated HTML5 Canvas (L.canvas) renderer">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                  Canvas 2D Engine
                </span>
                {nightGlowMode && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/35 shadow-sm shadow-amber-500/20 animate-fade-in" title="NASA Black Marble VIIRS DNB Day/Night Band Composite Active">
                    <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-300 animate-pulse" />
                    Black Marble VIIRS
                  </span>
                )}
                {isRegionChunkLoading && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ocean-700 dark:text-ocean-300 bg-ocean-50 dark:bg-ocean-500/15 border border-ocean-200 dark:border-ocean-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin text-ocean-600 dark:text-ocean-300" />
                    Loading {activePreset.name}...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">
                {nightGlowMode ? (
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                    <span className="text-amber-600 dark:text-amber-300 font-semibold">NASA Black Marble Composite</span>
                    <span>· Realistic VIIRS Night Lights · Harmonized Orbital Basemap</span>
                    {recoveryDate ? ` · Reading: ${recoveryDate}` : ''}
                  </span>
                ) : (
                  <>
                    NASA VIIRS radiance overlay · Nationwide Philippine municipality boundaries
                    {recoveryDate ? ` · Latest reading: ${recoveryDate}` : ''}
                  </>
                )}
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
                    <option value="philippines" className="bg-white dark:bg-ink-950 text-slate-800 dark:text-white">Nationwide (Philippines)</option>
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

              {/* Realistic Night Glow NASA Black Marble Composite Toggle */}
              <button
                type="button"
                id="realistic-night-glow-toggle"
                onClick={handleNightGlowToggle}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${nightGlowMode
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20 ring-1 ring-amber-500/30'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-ink-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                  }`}
                title="Toggle NASA Black Marble Realistic Night Light composite view"
                aria-pressed={nightGlowMode}
              >
                <Sparkles className={`h-3.5 w-3.5 ${nightGlowMode ? 'text-amber-500 dark:text-amber-300 animate-pulse' : 'text-slate-500 dark:text-ink-400'}`} />
                <span>Realistic Night Glow</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-mono font-bold tracking-wider ${nightGlowMode
                    ? 'bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/40'
                    : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-ink-400'
                    }`}
                >
                  {nightGlowMode ? 'NASA VIIRS' : 'OFF'}
                </span>
              </button>

              {/* VIIRS 500m Scale Ruler Toggle */}
              <button
                type="button"
                id="viirs-scale-ruler-toggle"
                onClick={() => {
                  const next = !showScaleRuler;
                  setShowScaleRuler(next);
                  updateSetting('showScaleRuler', next);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${showScaleRuler
                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/20 ring-1 ring-sky-500/30'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-ink-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                  }`}
                title={showScaleRuler ? 'Hide VIIRS 500m pixel scale ruler' : 'Pin VIIRS 500m pixel scale ruler (also appears on hover)'}
                aria-pressed={showScaleRuler}
              >
                <Ruler className={`h-3.5 w-3.5 ${showScaleRuler ? 'text-sky-500 dark:text-sky-300' : 'text-slate-500 dark:text-ink-400'}`} />
                <span className="hidden sm:inline">Scale Ruler</span>
              </button>

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
                onClick={() => {
                  toggleAudio();
                  updateSetting('audioFeedback', !isAudioEnabled);
                }}
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

              {nightGlowMode ? (
                <>
                  <LegendDot color="#ffaa33" label=">= 90% Near-Full Recovery" glow />
                  <LegendDot color="#e08b18" label="60%–89% Active Restoration" />
                  <LegendDot color="#121722" label="< 60% Critical Deficit" />
                </>
              ) : (
                <>
                  <LegendDot color="#10b981" label=">= 90% Near-Full Recovery" />
                  <LegendDot color="#f59e0b" label="60%–89% Active Restoration" />
                  <LegendDot color="#ef4444" label="< 60% Critical Deficit" />
                </>
              )}
            </div>
          </div>

          {/* Leaflet GeoJSON map */}
          <div
            className={`relative dot-bg p-2 flex-1 min-h-[360px] flex flex-col justify-center ${nightGlowMode ? 'bg-[#0b0f19]' : ''}`}
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
                  activeEvent={activeEvent}
                  onSimulateGdacs={onSimulateGdacs}
                  selectedRegionKey={currentRegionKey}
                  onRegionChange={handleRegionChange}
                  onChunkLoaded={handleChunkLoaded}
                  onChunkLoadingChange={setIsRegionChunkLoading}
                  isActiveTab={isActiveTab}
                  nightGlowMode={nightGlowMode}
                  onNightGlowModeChange={handleNightGlowToggle}
                  onZoomChange={setMapZoom}
                />

                {/* 500m VIIRS Spatial Grid Overlay */}
                {showGrid && <div className="viirs-grid-pane animate-fade-in" />}

                <VIIRSScaleRuler
                  pinned={showScaleRuler}
                  nightGlow={nightGlowMode}
                  mapHovered={!!hoveredId}
                  showGrid={showGrid}
                  onToggleGrid={() => setShowGrid((v) => !v)}
                  zoom={mapZoom}
                  scaleCalibration={settings?.scaleCalibration ?? 1.0}
                />

                {isLoading && municipalities.length > 0 && (
                  <div className="absolute top-4 left-4 z-[1001] flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/95 dark:bg-ink-950/85 border border-ocean-300/80 dark:border-ocean-500/30 text-ocean-700 dark:text-ocean-300 text-xs backdrop-blur-md shadow-lg pointer-events-none animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin text-ocean-600 dark:text-ocean-300" />
                    <span className="font-semibold text-slate-800 dark:text-slate-100">Calibrating radiance...</span>
                  </div>
                )}

                {/* Hover tooltip — highest z so it always floats above the scale overlay */}
                {hovered && !selected && (
                  <div className="absolute pointer-events-none bottom-4 left-4 z-[1100] glass rounded-xl px-4 py-3 max-w-xs animate-fade-in shadow-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/90 backdrop-blur-md">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor: nightGlowMode
                              ? (hovered.recoveryScore >= 90 ? '#ffaa33' : hovered.recoveryScore >= 60 ? '#e08b18' : '#121722')
                              : getRecoveryColor(hovered.recoveryScore),
                            boxShadow: nightGlowMode && hovered.recoveryScore >= 60 ? '0 0 8px #ffaa33' : undefined,
                            border: nightGlowMode && hovered.recoveryScore < 60 ? '1px solid rgba(255,255,255,0.2)' : undefined,
                          }}
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
                        Status: <span style={{
                          color: nightGlowMode
                            ? (hovered.recoveryScore >= 90 ? '#ffaa33' : hovered.recoveryScore >= 60 ? '#e08b18' : '#94a3b8')
                            : getRecoveryStatusColor(hovered.status)
                        }}>
                          {nightGlowMode && hovered.status === 'restored'
                            ? 'Near-Full Recovery'
                            : nightGlowMode && (hovered.status === 'critical' || hovered.recoveryScore < 60)
                              ? 'Critical Deficit'
                              : statusLabels[hovered.status] || (hovered.recoveryScore >= 90 ? 'Near-Full Recovery' : hovered.recoveryScore >= 60 ? 'Active Restoration' : 'Critical Deficit')}
                        </span>
                      </span>
                    </div>
                    {nightGlowMode && (
                      <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-300/90 mt-1 pt-1 border-t border-slate-200 dark:border-white/5">
                        <span>VIIRS Radiance:</span>
                        <span className="font-mono font-semibold">
                          {(hovered.currentRadiance ?? (hovered.recoveryScore * 0.45)).toFixed(1)} nW/cm²/sr
                        </span>
                      </div>
                    )}
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
          <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-ink-900/80 text-slate-700 dark:text-slate-300 transition-colors">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-28 sm:w-36 rounded-full overflow-hidden">
                {nightGlowMode ? (
                  <>
                    <div className="flex-1 bg-[#121722]" title="< 60% Critical Deficit" />
                    <div className="flex-1 bg-[#e08b18]" title="60%–89% Active Restoration" />
                    <div className="flex-1 bg-gradient-to-r from-[#ffaa33] to-[#ffc04d] shadow-[0_0_8px_#ffaa33]" title=">= 90% Near-Full Recovery" />
                  </>
                ) : (
                  <>
                    <div className="flex-1 bg-[#ef4444]" title="< 60% Critical Deficit" />
                    <div className="flex-1 bg-[#f59e0b]" title="60%–89% Active Restoration" />
                    <div className="flex-1 bg-[#10b981]" title=">= 90% Near-Full Recovery" />
                  </>
                )}
              </div>
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                {nightGlowMode ? 'NASA Black Marble Radiance (0–100)' : 'Recovery Score (0–100)'}
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
              {nightGlowMode
                ? 'Photorealistic VIIRS Night Light Composite · Warm Golden Radiance & Atmospheric Bloom'
                : 'Projection model: VIIRS-DNB vs Pre-event Baseline'}
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
                ? 'Covers 95 fine-grained LGUs in Iloilo, Capiz, Aklan, and Antique'
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

function getBaseTileUrl(isLightMode: boolean, nightGlow: boolean = false, basemapSource?: BasemapSource): string {
  const apiKey = (import.meta.env.VITE_MY_API_KEY as string | undefined)?.trim();
  const queryParam = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';

  // In Realistic Night Glow mode or Black Marble / VIIRS basemap selection, darken orbital base
  if (basemapSource === 'black-marble' || basemapSource === 'viirs-night-lights' || nightGlow) {
    return `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${queryParam}`;
  }

  return isLightMode
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png${queryParam}`
    : `https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${queryParam}`;
}

// Compute geographic centroid from GeoJSON feature geometry as fallback
function getFeatureCentroid(feature: GeoJSON.Feature): [number, number] | null {
  if (!feature.geometry) return null;
  const geom = feature.geometry;
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;

  const traverse = (coords: any) => {
    if (Array.isArray(coords)) {
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        totalLng += coords[0];
        totalLat += coords[1];
        count++;
      } else {
        coords.forEach(traverse);
      }
    }
  };

  traverse((geom as any).coordinates);
  if (count === 0) return null;
  return [totalLat / count, totalLng / count];
}

// Realistic Night Light NASA Black Marble Palette vs Standard Vector Fills
function getPolygonStyle(
  municipality: Municipality | null | undefined,
  isSelected: boolean | null | undefined,
  isLight: boolean | null | undefined,
  nightGlow: boolean | null | undefined
) {
  const selected = Boolean(isSelected);
  const light = Boolean(isLight);
  const glow = Boolean(nightGlow);
  const score = municipality?.recoveryScore ?? 50;

  if (glow) {
    if (score >= 90) {
      // Near-Full Recovery / Active Urban Center: Warm golden-amber with clear boundary lines
      return {
        color: selected ? '#ffffff' : 'rgba(255, 192, 77, 0.85)',
        weight: selected ? 2.5 : 1.2,
        opacity: selected ? 1.0 : 0.80,
        fillColor: '#b86e18',
        fillOpacity: selected ? 0.70 : 0.28,
        lineJoin: 'round' as const,
        lineCap: 'round' as const,
      };
    } else if (score >= 60) {
      // Active Restoration: Moderate warm amber
      return {
        color: selected ? '#ffffff' : 'rgba(224, 145, 35, 0.75)',
        weight: selected ? 2.2 : 1.0,
        opacity: selected ? 1.0 : 0.70,
        fillColor: '#8c4e12',
        fillOpacity: selected ? 0.65 : 0.22,
        lineJoin: 'round' as const,
        lineCap: 'round' as const,
      };
    } else {
      // Critical Deficit (<60%): Deeply extinguished near-black charcoal slate with subtle slate border (#334155)
      // to preserve the geographic silhouette of the island against the ocean
      return {
        color: selected ? '#ef4444' : '#334155',
        weight: selected ? 2.0 : 1.0,
        opacity: selected ? 1.0 : 0.30,
        fillColor: '#0e131d',
        fillOpacity: selected ? 0.80 : 0.35,
        lineJoin: 'round' as const,
        lineCap: 'round' as const,
      };
    }
  }

  // Standard Vector Status
  const color = getRecoveryColor(score);
  return {
    color: selected
      ? (light ? '#0f172a' : '#ffffff')
      : (light ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.4)'),
    weight: selected ? 2.5 : 1.2,
    fillColor: color,
    fillOpacity: selected ? 0.95 : (light ? 0.68 : 0.65),
    lineJoin: 'round' as const,
    lineCap: 'round' as const,
  };
}

// ─── Realistic Night Light Canvas Overlay (NASA Black Marble Inspired) ───────────
// Hardware-accelerated HTML5 Canvas drawing atmospheric radiance bloom, warm
// golden-orange photon halos, and orbital urban clusters synchronized with Leaflet.
interface NightLightOverlayOptions {
  getMunicipalities?: () => Municipality[];
  getCentroids?: () => Map<string, [number, number]>;
  getSelectedId?: () => string | null;
  municipalitiesByIdRef?: React.RefObject<Map<string, Municipality> | null> | React.MutableRefObject<Map<string, Municipality>>;
  centroidsRef?: React.RefObject<Map<string, [number, number]> | null> | React.MutableRefObject<Map<string, [number, number]>>;
  selectedIdRef?: React.RefObject<string | null> | React.MutableRefObject<string | null>;
}

const NightLightOverlay = (L.Layer as any).extend({
  initialize: function (options: NightLightOverlayOptions) {
    this._options = options || {};
  },
  onAdd: function (map: L.Map) {
    this._map = map;
    let pane = map.getPane('nightLightGlowPane');
    if (!pane) {
      pane = map.createPane('nightLightGlowPane');
      pane.style.zIndex = '350'; // Positioned below overlayPane (400) so municipal boundaries remain clearly visible
      pane.style.pointerEvents = 'none';
    }

    const canvas = L.DomUtil.create('canvas', 'leaflet-night-light-canvas') as HTMLCanvasElement;
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.opacity = '0.65'; // Lowered canvas opacity so underlying LGU borders stay clearly visible
    pane.appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');

    this._handleMove = () => this._update();
    map.on('move', this._handleMove);
    map.on('zoom', this._handleMove);
    map.on('viewreset', this._handleMove);
    map.on('resize', this._handleMove);

    this._update();
    return this;
  },
  onRemove: function (map: L.Map) {
    if (this._handleMove) {
      map.off('move', this._handleMove);
      map.off('zoom', this._handleMove);
      map.off('viewreset', this._handleMove);
      map.off('resize', this._handleMove);
    }
    if (this._canvas && this._canvas.parentNode) {
      this._canvas.parentNode.removeChild(this._canvas);
    }
    this._canvas = null;
    this._ctx = null;
    return this;
  },
  redraw: function () {
    if (this._map && this._canvas) {
      this._update();
    }
  },
  _update: function () {
    if (!this._map || !this._canvas || !this._ctx) return;
    const size = this._map.getSize();
    const bounds = this._map.getBounds();
    if (!bounds || !bounds.isValid()) return;
    const topLeft = this._map.latLngToLayerPoint(bounds.getNorthWest());

    L.DomUtil.setPosition(this._canvas, topLeft);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.width = Math.round(size.x * dpr);
    this._canvas.height = Math.round(size.y * dpr);
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;

    this._draw(topLeft, dpr, size);
  },
  _draw: function (topLeft: L.Point, dpr: number, size: L.Point) {
    const ctx = this._ctx;
    const map = this._map;
    if (!ctx || !map) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.x, size.y);

    const municipalities: Municipality[] = typeof this._options?.getMunicipalities === 'function'
      ? (this._options.getMunicipalities() || [])
      : this._options?.municipalitiesByIdRef?.current
        ? Array.from(this._options.municipalitiesByIdRef.current.values())
        : [];
    const centroids: Map<string, [number, number]> = typeof this._options?.getCentroids === 'function'
      ? (this._options.getCentroids() || new Map())
      : this._options?.centroidsRef?.current || new Map();
    const selectedId: string | null = typeof this._options?.getSelectedId === 'function'
      ? this._options.getSelectedId()
      : this._options?.selectedIdRef?.current || null;
    const zoom = map.getZoom();

    // Controlled photon blending with lowered opacity (0.65) and 'screen' composite mode to prevent blown-out blobs
    ctx.globalAlpha = 0.65;
    ctx.globalCompositeOperation = 'screen';

    for (const m of municipalities) {
      const coords = centroids.get(m.id) || (m.pcode ? centroids.get(m.pcode) : null);
      if (!coords) continue;

      const layerPt = map.latLngToLayerPoint(L.latLng(coords[0], coords[1]));
      const x = layerPt.x - topLeft.x;
      const y = layerPt.y - topLeft.y;

      // Culling offscreen points with generous margin for radiance halo visibility
      if (x < -140 || x > size.x + 140 || y < -140 || y > size.y + 140) continue;

      const score = m.recoveryScore ?? 50;
      if (score < 40) continue; // Outage disaster zones remain completely dark in Black Marble orbital view

      const isSelected = m.id === selectedId;
      const pop = m.population || 35000;
      const popFactor = Math.min(2.0, Math.max(0.75, Math.sqrt(pop / 35000)));
      const zoomFactor = Math.pow(1.18, Math.max(0, zoom - 7));

      // Scaled radiance gradient: tighter footprint so individual urban hubs are distinct
      const baseRadius = (score >= 80 ? 16 : score >= 60 ? 11 : 6) * popFactor;
      const radius = Math.min(52, Math.max(7, baseRadius * zoomFactor));

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      if (score >= 80) {
        // Restored / Active Urban Center: Warm golden-amber radiance (#ffcc00 / #ffaa33) - softer warm tone
        grad.addColorStop(0.0, 'rgba(255, 204, 0, 0.85)');   // Soft golden-amber inner core #ffcc00 (no blinding white)
        grad.addColorStop(0.18, 'rgba(255, 170, 40, 0.65)');  // Warm radiant gold #ffaa28
        grad.addColorStop(0.45, 'rgba(255, 140, 25, 0.35)');  // Warm amber halo #ff8c19
        grad.addColorStop(0.75, 'rgba(224, 100, 10, 0.12)');  // Gentle atmospheric scatter
        grad.addColorStop(1.0, 'rgba(200, 70, 0, 0)');        // Smooth falloff
      } else if (score >= 60) {
        // Recovering: Moderate warm amber
        grad.addColorStop(0.0, 'rgba(255, 170, 30, 0.75)');   // Softer amber core #ffaa1e
        grad.addColorStop(0.25, 'rgba(224, 130, 20, 0.45)');  // Warm ember
        grad.addColorStop(0.60, 'rgba(180, 85, 15, 0.18)');
        grad.addColorStop(1.0, 'rgba(140, 50, 5, 0)');
      } else {
        // Limited: Dim muted ember
        grad.addColorStop(0.0, 'rgba(200, 110, 20, 0.50)');
        grad.addColorStop(0.40, 'rgba(140, 65, 10, 0.18)');
        grad.addColorStop(1.0, 'rgba(90, 35, 5, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Sub-pixel urban light filaments and cluster specks around core
      if ((pop >= 45000 && score >= 70) || isSelected) {
        const speckCount = isSelected ? 6 : Math.min(4, Math.floor(pop / 35000) + 1);
        let seed = 0;
        for (let i = 0; i < m.id.length; i++) seed = (seed * 31 + m.id.charCodeAt(i)) >>> 0;

        for (let s = 0; s < speckCount; s++) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const angle = ((seed % 360) * Math.PI) / 180;
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const dist = (0.20 + ((seed % 100) / 100) * 0.55) * radius * 0.55;

          const sx = x + Math.cos(angle) * dist;
          const sy = y + Math.sin(angle) * dist;
          const speckRadius = 0.8 + ((seed % 100) / 100) * 1.0;

          const speckGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, speckRadius * 2);
          speckGrad.addColorStop(0.0, 'rgba(255, 215, 60, 0.75)'); // Soft warm amber speck core
          speckGrad.addColorStop(0.5, 'rgba(255, 160, 30, 0.45)');
          speckGrad.addColorStop(1.0, 'rgba(220, 120, 10, 0)');

          ctx.fillStyle = speckGrad;
          ctx.beginPath();
          ctx.arc(sx, sy, speckRadius * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Selected municipality: glowing warm amber highlight ring
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = '#ffc04d';
        ctx.lineWidth = 2.0;
        ctx.shadowColor = '#ffaa33';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, Math.min(radius * 0.5, 20), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  },
});

function LeafletMap({
  municipalities,
  selectedId,
  onSelect,
  onHover,
  onMapHoverChange,
  gdacsAlerts = [],
  showGdacsMarkers = true,
  activeEventId,
  activeEvent,
  onSimulateGdacs,
  selectedRegionKey = 'panay',
  onRegionChange,
  onChunkLoaded,
  onChunkLoadingChange,
  isActiveTab = true,
  nightGlowMode = false,
  onNightGlowModeChange,
  onZoomChange,
}: LeafletMapProps) {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const isLight = theme === 'light';
  const isLightRef = useRef(isLight);
  isLightRef.current = isLight;

  const nightGlowModeRef = useRef<boolean>(nightGlowMode);
  nightGlowModeRef.current = nightGlowMode;

  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<Record<string, any>>({});
  const gdacsGroupRef = useRef<L.LayerGroup | null>(null);
  const defaultBoundsRef = useRef<L.LatLngBounds | null>(null);
  const municipalitiesByIdRef = useRef<Map<string, Municipality>>(new Map());
  const centroidsRef = useRef<Map<string, [number, number]>>(new Map());
  const nightLightOverlayRef = useRef<any>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onMapHoverChangeRef = useRef(onMapHoverChange);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const islandSilhouetteLayerRef = useRef<L.GeoJSON | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const regionCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());

  // Handle map invalidation, size re-calculations, and tile layer preservation when Map tab becomes active or window resizes
  useEffect(() => {
    const handleInvalidate = () => {
      const map = mapRef.current;
      const el = mapElement.current;
      // Guard against zero-dimension layout calls while hidden or during unmount
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
      if (!map || !(map as any)._loaded || !(map as any)._panes) return;

      try {
        map.invalidateSize({ debounceMoveend: false });

        const currentTileLayer = tileLayerRef.current;
        const tileUrl = getBaseTileUrl(isLightRef.current, nightGlowModeRef.current);
        const tilePane = (map as any)._panes?.tilePane;

        const isAttached = Boolean(currentTileLayer && map.hasLayer(currentTileLayer));
        const containerValid = Boolean(
          currentTileLayer &&
          (currentTileLayer as any)._container &&
          tilePane &&
          tilePane.contains((currentTileLayer as any)._container)
        );

        // Check if there are active tile records or tile image elements
        const hasTileRecords = Boolean(
          currentTileLayer &&
          Object.keys((currentTileLayer as any)._tiles || {}).length > 0
        );
        const hasTileElements = Boolean(
          containerValid &&
          (currentTileLayer as any)._container.getElementsByTagName('img').length > 0
        );

        // If tile layer was detached, lost its container in tilePane, or has no active tiles, cleanly re-attach
        if (!isAttached || !containerValid || (!hasTileRecords && !hasTileElements)) {
          if (currentTileLayer && map.hasLayer(currentTileLayer)) {
            try {
              map.removeLayer(currentTileLayer);
            } catch { }
          }
          tileLayerRef.current = null;

          const newTileLayer = L.tileLayer(tileUrl, {
            subdomains: 'abcd',
            maxZoom: 20,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          });
          newTileLayer.addTo(map);
          tileLayerRef.current = newTileLayer;
        }
      } catch (err) {
        console.warn('[PanayMap] Error during handleInvalidate:', err);
      }
    };

    window.addEventListener('sanag:invalidate-map-size', handleInvalidate);
    window.addEventListener('resize', handleInvalidate);

    if (isActiveTab) {
      const timer1 = setTimeout(handleInvalidate, 50);
      const timer2 = setTimeout(handleInvalidate, 150);
      const timer3 = setTimeout(handleInvalidate, 350);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
        window.removeEventListener('sanag:invalidate-map-size', handleInvalidate);
        window.removeEventListener('resize', handleInvalidate);
      };
    }

    return () => {
      window.removeEventListener('sanag:invalidate-map-size', handleInvalidate);
      window.removeEventListener('resize', handleInvalidate);
    };
  }, [isActiveTab]);

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
  const initialLocked = settings?.defaultInteractionMode === 'locked';
  const isLockedRef = useRef<boolean>(initialLocked);

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
      const url = key === 'philippines'
        ? '/philippines_boundaries.geojson'
        : key === 'panay'
          ? '/regions/panay.geojson'
          : `/regions/${key}.geojson`;
      let res = await fetch(url);
      if (!res.ok && key === 'panay') {
        res = await fetch('/panay_municipalities.geojson');
      }
      if (res.ok) {
        const geojson: GeoJSON.FeatureCollection = await res.json();
        if (key === 'panay' && geojson.features) {
          geojson.features = geojson.features.filter((f: GeoJSON.Feature) => {
            const adm2 = (f.properties?.ADM2_EN || f.properties?.province || '').toLowerCase().trim();
            const pcode = f.properties?.ADM3_PCODE || f.properties?.psgc_code || '';
            return adm2 !== 'guimaras' && !pcode.startsWith('PH06079');
          });
        }
        regionCacheRef.current.set(key, geojson);
        return geojson;
      }
    } catch (err) {
      console.warn(`Failed to fetch region chunk for ${key}:`, err);
    } finally {
      onChunkLoadingChange?.(false);
    }

    return regionCacheRef.current.get(key) || null;
  };

  // Function to bind fine-grained municipal features for the active region using HTML5 Canvas
  const renderRegionGeoJson = (regionKey: string, data: GeoJSON.FeatureCollection) => {
    const map = mapRef.current;
    if (!map || !data || !data.features) return;

    // Safely remove prior layers before binding new municipal collection
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }
    if (islandSilhouetteLayerRef.current) {
      map.removeLayer(islandSilhouetteLayerRef.current);
      islandSilhouetteLayerRef.current = null;
    }
    layersRef.current = {};

    // Register any newly encountered municipalities into municipalitiesByIdRef and propagate to parent
    const newToRegister: GeoJSON.Feature[] = [];
    data.features.forEach((feat: GeoJSON.Feature) => {
      const props = feat.properties || {};
      const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
      const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
      if (id && !municipalitiesByIdRef.current.has(id)) {
        newToRegister.push(feat);
      }
      // Cache fallback centroid from feature geometry
      if (!centroidsRef.current.has(id)) {
        const center = getFeatureCentroid(feat);
        if (center) {
          centroidsRef.current.set(id, center);
          if (pcode) centroidsRef.current.set(pcode, center);
        }
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

    // Island silhouette & boundary layer: guarantees that the geographic shape of Panay Island
    // and all internal municipal boundaries remain crisp and distinct against the dark oceanic basemap.
    if (!map.getPane('islandSilhouettePane')) {
      const sp = map.createPane('islandSilhouettePane');
      sp.style.zIndex = '300';
      sp.style.pointerEvents = 'none';
    }

    const silhouetteLayer = L.geoJSON(data, {
      pane: 'islandSilhouettePane',
      interactive: false,
      style: () => ({
        renderer: canvasRendererRef.current || undefined,
        color: '#334155', // Subtle slate border
        weight: 1.4,
        opacity: nightGlowModeRef.current ? 0.35 : 0.15,
        fillColor: '#0c121e',
        fillOpacity: nightGlowModeRef.current ? 0.40 : 0.05,
        lineJoin: 'round',
        lineCap: 'round',
      }),
    }).addTo(map);
    islandSilhouetteLayerRef.current = silhouetteLayer;

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

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));
        const lightMode = isLightRef.current;
        const isNight = nightGlowModeRef.current;
        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, lightMode, isNight),
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

        // Extract precise polygon bounds centroid for the radiance canvas
        if (typeof (featureLayer as any).getBounds === 'function') {
          const bounds = (featureLayer as any).getBounds();
          if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            const center = bounds.getCenter();
            centroidsRef.current.set(id, [center.lat, center.lng]);
            if (pcode) centroidsRef.current.set(pcode, [center.lat, center.lng]);
          }
        }

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const initialName = municipality?.name || rawName;
        const initialProvince = municipality?.province || String(props.ADM2_EN || props.province || '');
        const initialScore = municipality?.recoveryScore ?? 50;

        const isNight = nightGlowModeRef.current;
        const radVal = municipality?.currentRadiance ?? (initialScore * 0.45);
        const tooltipText = isNight
          ? `${initialName}${initialProvince ? ` (${initialProvince})` : ''} · ${initialScore}% recovery · ${radVal.toFixed(1)} nW radiance`
          : initialProvince
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
            const activeNight = nightGlowModeRef.current;
            if (typeof (featureLayer as any).setStyle === 'function') {
              (featureLayer as any).setStyle({
                weight: 3.0,
                color: '#ffffff',
                fillOpacity: 0.95,
                fillColor: activeNight
                  ? (initialScore >= 90 ? '#ffc04d' : initialScore >= 60 ? '#f59e0b' : '#1e293b')
                  : undefined,
              });
            }
            if (typeof (featureLayer as any).bringToFront === 'function' && (featureLayer as any)._map) {
              (featureLayer as any).bringToFront();
            }
          },
          mouseout: () => {
            onHoverRef.current(null);
            const activeLight = isLightRef.current;
            const activeNight = nightGlowModeRef.current;
            const currentM =
              municipalitiesByIdRef.current.get(id) ||
              (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
              (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
              (normName ? municipalitiesByIdRef.current.get(normName) : null);
            if (currentM) {
              updateLayerStyle(featureLayer, currentM, id === selectedIdRef.current || currentM.id === selectedIdRef.current, activeLight, activeNight);
            } else if (typeof (featureLayer as any).setStyle === 'function') {
              (featureLayer as any).setStyle(getPolygonStyle(null, false, activeLight, activeNight));
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
        updateLayerStyle(featureLayer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLightRef.current, nightGlowModeRef.current);
        const radVal = m.currentRadiance ? `${m.currentRadiance.toFixed(1)} nW` : `${(m.recoveryScore * 0.45).toFixed(1)} nW`;
        const tip = nightGlowModeRef.current
          ? `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery · ${radVal} radiance`
          : `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery`;
        featureLayer.setTooltipContent(tip);
      }
    });

    // Synchronize the Realistic Night Light canvas overlay with the newly rendered features
    nightLightOverlayRef.current?.redraw();
  };

  // Helper to read the active default region setting from localStorage or settings context
  const getActiveDefaultRegion = (): string => {
    try {
      const raw = localStorage.getItem('sanag_dashboard_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.defaultRegion && typeof parsed.defaultRegion === 'string') {
          return parsed.defaultRegion;
        }
      }
    } catch {
      // Fallback if localStorage is restricted
    }
    return settings?.defaultRegion || 'panay';
  };

  const resetToDefaultBounds = (animate = true) => {
    const map = mapRef.current;
    if (!map) return;

    // Dynamically retrieve user default region preference from localStorage
    const targetRegionKey = getActiveDefaultRegion();
    const preset = REGION_PRESETS[targetRegionKey] || REGION_PRESETS.panay;

    onRegionChange?.(targetRegionKey);

    fetchRegionChunk(targetRegionKey).then((data) => {
      if (data) renderRegionGeoJson(targetRegionKey, data);
      const currentMap = mapRef.current;
      if (!currentMap || !(currentMap as any)._loaded || !(currentMap as any)._panes) return;

      try {
        if (targetRegionKey === 'panay') {
          if (animate) {
            currentMap.flyTo(PANAY_CENTER, PANAY_ZOOM, { duration: 1.0 });
          } else {
            currentMap.setView(PANAY_CENTER, PANAY_ZOOM);
          }
        } else if (preset) {
          if (animate) {
            currentMap.flyTo(preset.center, preset.zoom, { duration: 1.0 });
          } else {
            currentMap.setView(preset.center, preset.zoom);
          }
        }
      } catch {
        currentMap.setView(preset.center, preset.zoom);
      }
    });
  };

  const handleReset = () => {
    resetToDefaultBounds(true);
  };

  // Initialize the map with Panay Island municipality boundaries.
  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;

    const initialRegionKey = selectedRegionKey || settings?.defaultRegion || 'panay';
    const initialPreset = REGION_PRESETS[initialRegionKey] || REGION_PRESETS.panay;
    const initialLocked = settings?.defaultInteractionMode === 'locked';
    const activeRenderer = settings?.renderingEngine === 'svg'
      ? L.svg({ padding: 0.5 })
      : L.canvas({ padding: 0.5, tolerance: 10 });
    canvasRendererRef.current = activeRenderer as any;

    const map = L.map(mapElement.current, {
      center: initialPreset.center,
      zoom: initialPreset.zoom,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      preferCanvas: settings?.renderingEngine !== 'svg',
      renderer: activeRenderer,
      dragging: !initialLocked,
      touchZoom: !initialLocked,
      doubleClickZoom: !initialLocked,
      boxZoom: !initialLocked,
    });

    const updateGridScale = () => {
      const currentZoom = map.getZoom();

      // Notify parent component of zoom change
      if (onZoomChange) onZoomChange(currentZoom);

      const latRad = (11 * Math.PI) / 180;
      const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, currentZoom);
      const calibratedDnb = 500 * (settings?.scaleCalibration || 1.0);
      const sizeInPixels = calibratedDnb / metersPerPixel;

      const wrapper = map.getContainer()?.parentElement;
      if (wrapper) {
        wrapper.style.setProperty('--grid-pixel-size', `${Math.max(4, sizeInPixels)}px`);
      }
    };

    map.on('zoom', updateGridScale);
    map.on('zoomend', updateGridScale);
    map.on('viewreset', updateGridScale);
    updateGridScale();

    mapRef.current = map;
    defaultBoundsRef.current = L.latLngBounds([
      [4.5, 116.5],
      [21.5, 127.5],
    ]);

    // Initialize CartoDB base tile layer based on active theme and night glow mode
    const initialTileUrl = getBaseTileUrl(isLightRef.current, nightGlowModeRef.current, settings?.basemapSource);
    const initialTileLayer = L.tileLayer(initialTileUrl, {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    initialTileLayer.addTo(map);
    tileLayerRef.current = initialTileLayer;

    // Apply night glow mode container class and instantiate realistic night light radiance overlay
    if (nightGlowModeRef.current && mapElement.current) {
      mapElement.current.classList.add('night-glow-mode');
    }

    const nightLightOverlay = new (NightLightOverlay as any)({
      getMunicipalities: () => Array.from(municipalitiesByIdRef.current?.values?.() || []),
      getCentroids: () => centroidsRef.current || new Map(),
      getSelectedId: () => selectedIdRef.current,
      municipalitiesByIdRef,
      centroidsRef,
      selectedIdRef,
    });
    nightLightOverlayRef.current = nightLightOverlay;
    if (nightGlowModeRef.current) {
      nightLightOverlay.addTo(map);
    }

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

    fetchRegionChunk(initialRegionKey)
      .then((geojson) => {
        if (disposed || mapRef.current !== map || !geojson) return;
        renderRegionGeoJson(initialRegionKey, geojson);
        map.setView(initialPreset.center, initialPreset.zoom);
      })
      .catch(() => {
        // Ignore aborted or unavailable map data during component cleanup.
      });

    return () => {
      disposed = true;
      if (nightLightOverlayRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(nightLightOverlayRef.current);
        } catch { }
        nightLightOverlayRef.current = null;
      }
      if (tileLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
        tileLayerRef.current = null;
      }
      if (geoJsonLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(geoJsonLayerRef.current);
        geoJsonLayerRef.current = null;
      }
      if (islandSilhouetteLayerRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(islandSilhouetteLayerRef.current);
        } catch { }
        islandSilhouetteLayerRef.current = null;
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

    const tileUrl = getBaseTileUrl(isLight, nightGlowModeRef.current, settings?.basemapSource);

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

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));

        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, isLight, nightGlowModeRef.current),
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      if (!mapRef.current || !layer || !(layer as any)._map) return;
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
        updateLayerStyle(layer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLight, nightGlowModeRef.current);
      }
    });
  }, [isLight, settings?.basemapSource]);

  // Dynamically toggle Realistic Night Glow mode (NASA Black Marble VIIRS)
  useEffect(() => {
    const map = mapRef.current;
    const el = mapElement.current;
    if (el) {
      el.classList.toggle('night-glow-mode', nightGlowMode);
    }

    // Update tile layer in-place without rebuilding the map
    const newTileUrl = getBaseTileUrl(isLightRef.current, nightGlowMode, settings?.basemapSource);
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(newTileUrl);
    }

    if (map) {
      if (nightGlowMode) {
        if (!nightLightOverlayRef.current) {
          const overlay = new (NightLightOverlay as any)({
            getMunicipalities: () => Array.from(municipalitiesByIdRef.current?.values?.() || []),
            getCentroids: () => centroidsRef.current || new Map(),
            getSelectedId: () => selectedIdRef.current,
            municipalitiesByIdRef,
            centroidsRef,
            selectedIdRef,
          });
          nightLightOverlayRef.current = overlay;
          overlay.addTo(map);
        } else if (!map.hasLayer(nightLightOverlayRef.current)) {
          nightLightOverlayRef.current.addTo(map);
        }
        nightLightOverlayRef.current.redraw();
      } else {
        if (nightLightOverlayRef.current && map.hasLayer(nightLightOverlayRef.current)) {
          map.removeLayer(nightLightOverlayRef.current);
        }
      }
    }

    // Restyle all vector polygons for the active rendering mode
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

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));
        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, isLightRef.current, nightGlowMode),
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      if (!mapRef.current || !layer || !(layer as any)._map) return;
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
        updateLayerStyle(layer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLightRef.current, nightGlowMode);
        const radVal = m.currentRadiance ? `${m.currentRadiance.toFixed(1)} nW` : `${(m.recoveryScore * 0.45).toFixed(1)} nW`;
        const tip = nightGlowMode
          ? `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery · ${radVal} radiance`
          : `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery`;
        layer.setTooltipContent(tip);
      }
    });

    // Restyle island silhouette outline layer for the active mode
    if (islandSilhouetteLayerRef.current && typeof (islandSilhouetteLayerRef.current as any).setStyle === 'function') {
      (islandSilhouetteLayerRef.current as any).setStyle({
        color: nightGlowMode ? '#334155' : 'rgba(15, 23, 42, 0.25)',
        weight: 1.4,
        opacity: nightGlowMode ? 0.35 : 0.15,
        fillColor: nightGlowMode ? '#0c121e' : 'transparent',
        fillOpacity: nightGlowMode ? 0.40 : 0,
      });
    }
  }, [nightGlowMode]);

  // Dynamically update spatial grid sizing when VIIRS scale calibration is adjusted
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const currentZoom = typeof map.getZoom === 'function' ? map.getZoom() : 8;
      const latRad = (11 * Math.PI) / 180;
      const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, currentZoom);
      const calibratedDnb = 500 * (settings?.scaleCalibration || 1.0);
      const sizeInPixels = calibratedDnb / metersPerPixel;

      const wrapper = map.getContainer()?.parentElement;
      if (wrapper) {
        wrapper.style.setProperty('--grid-pixel-size', `${Math.max(4, sizeInPixels)}px`);
      }
    } catch {
      // safe fallback
    }
  }, [settings?.scaleCalibration]);

  // Smoothly pan & zoom and lazy-load regional chunk when user selects a different Philippine region
  useEffect(() => {
    let isMounted = true;
    const map = mapRef.current;
    if (!map || !selectedRegionKey) return;

    fetchRegionChunk(selectedRegionKey).then((chunkData) => {
      if (!isMounted) return;
      const currentMap = mapRef.current;
      if (!currentMap || !(currentMap as any)._loaded || !(currentMap as any)._panes) return;

      if (chunkData) {
        renderRegionGeoJson(selectedRegionKey, chunkData);
      }

      const preset = REGION_PRESETS[selectedRegionKey];
      if (preset && currentMap && (currentMap as any)._loaded && (currentMap as any)._panes) {
        try {
          if (selectedRegionKey === 'philippines') {
            currentMap.setView(preset.center, preset.zoom, { animate: true });
          } else if (selectedRegionKey === 'panay') {
            currentMap.setView(PANAY_CENTER, PANAY_ZOOM, { animate: true });
          } else {
            currentMap.flyTo(preset.center, preset.zoom, { duration: 1.2 });
          }
        } catch {
          currentMap.setView(preset.center, preset.zoom);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedRegionKey]);

  // Listen to window focus-province and select-region events (e.g. from Footer links)
  useEffect(() => {
    const handleFocusEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ provinceKey?: string; regionKey?: string }>;
      const targetKey = customEvent.detail?.provinceKey || customEvent.detail?.regionKey;
      if (!targetKey) return;

      onRegionChange?.(targetKey);

      const map = mapRef.current;
      if (!map || !(map as any)._loaded || !(map as any)._panes) return;

      fetchRegionChunk(targetKey).then((chunkData) => {
        const currentMap = mapRef.current;
        if (!currentMap || !(currentMap as any)._loaded || !(currentMap as any)._panes) return;

        if (chunkData) {
          renderRegionGeoJson(targetKey, chunkData);
        }

        const preset = REGION_PRESETS[targetKey];
        if (preset && currentMap && (currentMap as any)._loaded && (currentMap as any)._panes) {
          try {
            if (targetKey === 'philippines') {
              currentMap.setView(preset.center, preset.zoom, { animate: true });
            } else if (targetKey === 'panay') {
              currentMap.setView(PANAY_CENTER, PANAY_ZOOM, { animate: true });
            } else {
              currentMap.flyTo(preset.center, preset.zoom, { duration: 1.2 });
            }
          } catch {
            currentMap.setView(preset.center, preset.zoom);
          }
        }
      });
    };

    window.addEventListener('sanag:focus-province', handleFocusEvent);
    window.addEventListener('sanag:select-region', handleFocusEvent);
    return () => {
      window.removeEventListener('sanag:focus-province', handleFocusEvent);
      window.removeEventListener('sanag:select-region', handleFocusEvent);
    };
  }, [onRegionChange]);

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

        const isSelected = Boolean(id === selectedId || (municipality && municipality.id === selectedId));
        const lightMode = isLightRef.current;
        const isNight = nightGlowModeRef.current;
        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, lightMode, isNight),
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
        updateLayerStyle(layer, municipality, id === selectedId || municipality.id === selectedId, isLightRef.current, nightGlowModeRef.current);
        const radVal = municipality?.currentRadiance ? `${municipality.currentRadiance.toFixed(1)} nW` : `${(municipality.recoveryScore * 0.45).toFixed(1)} nW`;
        const tip = nightGlowModeRef.current
          ? `${municipality.name}${municipality.province ? ` (${municipality.province})` : ''} · ${municipality.recoveryScore}% recovery · ${radVal} radiance`
          : `${municipality.name}${municipality.province ? ` (${municipality.province})` : ''} · ${municipality.recoveryScore}% recovery`;
        layer.setTooltipContent(tip);
      }
    });

    nightLightOverlayRef.current?.redraw();
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
        <div class="flex items-center gap-2 pb-2 mb-2 pr-8 border-b border-slate-200 dark:border-white/10">
          <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" 
                style="background-color: ${color}22; color: ${color}; border: 1px solid ${color}45;">
            ${alert.alert_level || 'Green'} Alert
          </span>
          ${alert.type ? `
          <span class="rounded-md bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300">
            ${alert.type}
          </span>` : ''}
        </div>
        <h4 class="text-xs font-bold text-slate-900 dark:text-white mb-1 leading-snug pr-4">${alert.name}</h4>
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

      if (isActive) {
        marker.openPopup();
      }

      group.addLayer(marker);
    });
  }, [gdacsAlerts, showGdacsMarkers, activeEventId, onSimulateGdacs]);

  // Smoothly center/fly map to active hazard coordinates whenever active event updates
  useEffect(() => {
    const map = mapRef.current;
    // Only attempt camera animation if map is ready, event ID exists, and Map tab is actively visible
    if (!map || !activeEventId || !isActiveTab) return;

    // Check if the map container element has valid rendered dimensions
    const container = mapElement.current;
    if (!container || container.offsetWidth === 0 || container.offsetHeight === 0) {
      return;
    }

    try {
      // Check if matching alert in gdacsAlerts
      const matchingAlert = gdacsAlerts?.find(
        (a) =>
          String(activeEventId) === String(a.id) ||
          String(activeEventId) === `gdacs-${a.event_id}` ||
          String(activeEventId) === String(a.event_id)
      );

      let lat = matchingAlert?.latitude ?? matchingAlert?.coordinates?.[0];
      let lng = matchingAlert?.longitude ?? matchingAlert?.coordinates?.[1];

      if ((lat == null || lng == null) && activeEvent) {
        lat = activeEvent.latitude ?? activeEvent.coordinates?.[0];
        lng = activeEvent.longitude ?? activeEvent.coordinates?.[1];
      }

      // Defensive validation: ensure coordinates are valid, finite numbers
      if (
        lat != null &&
        lng != null &&
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        !isNaN(lat) &&
        !isNaN(lng) &&
        isFinite(lat) &&
        isFinite(lng)
      ) {
        const rawZoom = typeof map.getZoom === 'function' ? map.getZoom() : 8;
        const currentZoom = typeof rawZoom === 'number' && isFinite(rawZoom) ? rawZoom : 8;
        const targetZoom = Math.max(currentZoom, 8);

        map.flyTo([lat, lng], targetZoom, {
          animate: true,
          duration: 1.2,
        });
      }
    } catch (err) {
      // Suppress any silent Leaflet canvas/tile animation exceptions
      console.warn('[PanayMap] Suppressed camera flyTo exception during event transition:', err);
    }
  }, [activeEventId, activeEvent, gdacsAlerts, isActiveTab]);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl"
      onMouseEnter={() => onMapHoverChange?.(true)}
      onMouseLeave={() => onMapHoverChange?.(false)}
    >
      {/* Static initial class; applyMapLock() mutates classList directly without re-rendering LeafletMap */}
      <div
        ref={mapElement}
        className={`leaflet-map ${initialLocked ? 'is-locked' : 'is-unlocked'} is-maximized-height`}
        aria-label="Panay Island municipality recovery map"
      />

      {/* Overlay buttons live in their own component so their state changes
          never propagate back up into LeafletMap and never touch the tile layer. */}
      <MapLockOverlay
        initialLocked={initialLocked}
        defaultRegionName={REGION_PRESETS[getActiveDefaultRegion()]?.name || 'Default Region'}
        onUnlock={() => applyMapLock(false)}
        onLock={() => { applyMapLock(true); resetToDefaultBounds(true); }}
        onReset={handleReset}
        nightGlowMode={nightGlowMode}
        onToggleNightGlow={onNightGlowModeChange ? () => onNightGlowModeChange(!nightGlowMode) : undefined}
      />
    </div>
  );
}

// ─── MapLockOverlay ──────────────────────────────────────────────────────────
// Isolated button component whose re-renders are fully decoupled from LeafletMap.
// It owns the visual toggle state; all Leaflet side-effects are handled by the
// callbacks passed from LeafletMap via applyMapLock().
interface MapLockOverlayProps {
  initialLocked?: boolean;
  defaultRegionName?: string;
  onUnlock: () => void;
  onLock: () => void;
  onReset: () => void;
  nightGlowMode?: boolean;
  onToggleNightGlow?: () => void;
}
function MapLockOverlay({
  initialLocked = true,
  defaultRegionName = 'Default Region',
  onUnlock,
  onLock,
  onReset,
  nightGlowMode = true,
  onToggleNightGlow,
}: MapLockOverlayProps) {
  const [isLocked, setIsLocked] = useState<boolean>(initialLocked);

  useEffect(() => {
    setIsLocked(initialLocked);
  }, [initialLocked]);

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
      {onToggleNightGlow && (
        <button
          type="button"
          onClick={onToggleNightGlow}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-md shadow-lg transition-all text-xs font-semibold cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${nightGlowMode
            ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-amber-950/40'
            : 'bg-white/95 dark:bg-ink-950/90 hover:bg-slate-100 dark:hover:bg-ink-900 text-slate-700 dark:text-ink-300 border border-slate-300 dark:border-white/10'
            }`}
          aria-label={nightGlowMode ? 'Switch to Standard Vector Map' : 'Switch to NASA Black Marble Night Glow'}
          title={nightGlowMode ? 'NASA Black Marble Night Glow Active (Click for Standard View)' : 'Activate NASA Black Marble Night Light View'}
        >
          <Sparkles className={`w-3.5 h-3.5 ${nightGlowMode ? 'text-amber-400 animate-pulse' : 'text-slate-400'}`} />
          <span className="hidden sm:inline">{nightGlowMode ? 'Night Glow' : 'Vector Map'}</span>
        </button>
      )}

      {isLocked ? (
        <button
          type="button"
          onClick={handleUnlock}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/95 dark:bg-ink-950/90 hover:bg-slate-100 dark:hover:bg-ink-900 text-ocean-700 dark:text-ocean-300 hover:text-ocean-900 dark:hover:text-white border border-ocean-300 dark:border-ocean-500/35 hover:border-ocean-400/60 shadow-lg shadow-black/10 dark:shadow-black/50 backdrop-blur-md transition-all text-xs font-semibold cursor-pointer active:scale-95 group focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
          aria-label="Unlock map to interact, pan, and zoom"
          title="Unlock map to pan and zoom"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ocean-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-ocean-500"></span>
          </span>
          <Lock className="w-3.5 h-3.5 text-ocean-600 dark:text-ocean-400 group-hover:text-ocean-700 dark:group-hover:text-ocean-300 transition-colors" />
          <span>Tap to Interact</span>
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/95 dark:bg-ink-950/90 hover:bg-slate-100 dark:hover:bg-ink-900 text-slate-700 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-white/10 hover:border-slate-400 dark:hover:border-white/25 shadow-lg shadow-black/10 dark:shadow-black/50 backdrop-blur-md transition-all text-xs font-medium cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
            aria-label={`Reset map view to ${defaultRegionName}`}
            title={`Re-center on ${defaultRegionName}`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500 dark:text-ink-400" />
            <span className="hidden sm:inline">Reset View</span>
            <span className="sm:hidden">Reset</span>
          </button>

          <button
            type="button"
            onClick={handleLock}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-ocean-50 dark:bg-ocean-500/20 hover:bg-ocean-100 dark:hover:bg-ocean-500/30 text-ocean-700 dark:text-ocean-200 hover:text-ocean-900 dark:hover:text-white border border-ocean-300 dark:border-ocean-500/40 hover:border-ocean-400/70 shadow-lg shadow-black/10 dark:shadow-black/50 backdrop-blur-md transition-all text-xs font-semibold cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
            aria-label={`Lock map viewport and re-center on ${defaultRegionName}`}
            title={`Lock map and re-center on ${defaultRegionName}`}
          >
            <Lock className="w-3.5 h-3.5 text-ocean-600 dark:text-ocean-300" />
            <span>Lock Map</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── VIIRSScaleRuler ─────────────────────────────────────────────────────────
// Compact dual-axis NASA VIIRS Day/Night Band (DNB) spatial resolution scale ruler.
// Strictly faithful to NASA DNB spatial resolution where 1 pixel = 500m nominal.
// Automatically adjusts its pixel-to-meter ratio accurately across zoom levels,
// mobile viewports, and custom scale calibration without warping or distortion.
interface VIIRSScaleRulerProps {
  pinned: boolean;
  nightGlow?: boolean;
  mapHovered?: boolean;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  zoom?: number;
  scaleCalibration?: number; // Multiplier: 1.0 = nominal 500m/pixel (1 DNB = 500m)
}

function VIIRSScaleRuler({
  pinned,
  nightGlow = false,
  mapHovered = false,
  showGrid = false,
  onToggleGrid,
  zoom = 8,
  scaleCalibration = 1.0,
}: VIIRSScaleRulerProps) {
  const visible = pinned || mapHovered || showGrid;

  // Track viewport width for responsive mobile layout adaptation
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const axisColor = nightGlow ? 'rgba(251,191,36,0.70)' : 'rgba(51,65,85,0.50)';
  const tickColor = nightGlow ? 'rgba(251,191,36,0.55)' : 'rgba(51,65,85,0.40)';
  const labelColor = nightGlow ? 'rgba(251,191,36,0.80)' : 'rgba(51,65,85,0.70)';
  const noteColor = nightGlow ? 'rgba(251,191,36,0.50)' : 'rgba(100,116,139,0.70)';
  const bgColor = nightGlow ? 'rgba(9,13,24,0.92)' : 'rgba(255,255,255,0.96)';
  const borderColor = showGrid
    ? (nightGlow ? 'rgba(245,158,11,0.55)' : 'rgba(14,165,233,0.55)')
    : (nightGlow ? 'rgba(255,170,51,0.22)' : 'rgba(15,23,42,0.12)');
  const shadowVal = nightGlow
    ? '0 2px 14px rgba(0,0,0,0.65), 0 0 10px rgba(255,170,51,0.08)'
    : '0 2px 10px rgba(0,0,0,0.10)';

  // ── NASA VIIRS Day/Night Band (DNB) Spatial Scale Math (1 DNB = 500m Nominal) ──
  // Calibrated ground meter distance for 1 DNB pixel (default: 500m)
  const effectiveCalibration = typeof scaleCalibration === 'number' && isFinite(scaleCalibration) && scaleCalibration > 0
    ? scaleCalibration
    : 1.0;
  const calibratedDnbMeters = 500 * effectiveCalibration;

  // Web Mercator ground resolution at latitude ~11°N (Panay Island & Western Visayas)
  const latRad = (11 * Math.PI) / 180;
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);

  // Target on-screen pixel width (smaller on mobile to prevent clipping)
  const targetPx = isMobile ? 80 : 105;
  const targetMeters = targetPx * metersPerPixel;

  // Standard cartographic round distances in meters
  const NICE_DISTANCES = [
    250, 500, 1000, 2000, 2500, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 75000, 100000, 150000, 200000
  ];

  // Select optimal distance that produces an unwarped bar between min and max pixel constraints
  let chosenDistance = NICE_DISTANCES[0];
  let minDiff = Infinity;
  for (const dist of NICE_DISTANCES) {
    const px = dist / metersPerPixel;
    const diff = Math.abs(px - targetPx);
    if (diff < minDiff && px >= (isMobile ? 55 : 75) && px <= (isMobile ? 105 : 135)) {
      minDiff = diff;
      chosenDistance = dist;
    }
  }

  // Exact screen width in pixels: mathematically exact, no stretch or warp
  const RULER_W = Math.max(isMobile ? 60 : 75, Math.round(chosenDistance / metersPerPixel));
  const RULER_H = isMobile ? 26 : 30;

  // Exact DNB pixel count represented by this distance
  const totalDnbPixels = chosenDistance / calibratedDnbMeters;
  const dnbLabel = totalDnbPixels >= 1
    ? (Number.isInteger(totalDnbPixels) ? `${totalDnbPixels}` : totalDnbPixels.toFixed(1))
    : totalDnbPixels.toFixed(2);

  // Human-readable metric labels
  let maxLabel: string;
  let midLabel: string;
  if (chosenDistance >= 1000) {
    const totalKm = chosenDistance / 1000;
    maxLabel = `${totalKm >= 10 ? Math.round(totalKm) : totalKm.toFixed(1)}km`;
    const midKm = totalKm / 2;
    midLabel = `${midKm >= 10 ? Math.round(midKm) : midKm.toFixed(1)}km`;
  } else {
    maxLabel = `${chosenDistance}m`;
    midLabel = `${Math.round(chosenDistance / 2)}m`;
  }

  const TICK_LABELS = ['0', midLabel, maxLabel];

  // Alternating dual-color segment fill for clear scale subdivision
  const segmentFills = nightGlow
    ? ['#ffaa33', '#4a2f0a', '#ffaa33', '#4a2f0a']
    : ['#1e293b', '#cbd5e1', '#1e293b', '#cbd5e1'];

  return (
    <div
      onClick={onToggleGrid}
      aria-label={`VIIRS scale indicator: 1 DNB = ${Math.round(calibratedDnbMeters)}m, total span ${maxLabel}`}
      style={{
        position: 'absolute',
        bottom: isMobile ? '10px' : '14px',
        right: isMobile ? '10px' : '14px',
        zIndex: 1001,
        pointerEvents: 'auto',
        cursor: 'pointer',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(5px) scale(0.97)',
        transition: 'opacity 0.25s ease, transform 0.25s ease, border-color 0.2s ease',
        maxWidth: 'calc(100% - 24px)',
      }}
      title="Click to toggle 500m VIIRS spatial grid overlay"
    >
      <div
        style={{
          padding: isMobile ? '5px 7px 6px 7px' : '7px 9px 8px 8px',
          borderRadius: '10px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: bgColor,
          border: `1px solid ${borderColor}`,
          boxShadow: shadowVal,
          display: 'inline-flex',
          flexDirection: 'column',
          gap: isMobile ? '3px' : '5px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Ruler style={{ width: isMobile ? 9 : 10, height: isMobile ? 9 : 10, flexShrink: 0, color: nightGlow ? '#f59e0b' : '#475569' }} />
            <span style={{
              fontSize: isMobile ? '8px' : '9px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: labelColor,
              whiteSpace: 'nowrap',
            }}>
              {Math.round(calibratedDnbMeters)}m VIIRS Scale
            </span>
          </div>
          <span style={{
            fontSize: isMobile ? '7px' : '7.5px',
            fontWeight: 700,
            padding: '1px 4px',
            borderRadius: '4px',
            background: showGrid
              ? (nightGlow ? 'rgba(245,158,11,0.30)' : 'rgba(14,165,233,0.20)')
              : (nightGlow ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
            border: showGrid
              ? (nightGlow ? '1px solid rgba(245,158,11,0.60)' : '1px solid rgba(14,165,233,0.50)')
              : '1px solid transparent',
            color: showGrid
              ? (nightGlow ? '#fcd34d' : '#0284c7')
              : (nightGlow ? 'rgba(255,255,255,0.40)' : 'rgba(100,116,139,0.60)'),
            letterSpacing: '0.06em',
          }}>
            {showGrid ? 'GRID ON' : 'GRID OFF'}
          </span>
        </div>

        <div style={{ position: 'relative', width: RULER_W + 8, height: RULER_H + 8 }}>
          {/* Vertical axis marker */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '2px',
            height: RULER_H,
            background: `linear-gradient(to bottom, ${axisColor}, transparent)`,
            borderRadius: '2px',
          }} />

          {/* Scale bar with alternating segments */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: RULER_H - 6,
            width: RULER_W,
            height: 6,
            borderRadius: '0 3px 3px 0',
            overflow: 'hidden',
            display: 'flex',
            border: `1px solid ${nightGlow ? 'rgba(251,191,36,0.25)' : 'rgba(51,65,85,0.20)'}`,
          }}>
            {segmentFills.map((c, i) => (
              <div key={i} style={{ flex: 1, background: c }} />
            ))}
          </div>

          {/* Origin tick dot and end ticks */}
          <div style={{ position: 'absolute', left: '-2px', top: RULER_H - 8, width: '5px', height: '5px', borderRadius: '50%', background: axisColor }} />
          <div style={{ position: 'absolute', left: RULER_W - 1, top: RULER_H - 9, width: '2px', height: '8px', background: axisColor, borderRadius: '1px' }} />
          <div style={{ position: 'absolute', left: Math.floor(RULER_W / 2) - 1, top: RULER_H - 8, width: '1px', height: '5px', background: tickColor }} />

          {TICK_LABELS.map((label, i) => {
            const positions = [0, Math.floor(RULER_W / 2), RULER_W];
            const aligns: React.CSSProperties['textAlign'][] = ['left', 'center', 'right'];
            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: i === 0 ? 0 : i === 2 ? undefined : positions[i],
                  right: i === 2 ? 0 : undefined,
                  top: RULER_H + 2,
                  fontSize: isMobile ? '7.5px' : '8px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontWeight: i === 2 ? 700 : 500,
                  color: labelColor,
                  textAlign: aligns[i],
                  lineHeight: 1,
                  transform: i === 1 ? 'translateX(-50%)' : 'none',
                }}
              >
                {label}
              </span>
            );
          })}

          <span style={{
            position: 'absolute',
            left: '4px',
            top: 0,
            fontSize: isMobile ? '7px' : '8px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontWeight: 600,
            color: tickColor,
            lineHeight: 1,
          }}>
            N↑
          </span>
        </div>

        <span style={{
          fontSize: isMobile ? '7.5px' : '8px',
          color: noteColor,
          fontStyle: 'italic',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
        }}>
          1 DNB = {Math.round(calibratedDnbMeters)}m · {dnbLabel} DNB ({maxLabel})
        </span>
      </div>
    </div>
  );
}

function updateLayerStyle(
  layer: any,
  municipality: Municipality | null | undefined,
  selected: boolean,
  isLight = false,
  nightGlow = false
) {
  if (layer && typeof layer.setStyle === 'function') {
    layer.setStyle(getPolygonStyle(municipality, selected, isLight, nightGlow));
  }
}

function LegendDot({ color, label, glow = false }: { color: string; label: string; glow?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className="h-2 w-2 rounded-full transition-all duration-300"
        style={{
          backgroundColor: color,
          boxShadow: glow ? `0 0 8px ${color}, 0 0 16px ${color}80` : undefined,
        }}
      />
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

// ─── True Coordinate-Based VIIRS Grid Layer ──────────────────────────────────
// Uses Leaflet's native L.GridLayer so the grid lines scale dynamically with map coordinates.
const ViirsGridLayer = (L.GridLayer as any).extend({
  createTile: function (coords: { x: number; y: number; z: number }) {
    const tile = document.createElement('div');
    tile.className = 'viirs-leaflet-grid-tile';
    tile.style.outline = '1px solid rgba(255, 204, 0, 0.22)';
    tile.style.backgroundColor = 'transparent';
    tile.style.fontSize = '9px';
    tile.style.fontFamily = 'monospace';
    tile.style.color = 'rgba(255, 204, 0, 0.4)';
    tile.style.padding = '2px';
    tile.innerHTML = `<span>z:${coords.z} x:${coords.x} y:${coords.y}</span>`;
    return tile;
  },
});