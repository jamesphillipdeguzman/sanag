import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Municipality, GdacsAlert, DisasterEvent } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor, createMunicipalities } from '@/data/mockData';
import { Compass, Globe, Lock, Unlock, Loader2, MapPin, Radio, RotateCcw, X, Layers, Volume2, VolumeX, Sparkles, Moon, Ruler, Maximize2, Minimize2, RefreshCw, ChevronUp, ChevronDown } from 'lucide-react';
import { useAudioSpatialIndicator, type EmergencyAudioStatus } from '@/utils/audioSpatialIndicator';
import { useTheme } from '@/context/ThemeContext';
import { useSettings, type BasemapSource } from '@/context/SettingsContext';
import GisHierarchyReference from '@/components/GisHierarchyReference';
import RegionTreeSelector from '@/components/RegionTreeSelector';
import { findRegionTreeNode, getRegionNodeBounds, PHILIPPINES_BOUNDS } from '@/utils/philippinesHierarchy';
import {
  findRegionByCoordinates,
  REGIONAL_CHUNKS,
  REGION_PRESETS,
  getAllRegisteredRegions,
  type RegionChunkMeta,
  type RegionPreset,
} from '@/utils/regionLookup';
import { findLguQuickLookup } from '@/utils/lguQuickLookup';
import {
  computeDistanceDecaySimulation,
  getFeatureColor as getSimFeatureColor,
  type SimulationRecord,
  type ActiveSimulationMap,
} from '@/services/simulation';
import GDACSModal from '@/components/GDACSModal';

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
  nightGlowIntensity?: number;
  onNightGlowModeChange?: (enabled: boolean) => void;
  onZoomChange?: (zoom: number) => void;
  onFeaturesInViewChange?: (hasFeatures: boolean) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleCollapseHeader?: () => void;
  onHoverRagStatusChange?: (status: 'critical' | 'restoration' | 'recovered' | null) => void;
  selectedGdacsAlert?: GdacsAlert | null;
  onSelectGdacsAlert?: (alert: GdacsAlert | null) => void;
  isLoading?: boolean;
  loadingMessage?: string;
}

const statusLabels: Record<string, string> = {
  restored: 'Near-Full Recovery',
  recovering: 'Active Restoration',
  warning: 'Active Restoration',
  critical: 'Critical Deficit',
};

const TILE_LAYER_OPTIONS: L.TileLayerOptions = {
  subdomains: 'abcd',
  maxZoom: 20,
  keepBuffer: 8,         // Keeps loaded tiles in memory even when panned/zoomed
  updateWhenIdle: false, // Continue tile updates during resize animations
  updateWhenZooming: true,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
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
  const [nightGlowIntensity, setNightGlowIntensity] = useState<number>(0.65);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showGdacsMarkers, setShowGdacsMarkers] = useState(true);
  const [internalRegionKey, setInternalRegionKey] = useState<string>(() => settings?.defaultRegion || 'panay');
  const [extraMunicipalities, setExtraMunicipalities] = useState<Municipality[]>([]);
  const [isRegionChunkLoading, setIsRegionChunkLoading] = useState<boolean>(false);
  const [isLoadingRegion, setIsLoadingRegion] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState<boolean>(false);
  const [selectedGdacsAlert, setSelectedGdacsAlert] = useState<GdacsAlert | null>(null);
  const [hoveredRagStatus, setHoveredRagStatus] = useState<'critical' | 'restoration' | 'recovered' | null>(null);
  const [showScaleRuler, setShowScaleRuler] = useState<boolean>(() => settings?.showScaleRuler || false);
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [mapZoom, setMapZoom] = useState(8);
  const [hasRenderedFeatures, setHasRenderedFeatures] = useState<boolean>(true);

  // Handle ESC key to dismiss fullscreen map mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Handle body scroll locking when map is maximized to fullscreen
  useEffect(() => {
    if (isMaximized) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMaximized]);

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
    const preset = REGION_PRESETS[newKey];
    const treeNode = findRegionTreeNode(newKey);
    const center = preset?.center || treeNode?.center;
    const name = preset?.name || treeNode?.name;
    if (center && name) {
      window.dispatchEvent(
        new CustomEvent('sanag:select-weather-location', {
          detail: {
            lat: center[0],
            lon: center[1],
            name: name,
          },
        })
      );
    }
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

  // Dynamically resolve municipalities belonging to the active regional chunk
  const activeRegionMunicipalities: Municipality[] = useMemo(() => {
    if (currentRegionKey === 'panay' || ['iloilo', 'capiz', 'aklan', 'antique'].includes(currentRegionKey)) {
      const panayProvs = ['Iloilo', 'Capiz', 'Aklan', 'Antique'];
      const filtered = allMunicipalities.filter((m) =>
        panayProvs.includes(m.province) ||
        (m.region && (m.region.includes('Western Visayas') || m.region.includes('Region VI')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'panay_guimaras' || currentRegionKey === 'r6_negros') {
      const filtered = allMunicipalities.filter((m) =>
        (m.pcode && m.pcode.startsWith('PH06')) ||
        (m.region && (m.region.includes('Western Visayas') || m.region.includes('Region VI'))) ||
        ['Iloilo', 'Capiz', 'Aklan', 'Antique', 'Guimaras', 'Negros Occidental'].includes(m.province)
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'mindanao_south' || ['r11', 'r12'].includes(currentRegionKey)) {
      const mindanaoProvs = [
        'Sarangani', 'South Cotabato', 'Davao del Sur', 'Davao Occidental',
        'Davao del Norte', 'Davao de Oro', 'Davao Oriental', 'Sultan Kudarat', 'Cotabato', 'North Cotabato'
      ];
      const filtered = allMunicipalities.filter((m) =>
        mindanaoProvs.includes(m.province) ||
        (m.pcode && (m.pcode.startsWith('PH11') || m.pcode.startsWith('PH12'))) ||
        (m.region && (m.region.includes('XI') || m.region.includes('XII') || m.region.includes('Davao') || m.region.includes('SOCCSKSARGEN')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'central_visayas' || currentRegionKey === 'cebu_bohol' || currentRegionKey === 'r7') {
      const filtered = allMunicipalities.filter((m) =>
        ['Cebu', 'Bohol', 'Siquijor', 'Negros Oriental'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH07')) ||
        (m.region && m.region.includes('VII'))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'eastern_visayas' || currentRegionKey === 'r8') {
      const filtered = allMunicipalities.filter((m) =>
        ['Leyte', 'Southern Leyte', 'Biliran', 'Samar', 'Eastern Samar', 'Northern Samar'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH08')) ||
        (m.region && (m.region.includes('VIII') || m.region.includes('Eastern Visayas')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'ncr') {
      const filtered = allMunicipalities.filter((m) =>
        m.province === 'Metro Manila' ||
        (m.pcode && m.pcode.startsWith('PH13')) ||
        (m.region && m.region.includes('NCR'))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'car') {
      const filtered = allMunicipalities.filter((m) =>
        ['Benguet', 'Abra', 'Apayao', 'Ifugao', 'Kalinga', 'Mountain Province'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH14')) ||
        (m.region && (m.region.includes('CAR') || m.region.includes('Cordillera')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'ilocos_cagayan' || currentRegionKey === 'r1' || currentRegionKey === 'r2') {
      const filtered = allMunicipalities.filter((m) =>
        (m.pcode && (m.pcode.startsWith('PH01') || m.pcode.startsWith('PH02'))) ||
        (m.region && (m.region.includes('Ilocos') || m.region.includes('Cagayan') || m.region.includes('Region I') || m.region.includes('Region II')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'central_luzon' || currentRegionKey === 'r3') {
      const filtered = allMunicipalities.filter((m) =>
        (m.pcode && m.pcode.startsWith('PH03')) ||
        (m.region && (m.region.includes('Central Luzon') || m.region.includes('Region III')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'calabarzon_mimaropa' || currentRegionKey === 'ncr_southern_tagalog' || ['r4a', 'r4b'].includes(currentRegionKey)) {
      const ncrProvs = ['Metro Manila', 'Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon', 'Marinduque', 'Occidental Mindoro', 'Oriental Mindoro', 'Palawan', 'Romblon'];
      const filtered = allMunicipalities.filter((m) =>
        ncrProvs.includes(m.province) ||
        (m.pcode && (m.pcode.startsWith('PH04') || m.pcode.startsWith('PH17') || m.pcode.startsWith('PH13'))) ||
        (m.region && (m.region.includes('NCR') || m.region.includes('IV-A') || m.region.includes('IV-B') || m.region.includes('MIMAROPA')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'bicol' || currentRegionKey === 'r5') {
      const filtered = allMunicipalities.filter((m) =>
        ['Albay', 'Camarines Norte', 'Camarines Sur', 'Catanduanes', 'Masbate', 'Sorsogon'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH05')) ||
        (m.region && (m.region.includes('Bicol') || m.region.includes('Region V')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'zamboanga_peninsula' || currentRegionKey === 'r9') {
      const filtered = allMunicipalities.filter((m) =>
        ['Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay', 'City of Isabela'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH09')) ||
        (m.region && (m.region.includes('Zamboanga') || m.region.includes('Region IX')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'northern_mindanao_caraga' || ['r10', 'r13'].includes(currentRegionKey)) {
      const filtered = allMunicipalities.filter((m) =>
        (m.pcode && (m.pcode.startsWith('PH10') || m.pcode.startsWith('PH16'))) ||
        (m.region && (m.region.includes('Northern Mindanao') || m.region.includes('Caraga') || m.region.includes('Region X') || m.region.includes('Region XIII')))
      );
      if (filtered.length > 0) return filtered;
    }
    if (currentRegionKey === 'barmm') {
      const filtered = allMunicipalities.filter((m) =>
        ['Basilan', 'Lanao del Sur', 'Maguindanao', 'Maguindanao del Norte', 'Maguindanao del Sur', 'Sulu', 'Tawi-Tawi', 'Cotabato City'].includes(m.province) ||
        (m.pcode && (m.pcode.startsWith('PH15') || m.pcode.startsWith('PH19'))) ||
        (m.region && (m.region.includes('BARMM') || m.region.includes('Bangsamoro')))
      );
      if (filtered.length > 0) return filtered;
    }
    // If extraMunicipalities has items for this loaded chunk
    if (extraMunicipalities.length > 0) {
      return extraMunicipalities;
    }
    return allMunicipalities;
  }, [allMunicipalities, extraMunicipalities, currentRegionKey]);

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
    <div className={isMaximized ? 'relative w-full max-w-full overflow-x-hidden' : 'grid lg:grid-cols-12 gap-5 sm:gap-6 items-stretch w-full max-w-full min-w-0 overflow-x-hidden'}>
      {/* Map */}
      <div className={isMaximized ? 'w-full max-w-full' : 'lg:col-span-8 flex flex-col w-full max-w-full min-w-0'}>
        {/* Keep the panel chrome on the app theme; night glow darkens only the map viewport. */}
        <div className={isMaximized
          ? 'map-fullscreen-modal fixed inset-0 z-[1500] w-full max-w-full h-screen rounded-none m-0 p-0 overflow-hidden flex flex-col bg-slate-950'
          : `relative rounded-2xl border ${nightGlowMode ? 'border-amber-500/25 bg-white/95 dark:bg-ink-900/60 shadow-[0_0_35px_rgba(255,170,51,0.08)]' : 'border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 shadow-sm dark:shadow-xl'} backdrop-blur-sm overflow-hidden flex flex-col h-full transition-all duration-300`
        }>
          {/* Map header with Region Selector */}
          <div className={`transition-all duration-300 ease-in-out shrink-0 relative z-[2000] ${
            isHeaderCollapsed
              ? 'max-h-0 opacity-0 -translate-y-4 pointer-events-none py-0 border-b-0 overflow-hidden'
              : `max-h-48 opacity-100 py-3 border-b overflow-visible ${nightGlowMode ? 'border-amber-500/20 bg-slate-50/80 dark:bg-ink-950/40' : 'border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-ink-950/40'}`
          } transition-colors`}>
            {/* Centered Title block & Subtitle */}
            <div className="flex flex-col items-center justify-center">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Philippine Satellite Grid</h3>
                {nightGlowMode && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/35 shadow-sm shadow-amber-500/20 animate-fade-in" title="NASA Black Marble VIIRS DNB Day/Night Band Composite Active">
                    <Sparkles className="h-3 w-3 text-amber-500 dark:text-amber-300 animate-pulse" />
                    Black Marble VIIRS
                  </span>
                )}
                {(isRegionChunkLoading || isLoadingRegion) && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ocean-700 dark:text-ocean-300 bg-ocean-50 dark:bg-ocean-500/15 border border-ocean-200 dark:border-ocean-500/30 px-2 py-0.5 rounded-full animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin text-ocean-600 dark:text-ocean-300" />
                    Loading {activePreset?.name || currentRegionKey}...
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5 text-center">
                {nightGlowMode ? (
                  <span className="inline-flex items-center justify-center gap-1.5 flex-wrap">
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

            {/* Region selection dropdown and Live Hazards indicator badge directly underneath */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
              {/* Hierarchical Collapsible Tree Region Selector */}
              <RegionTreeSelector
                currentRegionKey={currentRegionKey}
                selectedMunicipalityId={selectedId}
                onSelectRegion={handleRegionChange}
                onSelectMunicipality={onSelect}
              />

              {/* Primary Live Status: Live Hazards Badge Toggle */}
              {alertsWithCoords.length > 0 && (
                <button
                  type="button"
                  id="header-live-hazards-toggle"
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
            </div>
          </div>

          {/* Leaflet GeoJSON map */}
          <div
            className={`relative dot-bg ${isMaximized ? 'fullscreen-map-container p-0 w-full h-full flex-1' : 'p-2 flex-1 min-h-0'} flex flex-col ${nightGlowMode ? 'bg-[#0b0f19]' : ''}`}
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
                  onChunkLoadingChange={(loading) => {
                    setIsRegionChunkLoading(loading);
                    setIsLoadingRegion(loading);
                  }}
                  isActiveTab={isActiveTab}
                  nightGlowMode={nightGlowMode}
                  nightGlowIntensity={nightGlowIntensity}
                  onNightGlowModeChange={handleNightGlowToggle}
                  onZoomChange={setMapZoom}
                  onFeaturesInViewChange={setHasRenderedFeatures}
                  isMaximized={isMaximized}
                  onToggleMaximize={() => setIsMaximized((v) => !v)}
                  isHeaderCollapsed={isHeaderCollapsed}
                  onToggleCollapseHeader={() => setIsHeaderCollapsed((prev) => !prev)}
                  onHoverRagStatusChange={setHoveredRagStatus}
                  selectedGdacsAlert={selectedGdacsAlert}
                  onSelectGdacsAlert={setSelectedGdacsAlert}
                  isLoading={Boolean(isLoading || isLoadingRegion || isRegionChunkLoading)}
                  loadingMessage={
                    (isLoadingRegion || isRegionChunkLoading)
                      ? `Loading ${activePreset?.name || currentRegionKey} GeoJSON...`
                      : isLoading
                      ? 'Connecting / Calibrating radiance...'
                      : undefined
                  }
                />

                {/* Night Glow Fallback Notification Toast — positioned top-16 so it never collides with top-3 toolbar */}
                {nightGlowMode && !hasRenderedFeatures && (
                  <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[999] max-w-[90%] sm:max-w-md px-3.5 py-2 rounded-xl bg-slate-900/90 dark:bg-black/90 backdrop-blur-md border border-amber-500/40 text-amber-300 text-xs shadow-xl flex items-center gap-2.5 animate-fade-in pointer-events-auto">
                    <Sparkles className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                    <span className="leading-snug">
                      Orbital night glow active. Waiting for regional telemetry or boundaries.
                    </span>
                  </div>
                )}

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

                {/* Floating municipality telemetry card — z-[1200] so it reliably floats above basemap and canvas in both normal and maximized views */}
                {hovered && !selected && (
                  <div className="absolute pointer-events-auto bottom-16 left-6 z-[1200] glass rounded-xl px-4 py-3 max-w-xs animate-fade-in shadow-2xl border border-gray-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/90 backdrop-blur-md">
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

          {/* Unified Bottom Utility Dock & Severity Reference Footer */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 px-4 sm:px-5 py-2.5 border-t shrink-0 border-slate-200 dark:border-white/10 bg-slate-100/95 dark:bg-slate-950/85 backdrop-blur-md text-slate-700 dark:text-slate-300 transition-colors">
            {/* Left: Secondary Controls Toolbar (ADM Hierarchy, Scale Ruler, Spatial Audio, Night Glow Switch + Intensity Slider) */}
            <div className="flex flex-wrap items-center gap-2">
              {/* ADM Hierarchy popover button */}
              <GisHierarchyReference />

              {/* VIIRS 500m Scale Ruler Toggle */}
              <button
                type="button"
                id="viirs-scale-ruler-toggle"
                onClick={() => {
                  const next = !showScaleRuler;
                  setShowScaleRuler(next);
                  updateSetting('showScaleRuler', next);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm transition-all cursor-pointer ${showScaleRuler
                  ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/20 ring-1 ring-sky-500/30'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                title={showScaleRuler ? 'Hide VIIRS 500m pixel scale ruler' : 'Pin VIIRS 500m pixel scale ruler (also appears on hover)'}
                aria-pressed={showScaleRuler}
              >
                <Ruler className={`h-3.5 w-3.5 ${showScaleRuler ? 'text-sky-500 dark:text-sky-300' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>Scale Ruler</span>
              </button>

              {/* Spatial Audio Emergency Indicator Toggle */}
              <button
                type="button"
                id="audio-spatial-indicator-toggle"
                onClick={() => {
                  toggleAudio();
                  updateSetting('audioFeedback', !isAudioEnabled);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm transition-all cursor-pointer ${isAudioEnabled
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20'
                  : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
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
                    <span>Audio</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-mono">
                      {isMapAudioPlaying ? (liveAudioStatus === 'critical' ? 'MAX' : liveAudioStatus === 'warning' ? 'MID' : 'LOW') : 'Standby'}
                    </span>
                  </>
                ) : (
                  <>
                    <VolumeX className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Spatial Audio</span>
                  </>
                )}
              </button>

              {/* Realistic Night Glow Switch with Inline Intensity Slider */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border backdrop-blur-sm transition-all ${nightGlowMode
                ? 'bg-amber-100 border border-amber-400 text-amber-950 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/60 shadow-sm'
                : 'bg-white/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60 hover:bg-slate-200/80 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}>
                <button
                  type="button"
                  id="realistic-night-glow-toggle"
                  onClick={handleNightGlowToggle}
                  className="flex items-center gap-1.5 cursor-pointer"
                  title="Toggle NASA Black Marble Realistic Night Light composite view"
                  aria-pressed={nightGlowMode}
                >
                  <Sparkles className={`h-3.5 w-3.5 ${nightGlowMode ? 'text-amber-900 dark:text-amber-300 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span>Night Glow</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded uppercase font-mono font-bold tracking-wider ${nightGlowMode
                      ? 'bg-amber-200 text-amber-950 dark:bg-amber-500/30 dark:text-amber-200 border border-amber-400 dark:border-amber-500/40'
                      : 'bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                      }`}
                  >
                    {nightGlowMode ? 'NASA VIIRS' : 'OFF'}
                  </span>
                </button>

                {nightGlowMode && (
                  <div className="flex items-center gap-1.5 pl-1.5 border-l border-amber-400 dark:border-amber-500/30">
                    <span className="text-[10px] font-mono text-amber-900 dark:text-amber-300 font-bold">
                      {Math.round(nightGlowIntensity * 100)}%
                    </span>
                    <input
                      id="night-glow-intensity-slider"
                      type="range"
                      min="0.20"
                      max="1.00"
                      step="0.05"
                      value={nightGlowIntensity}
                      onChange={(e) => setNightGlowIntensity(parseFloat(e.target.value))}
                      className="w-16 h-1 bg-amber-200 dark:bg-amber-900/60 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      title={`Night Glow Intensity: ${Math.round(nightGlowIntensity * 100)}%`}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Numbered VIIRS Scale with Anchored RAG Severity Guide Directly Beneath */}
            <div className="flex flex-col items-start xl:items-end gap-1.5">
              {/* Row 1: Numbered VIIRS Reference Scale */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                  {nightGlowMode ? 'NASA Black Marble Radiance' : '500M VIIRS Scale'}
                </span>
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold">0</span>
                <div className="flex h-2 w-28 sm:w-36 rounded-full overflow-hidden border border-slate-300/60 dark:border-white/10 shadow-inner">
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
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-bold">100</span>
              </div>

              {/* Row 2: Anchored 3-Tier RAG Recovery Severity Guide directly beneath numbered scale */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] sm:text-[11px] select-none py-1 max-w-full">
                {/* 1. Critical Deficit (< 60%) */}
                <div
                  id="rag-red"
                  className={`flex items-center gap-1.5 transition-opacity duration-150 shrink-0 ${
                    hoveredRagStatus != null && hoveredRagStatus !== 'critical'
                      ? 'opacity-40 text-slate-500 dark:text-slate-400'
                      : 'opacity-100 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                      nightGlowMode
                        ? hoveredRagStatus === 'critical'
                          ? 'bg-slate-300 shadow-[0_0_12px_rgba(244,63,94,0.9)] scale-125'
                          : 'bg-slate-700 border border-white/20'
                        : hoveredRagStatus === 'critical'
                          ? 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.9)] scale-125 ring-2 ring-rose-400/50'
                          : 'bg-rose-500 shadow-sm shadow-rose-500/50'
                    }`}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">&lt; 60% Critical Deficit</span>
                </div>

                {/* 2. Active Restoration (60%–89%) */}
                <div
                  id="rag-amber"
                  className={`flex items-center gap-1.5 transition-opacity duration-150 shrink-0 ${
                    hoveredRagStatus != null && hoveredRagStatus !== 'restoration'
                      ? 'opacity-40 text-slate-500 dark:text-slate-400'
                      : 'opacity-100 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                      nightGlowMode
                        ? hoveredRagStatus === 'restoration'
                          ? 'bg-[#e08b18] shadow-[0_0_12px_rgba(245,158,11,0.9)] scale-125'
                          : 'bg-[#e08b18] opacity-75'
                        : hoveredRagStatus === 'restoration'
                          ? 'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.9)] scale-125 ring-2 ring-amber-400/50'
                          : 'bg-amber-500 shadow-sm shadow-amber-500/50'
                    }`}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">60%–89% Restoration</span>
                </div>

                {/* 3. Near-Full Recovery (≥ 90%) */}
                <div
                  id="rag-green"
                  className={`flex items-center gap-1.5 transition-opacity duration-150 shrink-0 ${
                    hoveredRagStatus != null && hoveredRagStatus !== 'recovered'
                      ? 'opacity-40 text-slate-500 dark:text-slate-400'
                      : 'opacity-100 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                      nightGlowMode
                        ? hoveredRagStatus === 'recovered'
                          ? 'bg-[#ffaa33] shadow-[0_0_12px_rgba(16,185,129,0.9)] scale-125'
                          : 'bg-[#ffaa33] opacity-75'
                        : hoveredRagStatus === 'recovered'
                          ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)] scale-125 ring-2 ring-emerald-400/50'
                          : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                    }`}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">≥ 90% Near-Full</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail side panel */}
      {!isMaximized && (
        <div className="lg:col-span-4 flex flex-col w-full max-w-full min-w-0">
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
                    let preferredIds: string[] = [];
                    if (currentRegionKey === 'mindanao_south') {
                      preferredIds = [
                        'PH126303000', // General Santos City
                        'PH112402000', // Davao City
                        'PH128002000', // Glan
                        'PH128001000', // Alabel
                        'PH112403000', // Digos City
                        'PH126306000', // Koronadal City
                        'PH112319000', // Tagum City
                        'PH128006000', // Malapatan
                      ];
                    } else if (currentRegionKey === 'panay' || currentRegionKey === 'panay_guimaras' || currentRegionKey === 'r6_negros') {
                      preferredIds = ['PH063022000', 'PH060407000', 'PH061914000', 'PH060613000', 'PH060450100'];
                    } else if (currentRegionKey === 'ncr' || currentRegionKey === 'ncr_southern_tagalog') {
                      preferredIds = ['PH133901000', 'PH137404000', 'PH137601000', 'PH137403000'];
                    } else if (currentRegionKey === 'central_visayas' || currentRegionKey === 'cebu_bohol' || currentRegionKey === 'r7') {
                      preferredIds = ['PH072217000', 'PH072230000', 'PH072226000', 'PH071242000'];
                    } else if (currentRegionKey === 'mindanao_south' || currentRegionKey === 'r11' || currentRegionKey === 'r12') {
                      preferredIds = ['PH126303000', 'PH112402000', 'PH128002000', 'PH128001000', 'PH112403000', 'PH126306000', 'PH112319000'];
                    } else if (currentRegionKey === 'central_luzon' || currentRegionKey === 'r3') {
                      preferredIds = ['PH035416000', 'PH035401000', 'PH031410000', 'PH036916000'];
                    } else if (currentRegionKey === 'calabarzon_mimaropa' || currentRegionKey === 'r4a' || currentRegionKey === 'r4b') {
                      preferredIds = ['PH045801000', 'PH043405000', 'PH042106000', 'PH041005000'];
                    } else if (currentRegionKey === 'eastern_visayas' || currentRegionKey === 'r8') {
                      preferredIds = ['PH083747000', 'PH083738000', 'PH083710000', 'PH086003000'];
                    } else if (currentRegionKey === 'ilocos_cagayan' || currentRegionKey === 'r1' || currentRegionKey === 'r2') {
                      preferredIds = ['PH012805000', 'PH012928000', 'PH013314000', 'PH015518000', 'PH021529000', 'PH023134000'];
                    } else if (currentRegionKey === 'car') {
                      preferredIds = ['PH141102000', 'PH141114000', 'PH143213000'];
                    } else if (currentRegionKey === 'bicol' || currentRegionKey === 'r5') {
                      preferredIds = ['PH050506000', 'PH051724000', 'PH056216000'];
                    } else if (currentRegionKey === 'northern_mindanao_caraga' || currentRegionKey === 'r10' || currentRegionKey === 'r13') {
                      preferredIds = ['PH104305000', 'PH103504000', 'PH101312000', 'PH160202000', 'PH166724000'];
                    } else if (currentRegionKey === 'zamboanga_peninsula' || currentRegionKey === 'r9') {
                      preferredIds = ['PH097332000', 'PH097322000'];
                    } else if (currentRegionKey === 'barmm') {
                      preferredIds = ['PH199901000', 'PH193601000'];
                    }

                    const matched = preferredIds
                      .map((id) => activeRegionMunicipalities.find((item: Municipality) => item.id === id || item.pcode === id))
                      .filter((m: Municipality | undefined): m is Municipality => Boolean(m));

                    const matchedIds = new Set(matched.map((m) => m.id));
                    const remaining = activeRegionMunicipalities.filter((m) => !matchedIds.has(m.id));
                    const displayList = [...matched, ...remaining].slice(0, 5);

                    return displayList.map((m: Municipality) => (
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
      )}
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
  nightGlow: boolean | null | undefined,
  simRecord?: SimulationRecord | null
) {
  const selected = Boolean(isSelected);
  const light = Boolean(isLight);
  const glow = Boolean(nightGlow);
  const ratio = simRecord != null
    ? simRecord.recovery_ratio
    : (municipality?.recoveryScore != null ? municipality.recoveryScore / 100 : 1.0);
  const score = Math.round(ratio * 100);

  if (glow) {
    if (ratio >= 0.90) {
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
    } else if (ratio >= 0.60) {
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
  // Recovery Ratio < 0.60 -> Red #ef4444 (Critical Deficit)
  // Recovery Ratio < 0.90 -> Amber #f59e0b (Active Restoration)
  // Recovery Ratio >= 0.90 -> Green #10b981 (Near-Full / Normal)
  const color = ratio < 0.60 ? '#ef4444' : ratio < 0.90 ? '#f59e0b' : '#10b981';
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
  intensity?: number;
}

const NightLightOverlay = (L.Layer as any).extend({
  initialize: function (options: NightLightOverlayOptions) {
    this._options = options || {};
    this._intensity = options.intensity ?? 0.65;
  },
  setIntensity: function (val: number) {
    this._intensity = val;
    if (this._canvas) {
      this._canvas.style.opacity = String(val);
    }
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
    canvas.style.opacity = String(this._intensity ?? 0.65); // Dynamic canvas opacity from slider
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
  nightGlowIntensity = 0.65,
  onNightGlowModeChange,
  onZoomChange,
  onFeaturesInViewChange,
  isMaximized = false,
  onToggleMaximize,
  isHeaderCollapsed = false,
  onToggleCollapseHeader,
  onHoverRagStatusChange,
  selectedGdacsAlert: selectedGdacsAlertProp,
  onSelectGdacsAlert,
  isLoading = false,
  loadingMessage,
}: LeafletMapProps) {
  const { theme } = useTheme();
  const { settings } = useSettings();
  const isLight = theme === 'light';
  const isLightRef = useRef(isLight);
  isLightRef.current = isLight;

  const nightGlowModeRef = useRef<boolean>(nightGlowMode);
  nightGlowModeRef.current = nightGlowMode;

  const activeEventRef = useRef<DisasterEvent | GdacsAlert | null | undefined>(activeEvent);
  activeEventRef.current = activeEvent;
  const activeEventIdRef = useRef(activeEventId);
  activeEventIdRef.current = activeEventId;

  const mapElement = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layersRef = useRef<Record<string, any>>({});
  const gdacsGroupRef = useRef<L.LayerGroup | null>(null);
  const defaultBoundsRef = useRef<L.LatLngBounds | null>(null);
  const activeRegionBoundsRef = useRef<L.LatLngBounds | null>(null);
  const isProgrammaticMoveRef = useRef<boolean>(false);
  const municipalitiesByIdRef = useRef<Map<string, Municipality>>(new Map());
  const centroidsRef = useRef<Map<string, [number, number]>>(new Map());
  const nightLightOverlayRef = useRef<any>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onMapHoverChangeRef = useRef(onMapHoverChange);
  const onHoverRagStatusChangeRef = useRef(onHoverRagStatusChange);
  onHoverRagStatusChangeRef.current = onHoverRagStatusChange;

  const chunkAbortControllerRef = useRef<AbortController | null>(null);
  const pendingRegionKeyRef = useRef<string | null>(null);

  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const islandSilhouetteLayerRef = useRef<L.GeoJSON | null>(null);
  const canvasRendererRef = useRef<L.Canvas | null>(null);
  const regionCacheRef = useRef<Map<string, GeoJSON.FeatureCollection>>(new Map());
  const geojsonCacheRef = useRef<Map<string, any>>(new Map());
  const activeChunkKeyRef = useRef<string>(selectedRegionKey || 'panay');
  const epicenterBufferRef = useRef<L.Circle | null>(null);
  const onFeaturesInViewChangeRef = useRef(onFeaturesInViewChange);
  onFeaturesInViewChangeRef.current = onFeaturesInViewChange;

  const activeStreakLayerRef = useRef<L.GeoJSON | null>(null);
  const streakTimerRef = useRef<any>(null);
  const lastFocusedIdRef = useRef<string | null>(null);

  const activeSimulationMapRef = useRef<ActiveSimulationMap>({});
  const [, setActiveSimulationMapState] = useState<ActiveSimulationMap>({});
  const [internalSelectedGdacsAlert, setInternalSelectedGdacsAlert] = useState<GdacsAlert | null>(null);
  const selectedGdacsAlert = selectedGdacsAlertProp !== undefined ? selectedGdacsAlertProp : internalSelectedGdacsAlert;
  const setSelectedGdacsAlert = useCallback((alert: GdacsAlert | null) => {
    setInternalSelectedGdacsAlert(alert);
    onSelectGdacsAlert?.(alert);
  }, [onSelectGdacsAlert]);

  const selectedGdacsAlertRef = useRef<GdacsAlert | null>(selectedGdacsAlert);
  selectedGdacsAlertRef.current = selectedGdacsAlert;

  // Synchronize active hazard card with activeEventId if set
  useEffect(() => {
    if (activeEventId && gdacsAlerts && gdacsAlerts.length > 0) {
      const matched = gdacsAlerts.find(
        (a) =>
          activeEventId === a.id ||
          activeEventId === `gdacs-${a.event_id}` ||
          activeEventId === String(a.event_id)
      );
      if (matched) {
        setSelectedGdacsAlert(matched);
      }
    }
  }, [activeEventId, gdacsAlerts]);

  const getFeatureColor = (feature: any) => {
    const props = feature?.properties || feature || {};
    const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE || props.pcode || props.id;
    const simData = (pcode && activeSimulationMapRef.current[pcode])
      || (props.id && activeSimulationMapRef.current[props.id])
      || (props.name && activeSimulationMapRef.current[props.name.toLowerCase().trim()]);
    if (!simData) return '#10b981'; // default green
    if (simData.recovery_ratio < 0.60) return '#ef4444'; // Red: Critical
    if (simData.recovery_ratio < 0.90) return '#f59e0b'; // Amber: Active Restoration
    return '#10b981'; // Green: Near-Full Recovery
  };

  const runSimulationForCurrentRegion = useCallback((
    targetEvent?: DisasterEvent | GdacsAlert | null,
    featuresToUse?: GeoJSON.Feature[]
  ) => {
    const evt = targetEvent || activeEventRef.current || activeEvent;
    if (!evt) return;

    const lat = evt.latitude ?? (evt as any).coordinates?.[0];
    const lng = evt.longitude ?? (evt as any).coordinates?.[1];
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

    const featuresList = featuresToUse || (geoJsonLayerRef.current ? (geoJsonLayerRef.current as any).toGeoJSON?.()?.features : null);

    const simMap = computeDistanceDecaySimulation({
      event: evt,
      municipalities: Array.from(municipalitiesByIdRef.current.values()),
      features: featuresList,
      centroidsMap: centroidsRef.current,
    });

    activeSimulationMapRef.current = simMap;
    setActiveSimulationMapState(simMap);

    const updatedList: Municipality[] = [];
    municipalitiesByIdRef.current.forEach((m) => {
      const pcode = m.pcode || m.id;
      const sim = simMap[pcode] || (m.id ? simMap[m.id] : null) || (m.name ? simMap[m.name.toLowerCase().trim()] : null);
      if (sim) {
        const score = Math.max(0, Math.min(100, Math.round(sim.recovery_ratio * 100)));
        m.recoveryScore = score;
        m.status = sim.status;
        m.baselineRadiance = sim.pre_radiance;
        m.currentRadiance = sim.post_radiance;
        m.recoveryDate = evt.date;
        m.estimatedDaysToRecover = score >= 90 ? 0 : Math.max(1, Math.round((100 - score) / 8));
        updatedList.push(m);
      }
    });

    // Explicit and synchronous re-apply of GeoJSON styles immediately
    if (geoJsonLayerRef.current && typeof (geoJsonLayerRef.current as any).setStyle === 'function') {
      (geoJsonLayerRef.current as any).setStyle((feature: any) => {
        const props = feature?.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const simRecord = (pcode && simMap[pcode])
          || (id && simMap[id])
          || (props.GID_2 && simMap[props.GID_2])
          || (props.psgc_code && simMap[props.psgc_code])
          || (normName && simMap[normName]);

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));

        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, isLightRef.current, nightGlowModeRef.current, simRecord),
        };
      });
    }

    // Force canvas renderer redraw immediately so colors appear on the very first click
    if (canvasRendererRef.current) {
      if (typeof (canvasRendererRef.current as any)._update === 'function') {
        try {
          (canvasRendererRef.current as any)._update();
        } catch {}
      }
      if (typeof (canvasRendererRef.current as any).requestRedraw === 'function') {
        try {
          (canvasRendererRef.current as any).requestRedraw();
        } catch {}
      }
    }

    // Re-style individual feature layers in layersRef
    Object.entries(layersRef.current).forEach(([id, layer]) => {
      if (!layer || !(layer as any)._map) return;
      const props = (layer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';
      const m =
        municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);

      const simRecord = (pcode && simMap[pcode])
        || (id && simMap[id])
        || (props.GID_2 && simMap[props.GID_2])
        || (props.psgc_code && simMap[props.psgc_code])
        || (normName && simMap[normName]);
      if (m) {
        updateLayerStyle(layer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLightRef.current, nightGlowModeRef.current, simRecord);
        const radVal = m.currentRadiance ? `${m.currentRadiance.toFixed(1)} nW` : `${(m.recoveryScore * 0.45).toFixed(1)} nW`;
        const tip = nightGlowModeRef.current
          ? `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery · ${radVal} radiance`
          : `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery`;
        layer.setTooltipContent(tip);
      }
      if (typeof (layer as any)._updatePath === 'function') {
        try { (layer as any)._updatePath(); } catch {}
      } else if (typeof (layer as any).redraw === 'function') {
        try { (layer as any).redraw(); } catch {}
      }
    });

    // Immediate redraw of realistic night light radiance bloom canvas
    nightLightOverlayRef.current?.redraw();

    // Propagate updated municipalities to parent
    if (updatedList.length > 0) {
      onChunkLoaded?.(updatedList);
    }
  }, [onChunkLoaded]);

  const clearEpicenterBuffer = () => {
    if (epicenterBufferRef.current && mapRef.current) {
      try {
        mapRef.current.removeLayer(epicenterBufferRef.current);
      } catch { }
      epicenterBufferRef.current = null;
    }
  };

  const drawEpicenterBuffer = (lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    clearEpicenterBuffer();
    const buffer = L.circle([lat, lng], {
      radius: 45000,
      color: '#f59e0b',
      dashArray: '6, 6',
      fillOpacity: 0.15,
    }).addTo(map);
    epicenterBufferRef.current = buffer;
  };

  const checkViewportFeatures = () => {
    const map = mapRef.current;
    if (!map || !(map as any)._loaded) return false;
    const bounds = map.getBounds();
    let hasFeatures = false;

    const layerEntries = Object.values(layersRef.current);
    if (layerEntries.length > 0) {
      for (const layer of layerEntries) {
        if (layer && typeof (layer as any).getBounds === 'function') {
          const b = (layer as any).getBounds();
          if (b && bounds.intersects(b)) {
            hasFeatures = true;
            break;
          }
        }
      }
    }

    onFeaturesInViewChangeRef.current?.(hasFeatures);

    if (mapElement.current) {
      if (nightGlowModeRef.current && !hasFeatures) {
        mapElement.current.classList.add('night-glow-no-features');
      } else {
        mapElement.current.classList.remove('night-glow-no-features');
      }
    }
    return hasFeatures;
  };

  // Handle map invalidation, size re-calculations, and tile layer preservation when Map tab becomes active or window resizes
  useEffect(() => {
    const handleInvalidate = () => {
      const map = mapRef.current;
      const el = mapElement.current;
      // Guard against zero-dimension layout calls while hidden or during unmount
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;
      if (!map || !(map as any)._loaded || !(map as any)._panes) return;

      try {
        (map.invalidateSize as any)({ pan: false });

        const currentTileLayer = tileLayerRef.current;
        const tileUrl = getBaseTileUrl(isLightRef.current, nightGlowModeRef.current, settings?.basemapSource);
        const tilePane = (map as any)._panes?.tilePane;

        const isAttached = Boolean(currentTileLayer && map.hasLayer(currentTileLayer));
        const containerValid = Boolean(
          currentTileLayer &&
          (currentTileLayer as any)._container &&
          tilePane &&
          tilePane.contains((currentTileLayer as any)._container)
        );

        // If tile layer was detached or lost its container in tilePane, cleanly re-attach
        if (!isAttached || !containerValid) {
          if (currentTileLayer && map.hasLayer(currentTileLayer)) {
            try {
              map.removeLayer(currentTileLayer);
            } catch { }
          }
          tileLayerRef.current = null;

          const newTileLayer = L.tileLayer(tileUrl, TILE_LAYER_OPTIONS);
          newTileLayer.addTo(map);
          tileLayerRef.current = newTileLayer;
        } else if (currentTileLayer && typeof (currentTileLayer as any).redraw === 'function') {
          (currentTileLayer as any).redraw();
        }

        if (canvasRendererRef.current && typeof (canvasRendererRef.current as any)._update === 'function') {
          try {
            (canvasRendererRef.current as any)._update();
          } catch {}
        }
        if (nightLightOverlayRef.current && typeof nightLightOverlayRef.current.redraw === 'function') {
          nightLightOverlayRef.current.redraw();
        }
        checkViewportFeatures();
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

  // Track lock state both imperatively and reactively.
  const initialLocked = settings?.defaultInteractionMode === 'locked';
  const isLockedRef = useRef<boolean>(initialLocked);
  const [isMapLocked, setIsMapLocked] = useState<boolean>(initialLocked);

  // Enable/disable Leaflet interaction handlers and update the
  // container CSS class and state.
  const applyMapLock = (locked: boolean) => {
    isLockedRef.current = locked;
    setIsMapLocked(locked);
    const map = mapRef.current;
    if (map) {
      if (locked) {
        map.dragging?.disable();
        map.touchZoom?.disable();
        map.doubleClickZoom?.disable();
        map.scrollWheelZoom?.disable();
        map.boxZoom?.disable();
      } else {
        map.dragging?.enable();
        map.touchZoom?.enable();
        map.doubleClickZoom?.enable();
        map.scrollWheelZoom?.enable();
        map.boxZoom?.enable();
      }
    }
    const el = mapElement.current;
    if (el) {
      el.classList.toggle('is-locked', locked);
      el.classList.toggle('is-unlocked', !locked);
    }
  };

  // Reactive hook to ensure Leaflet's native scroll and drag handlers synchronize with isMapLocked state
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (isMapLocked) {
      map.scrollWheelZoom?.disable();
      map.dragging?.disable();
      map.touchZoom?.disable();
      map.doubleClickZoom?.disable();
      map.boxZoom?.disable();
    } else {
      map.scrollWheelZoom?.enable();
      map.dragging?.enable();
      map.touchZoom?.enable();
      map.doubleClickZoom?.enable();
      map.boxZoom?.enable();
    }
  }, [isMapLocked]);

  // Robust fetcher with retry and cancellation support
  const fetchWithRetry = async (
    url: string,
    signal: AbortSignal,
    maxRetries = 1
  ): Promise<Response | null> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) return null;
      try {
        const res = await fetch(url, { signal });
        if (res.ok) return res;
        if (res.status === 404) return res; // Non-transient 404
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || signal.aborted) return null;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
      }
    }
    return null;
  };

  // Asynchronous coordinate-to-region loader for on-demand chunk retrieval
  const loadRegionByCoordinates = async (lat: number, lng: number): Promise<boolean> => {
    // Prevent reverse coordinate lookup from clobbering an explicitly selected sub-province or region
    const currentKey = activeChunkKeyRef.current;
    if (currentKey && currentKey !== 'philippines' && currentKey !== 'panay') {
      return false;
    }

    const chunk = findRegionByCoordinates(lat, lng);
    if (!chunk) return false;

    if (activeChunkKeyRef.current === chunk.key && geoJsonLayerRef.current) {
      return true;
    }

    const data = await fetchRegionChunk(chunk.key);
    if (data) {
      activeChunkKeyRef.current = chunk.key;
      onRegionChange?.(chunk.key);
      renderRegionGeoJson(chunk.key, data);
      checkViewportFeatures();
      return true;
    }

    // Keep active map coordinates parked; retain previously mounted geometry rather than reverting to Panay
    return false;
  };

  // Asynchronous lazy-loader for regional GeoJSON chunks with in-memory caching and debounced target locking
  const fetchRegionChunk = async (key: string): Promise<GeoJSON.FeatureCollection | null> => {
    if (geojsonCacheRef.current.has(key)) {
      return geojsonCacheRef.current.get(key)!;
    }
    if (regionCacheRef.current.has(key)) {
      return regionCacheRef.current.get(key)!;
    }

    const canonicalKey = REGION_PRESETS[key]?.id || key;
    if (geojsonCacheRef.current.has(canonicalKey)) {
      return geojsonCacheRef.current.get(canonicalKey)!;
    }
    if (regionCacheRef.current.has(canonicalKey)) {
      return regionCacheRef.current.get(canonicalKey)!;
    }

    // If selecting a Panay sub-province (iloilo, capiz, aklan, antique), derive from Panay if already cached
    const cachedPanay = geojsonCacheRef.current.get('panay') || regionCacheRef.current.get('panay');
    if (['iloilo', 'capiz', 'aklan', 'antique'].includes(key) && cachedPanay) {
      const filtered = cachedPanay.features.filter((f: GeoJSON.Feature) =>
        (f.properties?.ADM2_EN || '').toLowerCase().includes(key)
      );
      if (filtered.length > 0) {
        const subCol: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: filtered,
        };
        geojsonCacheRef.current.set(key, subCol);
        regionCacheRef.current.set(key, subCol);
        return subCol;
      }
    }

    // Abort prior in-flight chunk download
    if (chunkAbortControllerRef.current) {
      chunkAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    chunkAbortControllerRef.current = controller;
    pendingRegionKeyRef.current = key;

    onChunkLoadingChange?.(true);

    try {
      const chunkMeta = REGIONAL_CHUNKS.find((r) => r.key === canonicalKey || r.key === key);
      const url = chunkMeta
        ? chunkMeta.geojsonPath
        : canonicalKey === 'philippines'
          ? '/philippines_boundaries.geojson'
          : canonicalKey === 'panay'
            ? '/regions/panay.geojson'
            : `/regions/${canonicalKey}.geojson`;

      let res = await fetchWithRetry(url, controller.signal);
      if ((!res || !res.ok) && (key === 'panay' || canonicalKey === 'panay')) {
        res = await fetchWithRetry('/panay_municipalities.geojson', controller.signal);
      }

      if (controller.signal.aborted) {
        return null;
      }

      if (res && res.ok) {
        const geojson: GeoJSON.FeatureCollection = await res.json();
        if ((key === 'panay' || canonicalKey === 'panay') && geojson.features) {
          geojson.features = geojson.features.filter((f: GeoJSON.Feature) => {
            const adm2 = (f.properties?.ADM2_EN || f.properties?.province || '').toLowerCase().trim();
            const pcode = f.properties?.ADM3_PCODE || f.properties?.psgc_code || '';
            return adm2 !== 'guimaras' && !pcode.startsWith('PH06079');
          });
        }
        geojsonCacheRef.current.set(key, geojson);
        geojsonCacheRef.current.set(canonicalKey, geojson);
        regionCacheRef.current.set(key, geojson);
        regionCacheRef.current.set(canonicalKey, geojson);
        return geojson;
      }

      if (res && res.status === 404) {
        console.warn(`[PanayMap] Regional mesh for ${key} returned 404.`);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn(`[PanayMap] Failed to fetch region chunk for ${key}:`, err);
      }
    } finally {
      if (pendingRegionKeyRef.current === key) {
        onChunkLoadingChange?.(false);
        pendingRegionKeyRef.current = null;
      }
    }

    return geojsonCacheRef.current.get(key) || regionCacheRef.current.get(key) || geojsonCacheRef.current.get(canonicalKey) || null;
  };

  // Warm gold radiance running light boundary animation for selected municipality or province
  const attachNeonStreak = useCallback((targetId: string, customChunkData?: GeoJSON.FeatureCollection | null) => {
    const map = mapRef.current;
    if (!map || !(map as any)._loaded) return;

    // 0. Clear any active 3-second streak transition timer
    if (streakTimerRef.current) {
      clearTimeout(streakTimerRef.current);
      streakTimerRef.current = null;
    }

    // 1. Clean up previous animated streak layer and classes
    if (activeStreakLayerRef.current) {
      try {
        map.removeLayer(activeStreakLayerRef.current);
      } catch {}
      activeStreakLayerRef.current = null;
    }
    Object.values(layersRef.current).forEach((l: any) => {
      if (l?._path) {
        try {
          l._path.classList.remove(
            'polygon-streak-gold',
            'polygon-highlight-gold-settled',
            'polygon-streak-active',
            'polygon-highlight-settled',
            'lgu-active-stroke'
          );
        } catch {}
      }
    });

    if (!targetId) return;

    const targetNorm = targetId.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    // Check if target is a province/region or municipality
    const treeNode = findRegionTreeNode(targetId);
    const isProvinceTarget =
      treeNode?.type === 'province' ||
      treeNode?.type === 'region' ||
      REGION_PRESETS[targetId] !== undefined ||
      REGIONAL_CHUNKS.some((c) => c.key === targetId);

    // 2. If layer exists in layersRef, attach gold streak class to _path directly if available
    const existingLayer = layersRef.current[targetId] ||
      Object.values(layersRef.current).find((l: any) => {
        const p = l?.feature?.properties || {};
        const id = String(p.ADM3_PCODE || p.psgc_code || p.ADM2_PCODE || '');
        const name = String(p.ADM3_EN || p.ADM2_EN || p.ADM1_EN || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        return id === targetId || name === targetNorm;
      });

    if (existingLayer && (existingLayer as any)._path) {
      try {
        const pEl = (existingLayer as any)._path;
        pEl.classList.remove('polygon-highlight-gold-settled', 'polygon-highlight-settled');
        pEl.classList.add('polygon-streak-gold');
        pEl.addEventListener('animationend', () => {
          pEl.classList.remove('polygon-streak-gold', 'polygon-streak-active', 'lgu-active-stroke');
        }, { once: true });
      } catch {}
    }

    // 3. Find feature geometry from passed chunk, geoJsonLayerRef, or region caches
    let matchingData: GeoJSON.Feature | GeoJSON.FeatureCollection | GeoJSON.Feature[] | null = null;

    const collectAllFeatures = (): GeoJSON.Feature[] => {
      const list: GeoJSON.Feature[] = [];
      if (customChunkData?.features) list.push(...customChunkData.features);
      if (geoJsonLayerRef.current) {
        try {
          const gj = (geoJsonLayerRef.current as any).toGeoJSON?.();
          if (gj?.features) list.push(...gj.features);
        } catch {}
      }
      for (const chunk of regionCacheRef.current.values()) {
        if (chunk?.features) list.push(...chunk.features);
      }
      for (const chunk of geojsonCacheRef.current.values()) {
        if (chunk?.features) list.push(...chunk.features);
      }
      return list;
    };

    if (isProvinceTarget) {
      // Province target: collect all features belonging to this province/region
      const allFeatures = collectAllFeatures();
      const targetClean = (treeNode?.name || targetId).replace(/Province|City|\(.*?\)/gi, '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const provinceFeatures = allFeatures.filter((feat) => {
        const props = feat.properties || {};
        const adm2 = String(props.ADM2_EN || props.province || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const adm1 = String(props.ADM1_EN || props.region || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const pcode = String(props.ADM2_PCODE || '').toLowerCase();
        return (
          adm2 === targetClean ||
          (targetClean.length >= 4 && (adm2.includes(targetClean) || targetClean.includes(adm2))) ||
          pcode === targetNorm
        );
      });

      if (provinceFeatures.length > 0) {
        matchingData = provinceFeatures;
      } else if (customChunkData?.features && customChunkData.features.length > 0) {
        matchingData = customChunkData.features;
      }
    } else {
      // Municipality target: find single matching feature
      const searchFeatures = (features?: GeoJSON.Feature[]) => {
        if (!features) return null;
        return features.find((feat) => {
          const props = feat.properties || {};
          const id = String(props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE || '');
          const rawName = String(props.ADM3_EN || props.name || props.ADM2_EN || props.ADM1_EN || '');
          const norm = rawName.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');
          return (
            id === targetId ||
            props.ADM3_PCODE === targetId ||
            props.psgc_code === targetId ||
            rawName.toLowerCase().trim() === targetId.toLowerCase().trim() ||
            norm === targetNorm
          );
        }) || null;
      };

      if (customChunkData?.features) {
        matchingData = searchFeatures(customChunkData.features);
      }
      if (!matchingData && geoJsonLayerRef.current) {
        try {
          const currentGeoJson = (geoJsonLayerRef.current as any).toGeoJSON?.();
          if (currentGeoJson?.features) {
            matchingData = searchFeatures(currentGeoJson.features);
          }
        } catch {}
      }
      if (!matchingData) {
        for (const chunk of regionCacheRef.current.values()) {
          if (chunk?.features) {
            matchingData = searchFeatures(chunk.features);
            if (matchingData) break;
          }
        }
      }
      if (!matchingData) {
        for (const chunk of geojsonCacheRef.current.values()) {
          if (chunk?.features) {
            matchingData = searchFeatures(chunk.features);
            if (matchingData) break;
          }
        }
      }
    }

    // 4. Render dedicated SVG boundary layer overlay with ultra-thin animated fleeting gold streak
    if (matchingData) {
      if (!map.getPane('lguStreakPane')) {
        const sp = map.createPane('lguStreakPane');
        sp.style.zIndex = '650';
        sp.style.pointerEvents = 'none';
      }

      const streakLayer = L.geoJSON(matchingData as any, {
        pane: 'lguStreakPane',
        interactive: false,
        style: () => ({
          renderer: L.svg({ padding: 0.5 }),
          color: '#fef08a',
          weight: 0.7,
          fillColor: 'transparent',
          fillOpacity: 0,
          className: 'polygon-streak-gold',
          lineCap: 'round',
          lineJoin: 'round',
        }),
        onEachFeature: (_feat: any, layer: any) => {
          if (layer?._path) {
            layer._path.classList.add('polygon-streak-gold');
            layer._path.addEventListener('animationend', () => {
              if (activeStreakLayerRef.current === streakLayer && (streakLayer as any)._map) {
                try {
                  map.removeLayer(streakLayer);
                } catch {}
                activeStreakLayerRef.current = null;
              }
            }, { once: true });
          }
        },
      }).addTo(map);

      activeStreakLayerRef.current = streakLayer;

      setTimeout(() => {
        if (streakLayer && (streakLayer as any)._map) {
          streakLayer.eachLayer((l: any) => {
            if (l?._path) {
              l._path.classList.add('polygon-streak-gold');
            }
          });
        }
      }, 10);

      // 3.5-Second Fleeting Gold Trace Lifecycle:
      // Once the traveling streak finishes its single cycle, remove the temporary SVG streak layer entirely
      // and strip all streak classes, returning cleanly to untouched original polygon styling.
      streakTimerRef.current = setTimeout(() => {
        if (activeStreakLayerRef.current === streakLayer && (streakLayer as any)._map) {
          try {
            map.removeLayer(streakLayer);
          } catch {}
          activeStreakLayerRef.current = null;
        }
        if (existingLayer && (existingLayer as any)._path) {
          try {
            (existingLayer as any)._path.classList.remove(
              'polygon-streak-gold',
              'polygon-streak-active',
              'lgu-active-stroke',
              'polygon-highlight-gold-settled',
              'polygon-highlight-settled'
            );
          } catch {}
        }
      }, 3500);
    }
  }, []);

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
        municipalitiesByIdRef.current.set(m.id, m);
        if (m.pcode) municipalitiesByIdRef.current.set(m.pcode, m);
        if (m.psgc) municipalitiesByIdRef.current.set(m.psgc, m);
        if (m.name) {
          municipalitiesByIdRef.current.set(m.name.toLowerCase().trim(), m);
          const norm = m.name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');
          if (norm) municipalitiesByIdRef.current.set(norm, m);
        }
      });
      onChunkLoaded?.(generated);
    }

    // Ensure every feature in this active chunk has a valid entry in municipalitiesByIdRef
    data.features.forEach((feat: GeoJSON.Feature) => {
      const props = feat.properties || {};
      const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
      const pcode = props.ADM3_PCODE || props.psgc_code || props.ADM2_PCODE;
      const rawName = String(props.ADM3_EN || props.name || props.ADM2_EN || props.ADM1_EN || '');
      const normName = rawName ? rawName.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';
      let m = municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);
      if (!m) {
        const [created] = createMunicipalities([feat]);
        m = created;
      }
      if (m) {
        municipalitiesByIdRef.current.set(id, m);
        if (pcode) municipalitiesByIdRef.current.set(pcode, m);
        if (rawName) municipalitiesByIdRef.current.set(rawName.toLowerCase().trim(), m);
        if (normName) municipalitiesByIdRef.current.set(normName, m);
      }
    });

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

    // If there is an active event, compute the simulation map for this new region chunk immediately before styling
    const curEvent = activeEvent || gdacsAlerts?.find((a) =>
      String(activeEventId) === String(a.id) ||
      String(activeEventId) === `gdacs-${a.event_id}` ||
      String(activeEventId) === String(a.event_id)
    );
    if (curEvent) {
      const computedSim = computeDistanceDecaySimulation({
        event: curEvent,
        municipalities: Array.from(municipalitiesByIdRef.current.values()),
        features: data.features,
        centroidsMap: centroidsRef.current,
      });
      activeSimulationMapRef.current = {
        ...activeSimulationMapRef.current,
        ...computedSim,
      };
      setActiveSimulationMapState((prev) => ({ ...prev, ...computedSim }));
    }

    // HTML5 Canvas renderer configuration: eliminates DOM node bloat for hundreds/thousands of polygons
    const newLayer = L.geoJSON(data, {
      style: (feature) => {
        const props = feature?.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const simRecord = (pcode && activeSimulationMapRef.current[pcode])
          || (id && activeSimulationMapRef.current[id])
          || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
          || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
          || (normName && activeSimulationMapRef.current[normName]);

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));
        const lightMode = isLightRef.current;
        const isNight = nightGlowModeRef.current;
        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, lightMode, isNight, simRecord),
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const props = feature.properties || {};
        const id = String(props.ADM3_PCODE ?? props.psgc_code ?? props.ADM2_PCODE ?? '');
        if (!featureLayer || (!('setStyle' in featureLayer) && !(featureLayer instanceof L.Path))) return;

        layersRef.current[id] = featureLayer;
        const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
        const rawName = String(props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || 'Municipality');
        const normName = rawName ? rawName.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        // Extract precise polygon bounds centroid for the radiance canvas
        if (typeof (featureLayer as any).getBounds === 'function') {
          const bounds = (featureLayer as any).getBounds();
          if (bounds && typeof bounds.isValid === 'function' && bounds.isValid()) {
            const center = bounds.getCenter();
            centroidsRef.current.set(id, [center.lat, center.lng]);
            if (pcode) centroidsRef.current.set(pcode, [center.lat, center.lng]);
            if (props.GID_2) centroidsRef.current.set(props.GID_2, [center.lat, center.lng]);
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
          click: (e: any) => {
            if (e) {
              try { L.DomEvent.stopPropagation(e); } catch {}
            }
            onSelectRef.current(id);
            const center = centroidsRef.current.get(id) || (pcode ? centroidsRef.current.get(pcode) : null);
            const regionLabel = initialProvince ? `${initialName}, ${initialProvince}` : initialName;
            if (center) {
              window.dispatchEvent(
                new CustomEvent('sanag:select-weather-location', {
                  detail: {
                    lat: center[0],
                    lon: center[1],
                    regionName: regionLabel,
                    source: 'map-polygon',
                  },
                })
              );
            } else {
              window.dispatchEvent(
                new CustomEvent('sanag:select-weather-location', {
                  detail: {
                    regionName: regionLabel,
                    source: 'map-polygon',
                  },
                })
              );
            }
          },
          mouseover: () => {
            onHoverRef.current(id);
            const activeLight = isLightRef.current;
            const activeNight = nightGlowModeRef.current;

            // Determine municipality recovery ratio tier and update active RAG legend indicator
            const targetM =
              municipalitiesByIdRef.current.get(id) ||
              (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
              (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
              (normName ? municipalitiesByIdRef.current.get(normName) : null);
            const simRecord = (pcode && activeSimulationMapRef.current[pcode])
              || (id && activeSimulationMapRef.current[id])
              || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
              || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
              || (normName && activeSimulationMapRef.current[normName]);

            const ratio = simRecord != null
              ? simRecord.recovery_ratio
              : (targetM?.currentRadiance != null && targetM?.baselineRadiance
                ? (targetM.currentRadiance / targetM.baselineRadiance)
                : (targetM?.recoveryScore ?? initialScore) / 100);

            const statusTier: 'critical' | 'restoration' | 'recovered' =
              ratio < 0.60 ? 'critical' : ratio < 0.90 ? 'restoration' : 'recovered';
            onHoverRagStatusChangeRef.current?.(statusTier);

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
            onHoverRagStatusChangeRef.current?.(null);
            const activeLight = isLightRef.current;
            const activeNight = nightGlowModeRef.current;
            const currentM =
              municipalitiesByIdRef.current.get(id) ||
              (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
              (rawName ? municipalitiesByIdRef.current.get(rawName.toLowerCase().trim()) : null) ||
              (normName ? municipalitiesByIdRef.current.get(normName) : null);
            const simRecord = (pcode && activeSimulationMapRef.current[pcode])
              || (id && activeSimulationMapRef.current[id])
              || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
              || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
              || (normName && activeSimulationMapRef.current[normName]);
            if (currentM) {
              updateLayerStyle(featureLayer, currentM, id === selectedIdRef.current || currentM.id === selectedIdRef.current, activeLight, activeNight, simRecord);
            } else if (typeof (featureLayer as any).setStyle === 'function') {
              (featureLayer as any).setStyle(getPolygonStyle(null, false, activeLight, activeNight, simRecord));
            }
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = newLayer;

    // Apply any telemetry scores or dynamic simulation records
    Object.entries(layersRef.current).forEach(([id, featureLayer]) => {
      const props = (featureLayer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

      const m =
        municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);

      const simRecord = (pcode && activeSimulationMapRef.current[pcode])
        || (id && activeSimulationMapRef.current[id])
        || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
        || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
        || (normName && activeSimulationMapRef.current[normName]);

      if (m) {
        if (simRecord) {
          m.recoveryScore = Math.max(0, Math.min(100, Math.round(simRecord.recovery_ratio * 100)));
          m.status = simRecord.status;
          m.baselineRadiance = simRecord.pre_radiance;
          m.currentRadiance = simRecord.post_radiance;
        }
        updateLayerStyle(featureLayer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLightRef.current, nightGlowModeRef.current, simRecord);
        const radVal = m.currentRadiance ? `${m.currentRadiance.toFixed(1)} nW` : `${(m.recoveryScore * 0.45).toFixed(1)} nW`;
        const tip = nightGlowModeRef.current
          ? `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery · ${radVal} radiance`
          : `${m.name}${m.province ? ` (${m.province})` : ''} · ${m.recoveryScore}% recovery`;
        featureLayer.setTooltipContent(tip);
      }
    });

    if (curEvent) {
      runSimulationForCurrentRegion(curEvent, data.features);
    }

    // Synchronize the Realistic Night Light canvas overlay with the newly rendered features
    nightLightOverlayRef.current?.redraw();
    checkViewportFeatures();

    if (selectedIdRef.current) {
      attachNeonStreak(selectedIdRef.current, data);
    }
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
    if (!map || !(map as any)._loaded || !(map as any)._panes) return;

    try {
      // 1. Explicitly recalculate container size against current viewport dimensions
      (map.invalidateSize as any)({ pan: false, debounceMoveend: true });

      // 2. Identify the target bounds:
      let targetBounds: L.LatLngBounds | null = activeRegionBoundsRef.current;
      if (!targetBounds && geoJsonLayerRef.current && typeof (geoJsonLayerRef.current as any).getBounds === 'function') {
        try {
          const layerBounds = (geoJsonLayerRef.current as any).getBounds();
          if (layerBounds && layerBounds.isValid && layerBounds.isValid()) {
            targetBounds = layerBounds;
          }
        } catch {}
      }

      // Check active region's configured hierarchy bounds or bbox
      const currentKey = activeChunkKeyRef.current || selectedRegionKey || getActiveDefaultRegion() || 'panay';
      if (!targetBounds) {
        const treeNode = findRegionTreeNode(currentKey);
        if (treeNode?.bounds) {
          targetBounds = L.latLngBounds(treeNode.bounds);
        } else {
          const chunk = REGIONAL_CHUNKS.find(
            (c) => c.key === currentKey || c.key === REGION_PRESETS[currentKey]?.id
          );
          if (chunk) {
            targetBounds = L.latLngBounds([
              [chunk.minLat, chunk.minLng],
              [chunk.maxLat, chunk.maxLng],
            ]);
          }
        }
      }

      // Only default to Panay Island if explicitly selected as 'panay' or no bounds could be determined
      if (!targetBounds && currentKey === 'panay') {
        targetBounds = PANAY_BOUNDS;
      }

      // 3. Fit cleanly to the calculated bounds with comfortable margins
      if (targetBounds && targetBounds.isValid && targetBounds.isValid()) {
        activeRegionBoundsRef.current = targetBounds;
        map.fitBounds(targetBounds, {
          padding: [30, 30],
          maxZoom: 11,
          animate,
        });
      } else {
        const preset = REGION_PRESETS[currentKey] || REGION_PRESETS.panay;
        if (animate) {
          map.flyTo(preset.center, preset.zoom, { duration: 0.8 });
        } else {
          map.setView(preset.center, preset.zoom);
        }
      }

      // 4. Re-trigger basemap tiles and night light overlay redraw
      if (tileLayerRef.current) {
        if (typeof (tileLayerRef.current as any).redraw === 'function') {
          (tileLayerRef.current as any).redraw();
        } else {
          const tileUrl = getBaseTileUrl(isLightRef.current, nightGlowModeRef.current, settings?.basemapSource);
          tileLayerRef.current.setUrl(tileUrl);
        }
      }
      if (canvasRendererRef.current && typeof (canvasRendererRef.current as any)._update === 'function') {
        try {
          (canvasRendererRef.current as any)._update();
        } catch {}
      }
      if (nightLightOverlayRef.current && typeof nightLightOverlayRef.current.redraw === 'function') {
        nightLightOverlayRef.current.redraw();
      }
      checkViewportFeatures();
    } catch (err) {
      console.warn('[PanayMap] Error in resetToDefaultBounds:', err);
    }
  };

  const handleReset = () => {
    if (streakTimerRef.current) {
      clearTimeout(streakTimerRef.current);
      streakTimerRef.current = null;
    }
    if (activeStreakLayerRef.current && mapRef.current) {
      try {
        mapRef.current.removeLayer(activeStreakLayerRef.current);
      } catch {}
      activeStreakLayerRef.current = null;
    }
    Object.values(layersRef.current).forEach((l: any) => {
      if (l?._path) {
        try {
          l._path.classList.remove(
            'polygon-streak-gold',
            'polygon-highlight-gold-settled',
            'polygon-streak-active',
            'polygon-highlight-settled',
            'lgu-active-stroke'
          );
        } catch {}
      }
    });
    lastFocusedIdRef.current = null;
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
      scrollWheelZoom: !initialLocked,
      wheelDebounceTime: 40,
      wheelPxPerZoomLevel: 120,
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
    const initialTileLayer = L.tileLayer(initialTileUrl, TILE_LAYER_OPTIONS);
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
      intensity: nightGlowIntensity,
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

    // Viewport-driven dynamic regional GeoJSON chunk loading with debouncing
    let moveTimeout: any = null;
    const handleViewportChange = () => {
      clearTimeout(moveTimeout);
      moveTimeout = setTimeout(() => {
        if (!mapRef.current) return;
        // Guard against programmatic moves (fitBounds, flyTo)
        if (isProgrammaticMoveRef.current) {
          checkViewportFeatures();
          return;
        }

        // Do not auto-revert if an explicit province or sub-region is selected
        const currentKey = activeChunkKeyRef.current;
        if (currentKey && currentKey !== 'philippines' && currentKey !== 'panay') {
          checkViewportFeatures();
          return;
        }

        const center = mapRef.current.getCenter();
        const matched = findRegionByCoordinates(center.lat, center.lng);
        if (matched && matched.key !== activeChunkKeyRef.current) {
          loadRegionByCoordinates(center.lat, center.lng);
        } else {
          checkViewportFeatures();
        }
      }, 250);
    };

    map.on('moveend', handleViewportChange);

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
      clearTimeout(moveTimeout);
      map.off('moveend', handleViewportChange);
      clearEpicenterBuffer();
      if (activeStreakLayerRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(activeStreakLayerRef.current);
        } catch {}
        activeStreakLayerRef.current = null;
      }
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

    const newTileLayer = L.tileLayer(tileUrl, TILE_LAYER_OPTIONS);
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
        const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const simRecord = (pcode && activeSimulationMapRef.current[pcode])
          || (id && activeSimulationMapRef.current[id])
          || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
          || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
          || (normName && activeSimulationMapRef.current[normName]);

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));

        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, isLight, nightGlowModeRef.current, simRecord),
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      if (!mapRef.current || !layer || !(layer as any)._map) return;
      const props = (layer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';
      const m =
        municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);

      const simRecord = (pcode && activeSimulationMapRef.current[pcode])
        || (id && activeSimulationMapRef.current[id])
        || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
        || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
        || (normName && activeSimulationMapRef.current[normName]);

      if (m) {
        updateLayerStyle(layer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLight, nightGlowModeRef.current, simRecord);
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
            intensity: nightGlowIntensity,
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
        const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          municipalitiesByIdRef.current.get(id) ||
          (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
          (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
          (normName ? municipalitiesByIdRef.current.get(normName) : null);

        const simRecord = (pcode && activeSimulationMapRef.current[pcode])
          || (id && activeSimulationMapRef.current[id])
          || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
          || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
          || (normName && activeSimulationMapRef.current[normName]);

        const isSelected = Boolean(id === selectedIdRef.current || (municipality && municipality.id === selectedIdRef.current));
        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, isLightRef.current, nightGlowMode, simRecord),
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      if (!mapRef.current || !layer || !(layer as any)._map) return;
      const props = (layer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';
      const m =
        municipalitiesByIdRef.current.get(id) ||
        (pcode ? municipalitiesByIdRef.current.get(pcode) : null) ||
        (name ? municipalitiesByIdRef.current.get(name.toLowerCase().trim()) : null) ||
        (normName ? municipalitiesByIdRef.current.get(normName) : null);

      const simRecord = (pcode && activeSimulationMapRef.current[pcode])
        || (id && activeSimulationMapRef.current[id])
        || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
        || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
        || (normName && activeSimulationMapRef.current[normName]);

      if (m) {
        updateLayerStyle(layer, m, id === selectedIdRef.current || m.id === selectedIdRef.current, isLightRef.current, nightGlowMode, simRecord);
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

    checkViewportFeatures();
  }, [nightGlowMode]);

  // Synchronize dynamic night glow intensity adjustments from slider
  useEffect(() => {
    if (nightLightOverlayRef.current && typeof (nightLightOverlayRef.current as any).setIntensity === 'function') {
      (nightLightOverlayRef.current as any).setIntensity(nightGlowIntensity);
    }
  }, [nightGlowIntensity]);

  const [isRefreshingMap, setIsRefreshingMap] = useState<boolean>(false);

  // Synchronously force-resync Leaflet's internal sizing, redraw tiles, and restore active bounds
  const handleForceRefreshMap = useCallback(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    setIsRefreshingMap(true);
    setTimeout(() => setIsRefreshingMap(false), 650);

    try {
      // 1. Force container dimension recalculation
      (map.invalidateSize as any)({ pan: false, debounceMoveend: false });

      // 2. Redraw active tile layer (NASA Black Marble / Dark Matter)
      if (tileLayerRef.current) {
        if (!map.hasLayer(tileLayerRef.current)) {
          tileLayerRef.current.addTo(map);
        }
        if (typeof (tileLayerRef.current as any).bringToBack === 'function') {
          (tileLayerRef.current as any).bringToBack();
        }
        tileLayerRef.current.redraw();
      }

      // 3. Reset leaflet pane origin transform offsets and redraw all vector/tile layers
      map.eachLayer((layer: any) => {
        if (layer && typeof layer.redraw === 'function') {
          layer.redraw();
        } else if (layer && typeof layer._updatePath === 'function') {
          layer._updatePath();
        }
      });

      // Maintain dark silhouette outline layer
      if (islandSilhouetteLayerRef.current && !map.hasLayer(islandSilhouetteLayerRef.current)) {
        islandSilhouetteLayerRef.current.addTo(map);
      }

      // Repaint vector canvas renderer
      if (canvasRendererRef.current) {
        if (!map.hasLayer(canvasRendererRef.current)) {
          canvasRendererRef.current.addTo(map);
        }
        if (typeof (canvasRendererRef.current as any)._update === 'function') {
          try {
            (canvasRendererRef.current as any)._update();
          } catch {}
        }
        if (typeof (canvasRendererRef.current as any).requestRedraw === 'function') {
          try {
            (canvasRendererRef.current as any).requestRedraw();
          } catch {}
        }
      }

      // Redraw realistic VIIRS radiance overlay
      if (nightLightOverlayRef.current && typeof nightLightOverlayRef.current.redraw === 'function') {
        nightLightOverlayRef.current.redraw();
      }

      // 4. Re-fit bounds to currently active entity without snapping away
      let selectedEntityBounds: L.LatLngBounds | null = null;
      if (selectedId && layersRef.current[selectedId]) {
        try {
          const b = layersRef.current[selectedId].getBounds?.();
          if (b && b.isValid && b.isValid()) {
            selectedEntityBounds = b;
          }
        } catch {}
      }
      if (!selectedEntityBounds && activeRegionBoundsRef.current && activeRegionBoundsRef.current.isValid && activeRegionBoundsRef.current.isValid()) {
        selectedEntityBounds = activeRegionBoundsRef.current;
      }
      if (!selectedEntityBounds && geoJsonLayerRef.current && typeof (geoJsonLayerRef.current as any).getBounds === 'function') {
        try {
          const b = (geoJsonLayerRef.current as any).getBounds();
          if (b && b.isValid && b.isValid()) {
            selectedEntityBounds = b;
          }
        } catch {}
      }
      if (!selectedEntityBounds) {
        const currentKey = activeChunkKeyRef.current || selectedRegionKey || 'panay';
        const treeNode = findRegionTreeNode(currentKey);
        if (treeNode?.bounds) {
          selectedEntityBounds = L.latLngBounds(treeNode.bounds);
        } else if (currentKey === 'philippines') {
          selectedEntityBounds = L.latLngBounds(PHILIPPINES_BOUNDS);
        } else {
          selectedEntityBounds = PANAY_BOUNDS;
        }
      }

      if (selectedEntityBounds && selectedEntityBounds.isValid && selectedEntityBounds.isValid()) {
        map.fitBounds(selectedEntityBounds, { padding: [30, 30], animate: false });
      } else if (PANAY_BOUNDS) {
        map.fitBounds(PANAY_BOUNDS, { padding: [20, 20], animate: false });
      }

      // Synchronize active hazard event simulation
      if (activeEventRef.current) {
        runSimulationForCurrentRegion(activeEventRef.current);
      }

      checkViewportFeatures();
    } catch (err) {
      console.warn('[PanayMap] Error during handleForceRefreshMap:', err);
    }
  }, [selectedId, selectedRegionKey]);

  // Keyboard shortcut: Press 'R' or 'r' to force refresh map & sync tiles
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        const isEditable = (document.activeElement as HTMLElement)?.isContentEditable;
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || isEditable) {
          return;
        }
        e.preventDefault();
        handleForceRefreshMap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleForceRefreshMap]);

  // Auto-trigger on Maximize / Minimize Transitions after 150ms settle timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      handleForceRefreshMap();
    }, 150);

    // Also listen to native browser Fullscreen API events
    document.addEventListener('fullscreenchange', handleForceRefreshMap);
    document.addEventListener('webkitfullscreenchange', handleForceRefreshMap);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('fullscreenchange', handleForceRefreshMap);
      document.removeEventListener('webkitfullscreenchange', handleForceRefreshMap);
    };
  }, [isMaximized, handleForceRefreshMap]);

  // Recalculate Leaflet map canvas dimensions when map header collapses or expands
  useEffect(() => {
    if (!mapRef.current) return;
    const timer = setTimeout(() => {
      if (mapRef.current) {
        (mapRef.current.invalidateSize as any)({ pan: false });
      }
    }, 310);
    return () => clearTimeout(timer);
  }, [isHeaderCollapsed]);

  // Native Global Keyboard Shortcuts (+ and -) for Leaflet Map Zoom
  useEffect(() => {
    const handleZoomKeyboard = (e: KeyboardEvent) => {
      // Don't intercept when user is using system shortcuts (Ctrl/Cmd/Alt)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Don't intercept when user is typing in inputs or search dropdowns
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      const isEditable = (document.activeElement as HTMLElement)?.isContentEditable;
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || isEditable) {
        return;
      }

      if (!mapRef.current) return;
      const map = mapRef.current;
      if (isLockedRef.current) return;

      // Zoom In: "+" or "=" (standard unshifted key) or Numpad Add
      if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
        e.preventDefault();
        map.zoomIn(1, { animate: true });
      }
      // Zoom Out: "-" or "_" or Numpad Subtract
      else if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        map.zoomOut(1, { animate: true });
      }
    };

    window.addEventListener('keydown', handleZoomKeyboard, { passive: false });
    return () => {
      window.removeEventListener('keydown', handleZoomKeyboard);
    };
  }, []);

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

  // Smoothly pan & zoom and lazy-load regional chunk when user selects a different Philippine region or province
  useEffect(() => {
    let isMounted = true;
    const map = mapRef.current;
    if (!map || !selectedRegionKey) return;
    activeChunkKeyRef.current = selectedRegionKey;
    clearEpicenterBuffer();

    // Guard against viewport change moveend auto-loader interference
    isProgrammaticMoveRef.current = true;

    fetchRegionChunk(selectedRegionKey).then((chunkData) => {
      if (!isMounted) return;
      const currentMap = mapRef.current;
      if (!currentMap || !(currentMap as any)._loaded || !(currentMap as any)._panes) {
        isProgrammaticMoveRef.current = false;
        return;
      }

      if (chunkData) {
        renderRegionGeoJson(selectedRegionKey, chunkData);
      }

      // Calculate isolated bounding box for this specific province or region
      let provinceBounds: L.LatLngBounds | null = null;
      const treeNode = findRegionTreeNode(selectedRegionKey);
      if (treeNode?.bounds) {
        provinceBounds = L.latLngBounds(treeNode.bounds);
      } else if (geoJsonLayerRef.current && typeof (geoJsonLayerRef.current as any).getBounds === 'function') {
        try {
          const b = (geoJsonLayerRef.current as any).getBounds();
          if (b && b.isValid && b.isValid()) {
            provinceBounds = b;
          }
        } catch {}
      }

      if (!provinceBounds) {
        const chunkMeta = REGIONAL_CHUNKS.find((c) => c.key === selectedRegionKey);
        if (chunkMeta) {
          provinceBounds = L.latLngBounds([
            [chunkMeta.minLat, chunkMeta.minLng],
            [chunkMeta.maxLat, chunkMeta.maxLng],
          ]);
        }
      }

      const preset = REGION_PRESETS[selectedRegionKey];

      try {
        // If a municipality is actively selected, do not alter camera zoom or bounds
        if (!selectedIdRef.current) {
          if (selectedRegionKey === 'philippines') {
            activeRegionBoundsRef.current = L.latLngBounds(PHILIPPINES_BOUNDS);
            currentMap.fitBounds(PHILIPPINES_BOUNDS, { padding: [20, 20], animate: true });
          } else if (selectedRegionKey === 'panay') {
            activeRegionBoundsRef.current = PANAY_BOUNDS;
            currentMap.fitBounds(PANAY_BOUNDS, { padding: [20, 20], animate: true });
          } else if (provinceBounds && provinceBounds.isValid && provinceBounds.isValid()) {
            activeRegionBoundsRef.current = provinceBounds;
            currentMap.fitBounds(provinceBounds, { padding: [20, 20], maxZoom: 11, animate: true });
          } else if (preset) {
            currentMap.flyTo(preset.center, preset.zoom, { duration: 1.0 });
          }
        } else if (provinceBounds && provinceBounds.isValid && provinceBounds.isValid()) {
          activeRegionBoundsRef.current = provinceBounds;
        }

        if (selectedRegionKey && selectedRegionKey !== 'philippines') {
          attachNeonStreak(selectedRegionKey, chunkData);
        }
      } catch (err) {
        console.warn('[PanayMap] Error zooming to region/province:', err);
      }

      setTimeout(() => {
        isProgrammaticMoveRef.current = false;
      }, 1000);
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
        const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
        const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
        const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

        const municipality =
          map.get(id) ||
          (pcode ? map.get(pcode) : null) ||
          (name ? map.get(name.toLowerCase().trim()) : null) ||
          (normName ? map.get(normName) : null);

        const simRecord = (pcode && activeSimulationMapRef.current[pcode])
          || (id && activeSimulationMapRef.current[id])
          || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
          || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
          || (normName && activeSimulationMapRef.current[normName]);

        const isSelected = Boolean(id === selectedId || (municipality && municipality.id === selectedId));
        const lightMode = isLightRef.current;
        const isNight = nightGlowModeRef.current;
        return {
          renderer: canvasRendererRef.current || undefined,
          ...getPolygonStyle(municipality, isSelected, lightMode, isNight, simRecord),
        };
      });
    }

    Object.entries(layersRef.current).forEach(([id, layer]) => {
      const props = (layer as any)?.feature?.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE;
      const name = props.ADM3_EN || props.ADM2_EN || props.ADM1_EN || '';
      const normName = name ? name.toLowerCase().replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '') : '';

      const municipality =
        map.get(id) ||
        (pcode ? map.get(pcode) : null) ||
        (name ? map.get(name.toLowerCase().trim()) : null) ||
        (normName ? map.get(normName) : null);

      const simRecord = (pcode && activeSimulationMapRef.current[pcode])
        || (id && activeSimulationMapRef.current[id])
        || (props.GID_2 && activeSimulationMapRef.current[props.GID_2])
        || (props.psgc_code && activeSimulationMapRef.current[props.psgc_code])
        || (normName && activeSimulationMapRef.current[normName]);

      if (municipality) {
        updateLayerStyle(layer, municipality, id === selectedId || municipality.id === selectedId, isLightRef.current, nightGlowModeRef.current, simRecord);
        const radVal = municipality?.currentRadiance ? `${municipality.currentRadiance.toFixed(1)} nW` : `${(municipality.recoveryScore * 0.45).toFixed(1)} nW`;
        const tip = nightGlowModeRef.current
          ? `${municipality.name}${municipality.province ? ` (${municipality.province})` : ''} · ${municipality.recoveryScore}% recovery · ${radVal} radiance`
          : `${municipality.name}${municipality.province ? ` (${municipality.province})` : ''} · ${municipality.recoveryScore}% recovery`;
        layer.setTooltipContent(tip);
      }
    });

    nightLightOverlayRef.current?.redraw();
  }, [municipalities, selectedId]);

  // Instant direct municipality focus & concurrent background chunk loading
  useEffect(() => {
    if (!selectedId) {
      if (streakTimerRef.current) {
        clearTimeout(streakTimerRef.current);
        streakTimerRef.current = null;
      }
      if (activeStreakLayerRef.current && mapRef.current) {
        try {
          mapRef.current.removeLayer(activeStreakLayerRef.current);
        } catch {}
        activeStreakLayerRef.current = null;
      }
      Object.values(layersRef.current).forEach((l: any) => {
        if (l?._path) {
          try {
            l._path.classList.remove(
              'polygon-streak-gold',
              'polygon-highlight-gold-settled',
              'polygon-streak-active',
              'polygon-highlight-settled',
              'lgu-active-stroke'
            );
          } catch {}
        }
      });
      lastFocusedIdRef.current = null;
      return;
    }

    const map = mapRef.current;
    if (!map || !(map as any)._loaded) return;

    const lguLookup = findLguQuickLookup(selectedId);
    if (lguLookup) {
      if (lastFocusedIdRef.current !== selectedId) {
        lastFocusedIdRef.current = selectedId;
        // Do NOT call map.fitBounds() or map.setZoom() — preserve user's manual zoom level.
        // Optional gentle panTo only if the municipality center is not currently in view:
        try {
          const centerLat = lguLookup.center ? lguLookup.center[0] : (lguLookup.bbox[0][0] + lguLookup.bbox[1][0]) / 2;
          const centerLng = lguLookup.center ? lguLookup.center[1] : (lguLookup.bbox[0][1] + lguLookup.bbox[1][1]) / 2;
          const currentBounds = map.getBounds();
          if (currentBounds && typeof currentBounds.contains === 'function' && !currentBounds.contains([centerLat, centerLng])) {
            map.panTo([centerLat, centerLng], { animate: true });
          }
        } catch {}
      }

      const targetRegion = lguLookup.region_code;
      if (targetRegion && targetRegion !== activeChunkKeyRef.current) {
        fetchRegionChunk(targetRegion).then((chunkData) => {
          if (chunkData && selectedIdRef.current === selectedId) {
            activeChunkKeyRef.current = targetRegion;
            onRegionChange?.(targetRegion);
            renderRegionGeoJson(targetRegion, chunkData);
            attachNeonStreak(selectedId, chunkData);
          }
        });
      } else {
        attachNeonStreak(selectedId);
      }
    } else {
      attachNeonStreak(selectedId);
    }
  }, [selectedId, attachNeonStreak]);

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
        zIndexOffset: isActive ? 1500 : 1000,
        interactive: true,
        riseOnHover: true,
        bubblingMouseEvents: false,
        title: `${alert.name} (${alert.alert_level} Alert)`,
      });

      marker.bindTooltip(`${alert.name} (${alert.alert_level || 'Green'} Alert)`, {
        direction: 'top',
        offset: [0, -18],
      });

      marker.on('click', async (e: any) => {
        if (e) {
          try {
            L.DomEvent.stopPropagation(e);
          } catch {}
        }
        setSelectedGdacsAlert(alert);
        window.dispatchEvent(
          new CustomEvent('sanag:select-weather-location', {
            detail: {
              lat,
              lon: lng,
              regionName: alert.name || alert.country || 'Hazard Area',
              source: 'gdacs-marker',
            },
          })
        );
        const success = await loadRegionByCoordinates(lat, lng);
        if (!success) {
          drawEpicenterBuffer(lat, lng);
        } else {
          clearEpicenterBuffer();
        }
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
        interactive: false,
      });
      group.addLayer(circle);

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
        const targetLat = lat;
        const targetLng = lng;
        const currentEvt = activeEvent || matchingAlert;

        if (currentEvt) {
          runSimulationForCurrentRegion(currentEvt);
        }

        // Concurrently attempt regional chunk loading; fallback to epicenter buffer circle if no chunk covers it
        loadRegionByCoordinates(targetLat, targetLng).then((loaded) => {
          if (!loaded) {
            drawEpicenterBuffer(targetLat, targetLng);
          } else {
            clearEpicenterBuffer();
          }
          if (currentEvt) {
            runSimulationForCurrentRegion(currentEvt);
          }
          checkViewportFeatures();
        });

        const rawZoom = typeof map.getZoom === 'function' ? map.getZoom() : 8;
        const currentZoom = typeof rawZoom === 'number' && isFinite(rawZoom) ? rawZoom : 8;
        const targetZoom = Math.max(currentZoom, 8);

        map.flyTo([targetLat, targetLng], targetZoom, {
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
      className={`relative w-full ${isMaximized ? 'fullscreen-map-container h-full flex-1' : ''} overflow-hidden ${isMaximized ? 'rounded-none' : 'rounded-xl'}`}
      onMouseEnter={() => onMapHoverChange?.(true)}
      onMouseLeave={() => onMapHoverChange?.(false)}
    >
      {/* Static initial class; applyMapLock() mutates classList directly without re-rendering LeafletMap */}
      <div
        ref={mapElement}
        id="leaflet-map"
        className={`leaflet-map ${initialLocked ? 'is-locked' : 'is-unlocked'} ${isMaximized ? 'fullscreen-map-container is-fullscreen h-full w-full' : 'is-maximized-height'}`}
        aria-label="Panay Island municipality recovery map"
      />

      {/* Floating Active GDACS Alert Card Modal */}
      {selectedGdacsAlert && (
        <GDACSModal
          alert={selectedGdacsAlert}
          onClose={() => setSelectedGdacsAlert(null)}
          activeEventId={activeEventId}
          onSimulate={async (alert) => {
            const alertLat = alert.latitude ?? alert.coordinates?.[0];
            const alertLng = alert.longitude ?? alert.coordinates?.[1];

            // 1. Synchronously apply simulation styling to active layers immediately (0-delay 1-click response)
            activeEventRef.current = alert;
            runSimulationForCurrentRegion(alert);
            onSimulateGdacs?.(alert);

            // 2. Dispatch dynamic weather forecast strip update to target disaster epicenter
            if (alertLat != null && alertLng != null) {
              window.dispatchEvent(
                new CustomEvent('sanag:select-weather-location', {
                  detail: {
                    lat: alertLat,
                    lon: alertLng,
                    regionName: alert.name || alert.country || 'Hazard Area',
                    source: 'gdacs-simulation',
                  },
                })
              );
            }

            // 3. Coordinate mesh streaming for hazard region if coordinates are present
            if (alertLat != null && alertLng != null) {
              const success = await loadRegionByCoordinates(alertLat, alertLng);
              if (!success) {
                drawEpicenterBuffer(alertLat, alertLng);
              } else {
                clearEpicenterBuffer();
                // Ensure newly streamed chunk mesh also adopts simulation colors immediately
                runSimulationForCurrentRegion(alert);
              }
            }
          }}
        />
      )}

      {/* Overlay buttons live in their own component so their state changes
          never propagate back up into LeafletMap and never touch the tile layer. */}
      <MapLockOverlay
        initialLocked={isMapLocked}
        defaultRegionName={
          REGION_PRESETS[activeChunkKeyRef.current]?.name ||
          REGION_PRESETS[selectedRegionKey]?.name ||
          REGION_PRESETS[getActiveDefaultRegion()]?.name ||
          'Default Region'
        }
        onUnlock={() => applyMapLock(false)}
        onLock={() => applyMapLock(true)}
        onReset={handleReset}
        onRefreshMap={handleForceRefreshMap}
        isRefreshing={isRefreshingMap}
        nightGlowMode={nightGlowMode}
        onToggleNightGlow={onNightGlowModeChange ? () => onNightGlowModeChange(!nightGlowMode) : undefined}
        isMaximized={isMaximized}
        onToggleMaximize={onToggleMaximize}
        isHeaderCollapsed={isHeaderCollapsed}
        onToggleCollapseHeader={onToggleCollapseHeader}
        isLoading={Boolean(isLoading || isRefreshingMap)}
        loadingMessage={isRefreshingMap ? 'Refreshing basemap tiles...' : loadingMessage}
      />
    </div>
  );
}

// ─── MapLockOverlay ──────────────────────────────────────────────────────────
// Secondary map action cluster (Vector Map | Reset View | Refresh Map | Lock Map | Fullscreen | Collapse Header) positioned
// over the top-right of the map container with persistent visibility and active locking state.
interface MapLockOverlayProps {
  initialLocked?: boolean;
  defaultRegionName?: string;
  onUnlock: () => void;
  onLock: () => void;
  onReset: () => void;
  onRefreshMap?: () => void;
  isRefreshing?: boolean;
  nightGlowMode?: boolean;
  onToggleNightGlow?: () => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
  isHeaderCollapsed?: boolean;
  onToggleCollapseHeader?: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
}
function MapLockOverlay({
  initialLocked = false,
  defaultRegionName = 'Default Region',
  onUnlock,
  onLock,
  onReset,
  onRefreshMap,
  isRefreshing = false,
  nightGlowMode = true,
  onToggleNightGlow,
  isMaximized = false,
  onToggleMaximize,
  isHeaderCollapsed = false,
  onToggleCollapseHeader,
  isLoading = false,
  loadingMessage,
}: MapLockOverlayProps) {
  const [isMapLocked, setIsMapLocked] = useState<boolean>(initialLocked);

  useEffect(() => {
    setIsMapLocked(initialLocked);
  }, [initialLocked]);

  const handleToggleLock = () => {
    const nextLocked = !isMapLocked;
    setIsMapLocked(nextLocked);
    if (nextLocked) {
      onLock();
    } else {
      onUnlock();
    }
  };

  return (
    <div className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 sm:gap-2 pointer-events-auto max-w-[calc(100%-24px)] overflow-x-auto no-scrollbar">
      {/* Loading telemetry indicator neatly positioned to the left of action buttons with mr-2 shrink-0 */}
      {isLoading && (
        <span className="text-xs font-mono text-amber-400 flex items-center gap-1.5 bg-slate-950/80 px-2.5 py-1 rounded-md border border-slate-700 mr-2 shrink-0 animate-pulse pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <span className="hidden sm:inline">{loadingMessage || "Synchronizing satellite grid telemetry..."}</span>
          <span className="sm:hidden">Loading...</span>
        </span>
      )}

      {onToggleNightGlow && (
        <button
          type="button"
          id="night-glow-toggle-button"
          onClick={onToggleNightGlow}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-md shadow-sm transition-all text-xs font-semibold cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${nightGlowMode
            ? 'bg-amber-100 border border-amber-400 text-amber-950 hover:bg-amber-200/80 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/60 dark:hover:bg-amber-900/60'
            : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700'
            }`}
          aria-label={nightGlowMode ? 'Switch to Standard Vector Map' : 'Switch to NASA Black Marble Night Glow'}
          title="Toggle VIIRS Night Glow radiance layer"
        >
          <Sparkles className={`w-3.5 h-3.5 ${nightGlowMode ? 'text-amber-900 dark:text-amber-300 animate-pulse' : 'text-slate-300'}`} />
          <span className="hidden sm:inline">{nightGlowMode ? 'Night Glow' : 'Vector Map'}</span>
        </button>
      )}

      {/* Reset View Button */}
      <button
        type="button"
        id="map-reset-view-button"
        onClick={onReset}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg backdrop-blur-md transition-all text-xs font-medium cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
        aria-label={`Reset map view to ${defaultRegionName}`}
        title={`Re-center on ${defaultRegionName}`}
      >
        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
        <span className="hidden sm:inline">Reset View</span>
        <span className="sm:hidden">Reset</span>
      </button>

      {/* Force Refresh Map & Sync Tiles */}
      {onRefreshMap && (
        <button
          type="button"
          id="force-refresh-map-button"
          onClick={onRefreshMap}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-medium shadow-lg backdrop-blur-md transition-colors cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
          title="Force redraw map canvas & reload basemap tiles (Shortcut: R)"
          aria-label="Force redraw map canvas & reload basemap tiles"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-300 ${isRefreshing ? 'animate-spin text-ocean-400' : ''}`} />
          <span className="hidden sm:inline">Refresh Map</span>
          <span className="sm:hidden">Refresh</span>
        </button>
      )}

      {/* Lock Map Interactive Toggle */}
      <button
        type="button"
        id="lock-map-toggle"
        onClick={handleToggleLock}
        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-lg transition-all text-xs font-semibold cursor-pointer active:scale-95 border focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
          isMapLocked
            ? nightGlowMode
              ? 'bg-amber-950/40 text-amber-300 border-amber-600/60 shadow-amber-500/10 hover:bg-amber-900/50'
              : 'bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/40 shadow-sm hover:bg-amber-500/25'
            : 'bg-slate-800/70 border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700/80'
        }`}
        aria-label={isMapLocked ? 'Map locked: click to unlock pan and zoom' : 'Map unlocked: click to lock viewport'}
        title={isMapLocked ? 'Map locked (Click to unlock pan & zoom)' : 'Lock map viewport (Disable pan & zoom)'}
        aria-pressed={isMapLocked}
      >
        {isMapLocked ? (
          <>
            <Lock className={`w-3.5 h-3.5 ${nightGlowMode ? 'text-amber-400' : 'text-amber-800 dark:text-amber-400'}`} />
            <span className="hidden sm:inline">Locked</span>
          </>
        ) : (
          <>
            <Unlock className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">Lock Map</span>
          </>
        )}
      </button>

      {/* Maximize / Fullscreen Map Interactive Toggle */}
      {onToggleMaximize && (
        <button
          type="button"
          id="fullscreen-map-toggle"
          onClick={onToggleMaximize}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 shadow-lg backdrop-blur-md transition-all text-xs font-medium cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
          title="Toggle Fullscreen Map View"
          aria-label={isMaximized ? 'Exit Fullscreen Map View' : 'Toggle Fullscreen Map View'}
          aria-pressed={isMaximized}
        >
          {isMaximized ? (
            <>
              <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Minimize</span>
            </>
          ) : (
            <>
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Fullscreen</span>
            </>
          )}
        </button>
      )}

      {/* Collapsible Header Interactive Chevron Toggle */}
      {onToggleCollapseHeader && (
        <button
          type="button"
          id="map-header-collapse-toggle"
          onClick={onToggleCollapseHeader}
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all flex items-center justify-center shadow-lg backdrop-blur-md cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-ocean-500/50"
          title={isHeaderCollapsed ? "Expand Map Header" : "Collapse Map Header"}
          aria-label="Toggle map header visibility"
        >
          {isHeaderCollapsed ? (
            <ChevronDown className="w-4 h-4 text-amber-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-slate-300" />
          )}
        </button>
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
      className="absolute bottom-16 right-6 z-[1200] pointer-events-auto cursor-pointer"
      style={{
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
  nightGlow = false,
  simRecord?: SimulationRecord | null
) {
  if (layer && typeof layer.setStyle === 'function') {
    layer.setStyle(getPolygonStyle(municipality, selected, isLight, nightGlow, simRecord));
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