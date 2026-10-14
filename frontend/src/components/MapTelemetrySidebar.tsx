import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  MapPin,
  Volume2,
  X,
  AlertTriangle,
  Radio,
  Sparkles,
  Search,
  Zap,
  Wind,
  Droplets,
  Flame,
  Activity,
  Layers,
} from 'lucide-react';
import type { Municipality, DisasterEvent, GdacsAlert, RecoveryStatus } from '@/types';
import { getRecoveryColor, getRecoveryStatusColor, events as mockHistoricalEvents } from '@/data/mockData';
import { resolveRegionFromCoordinates, REGION_PRESETS, type RegionPreset } from '@/utils/regionLookup';
import type { EmergencyAudioStatus } from '@/utils/audioSpatialIndicator';

export interface UnifiedIncidentOption {
  id: string;
  name: string;
  date: string; // ISO string or display date (e.g., '2024-01-02')
  type: 'historical' | 'gdacs';
  severity?: string; // 'RED', 'ORANGE', 'GREEN', 'Critical', etc.
  category?: string; // 'Typhoon', 'Volcano', 'Earthquake', 'Grid', etc.
  coordinates: [number, number]; // [lat, lng]
  regionKey?: string;
  rawItem?: any;
}

export interface UnifiedIncidentSelectorProps {
  activeEvent?: DisasterEvent | null;
  activeEventId?: string | null;
  events?: DisasterEvent[];
  gdacsAlerts?: GdacsAlert[];
  currentRegionKey?: string;
  activeRegionName?: string;
  calibratedLgusCount?: number | string;
  onSelectIncident: (option: UnifiedIncidentOption) => void;
  className?: string;
}

const statusLabels: Record<RecoveryStatus, string> = {
  restored: 'Near-Full Recovery',
  recovering: 'Active Restoration',
  warning: 'Active Restoration',
  critical: 'Critical Deficit',
  unavailable: 'Telemetry Offline',
};

/**
 * Normalizes coordinates into a strict [lat, lng] tuple for the Philippines
 * Latitudes in PH are generally ~4° to ~22° N, Longitudes are ~116° to ~128° E
 */
export function normalizeCoordinates(coords?: any, lat?: number | null, lng?: number | null): [number, number] {
  if (lat != null && lng != null && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (nLat >= 100 && nLng < 50) return [nLng, nLat];
    return [nLat, nLng];
  }

  if (Array.isArray(coords) && coords.length >= 2) {
    const c0 = Number(coords[0]);
    const c1 = Number(coords[1]);
    if (!isNaN(c0) && !isNaN(c1)) {
      if (c0 >= 100 && c1 < 50) return [c1, c0];
      return [c0, c1];
    }
  }

  // Fallback center of Panay / Philippines
  return [11.2000, 122.5000];
}

/**
 * Formats ISO or raw string into clean readable date
 */
export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return 'Active Baseline';
  const clean = String(dateStr).trim();
  if (clean.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(clean)) {
    return clean.slice(0, 10);
  }
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return clean;
}

/**
 * Resolves badge style classes based on severity string
 */
export function getSeverityBadgeStyle(severity?: string) {
  const norm = (severity || '').toLowerCase();
  if (norm.includes('red') || norm.includes('severe') || norm.includes('critical')) {
    return {
      dot: 'bg-rose-500',
      badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/60',
      label: severity?.toUpperCase() || 'CRITICAL',
    };
  }
  if (norm.includes('orange') || norm.includes('amber') || norm.includes('high')) {
    return {
      dot: 'bg-amber-500',
      badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/60',
      label: severity?.toUpperCase() || 'HIGH',
    };
  }
  return {
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60',
    label: severity?.toUpperCase() || 'MODERATE',
  };
}

/**
 * Interactive, unified dropdown selector containing all historical incidents and GDACS alerts
 */
export function UnifiedIncidentSelector({
  activeEvent,
  activeEventId,
  events,
  gdacsAlerts = [],
  currentRegionKey = 'panay',
  activeRegionName = 'Panay Grid',
  calibratedLgusCount = 187,
  onSelectIncident,
  className = '',
}: UnifiedIncidentSelectorProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // 1. Consolidate Incident & Alert Data Sources
  const unifiedIncidents = useMemo(() => {
    const historicalSource = (events && events.length > 0) ? events : mockHistoricalEvents;

    const historical: UnifiedIncidentOption[] = historicalSource.map((e) => {
      const coords = normalizeCoordinates(e.coordinates, e.latitude, e.longitude);
      const regKey = e.regionKey || resolveRegionFromCoordinates(coords[0], coords[1]);
      return {
        id: String(e.id || e.name),
        name: e.name,
        date: e.date || e.startDate || '2024-01-01',
        type: 'historical',
        severity: e.severity || 'High',
        category: e.category || e.disaster_category || e.event_type || 'Historical Case',
        coordinates: coords,
        regionKey: regKey,
        rawItem: e,
      };
    });

    const gdacs: UnifiedIncidentOption[] = (gdacsAlerts || []).map((a) => {
      const coords = normalizeCoordinates(
        a.coordinates || a.geometry?.coordinates,
        a.latitude,
        a.longitude
      );
      const regKey = a.regionKey || resolveRegionFromCoordinates(coords[0], coords[1]);
      return {
        id: String(a.id || (a.event_id ? `gdacs-${a.event_id}` : a.name)),
        name: a.name || (a as any).eventname || a.title || 'GDACS Hazard Alert',
        date: a.date || a.fromdate || new Date().toISOString().slice(0, 10),
        type: 'gdacs',
        severity: a.alert_level || (a as any).alertLevel || a.severity || 'ORANGE',
        category: (a as any).hazardType || a.category || a.type || 'GDACS Alert',
        coordinates: coords,
        regionKey: regKey,
        rawItem: a,
      };
    });

    // Deduplicate any overlapping alert IDs
    const seenIds = new Set<string>();
    const combined: UnifiedIncidentOption[] = [];
    for (const item of [...gdacs, ...historical]) {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        combined.push(item);
      }
    }

    // Sort descending by date (newest first)
    return combined.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });
  }, [events, gdacsAlerts]);

  // Determine currently selected incident option
  const activeOption = useMemo(() => {
    if (!unifiedIncidents.length) return null;
    if (activeEventId) {
      const match = unifiedIncidents.find(
        (u) =>
          u.id === String(activeEventId) ||
          u.id === `gdacs-${activeEventId}` ||
          (u.rawItem?.event_id && String(u.rawItem.event_id) === String(activeEventId))
      );
      if (match) return match;
    }
    if (activeEvent) {
      const match = unifiedIncidents.find(
        (u) =>
          u.id === String(activeEvent.id) ||
          u.name.toLowerCase().trim() === (activeEvent.name || '').toLowerCase().trim()
      );
      if (match) return match;
    }
    return unifiedIncidents[0] || null;
  }, [unifiedIncidents, activeEventId, activeEvent]);

  // Filtered lists for search
  const filteredIncidents = useMemo(() => {
    if (!searchFilter.trim()) return unifiedIncidents;
    const term = searchFilter.toLowerCase().trim();
    return unifiedIncidents.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        (u.category && u.category.toLowerCase().includes(term)) ||
        (u.severity && u.severity.toLowerCase().includes(term)) ||
        (u.date && u.date.toLowerCase().includes(term))
    );
  }, [unifiedIncidents, searchFilter]);

  const gdacsOptions = useMemo(
    () => filteredIncidents.filter((u) => u.type === 'gdacs'),
    [filteredIncidents]
  );
  const historicalOptions = useMemo(
    () => filteredIncidents.filter((u) => u.type === 'historical'),
    [filteredIncidents]
  );

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const chosen = unifiedIncidents.find((u) => u.id === val);
    if (chosen) {
      onSelectIncident(chosen);
    }
  };

  const severityStyle = getSeverityBadgeStyle(activeOption?.severity);

  return (
    <div
      className={`rounded-xl p-3.5 mb-4 border transition-all bg-slate-50 border-slate-200 shadow-sm dark:bg-slate-900/90 dark:border-slate-800/80 dark:shadow-none text-left ${className}`}
    >
      {/* Step Header & Filter Toggle */}
      <div className="flex items-center justify-between text-[11px] mb-2 font-mono">
        <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
          <span>Selected Incident (Step 1)</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsSearching((prev) => !prev)}
            className={`p-1 rounded text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors ${
              isSearching ? 'bg-slate-200/70 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400' : ''
            }`}
            title="Filter incidents"
            aria-label="Filter incidents"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-600 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-300/60 dark:border-slate-700/80 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            <span>{formatDisplayDate(activeOption?.date)}</span>
          </span>
        </div>
      </div>

      {/* Inline Search Bar (if toggled) */}
      {isSearching && (
        <div className="mb-2 relative">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search incident name, category, or date..."
            className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Interactive Unified Dropdown Selector */}
      <div className="relative mb-2.5">
        <select
          id="sanag-incident-unified-selector"
          value={activeOption?.id || ''}
          onChange={handleSelectChange}
          aria-label="Select disaster incident or GDACS hazard alert"
          className="w-full appearance-none bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700/90 text-slate-900 dark:text-slate-100 font-bold text-xs sm:text-sm py-2 pl-3 pr-8 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all cursor-pointer truncate"
        >
          {gdacsOptions.length > 0 && (
            <optgroup label="⚡ GDACS Alerts (Active / Recent)" className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900">
              {gdacsOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="py-1">
                  ⚡ {opt.name} ({formatDisplayDate(opt.date)}) [{opt.severity || 'ORANGE'}]
                </option>
              ))}
            </optgroup>
          )}

          {historicalOptions.length > 0 && (
            <optgroup label="📜 Historical Benchmarks & Case Studies" className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-900">
              {historicalOptions.map((opt) => (
                <option key={opt.id} value={opt.id} className="py-1">
                  📜 {opt.name} ({formatDisplayDate(opt.date)}) [{opt.severity || 'Benchmark'}]
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500 dark:text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>

      {/* Metadata Badges Alongside / Below the Selector */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
        {/* Severity Badge */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${severityStyle.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${severityStyle.dot}`} />
          <span>{severityStyle.label}</span>
        </span>

        {/* Hazard Category / Type Pill */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/60">
          {activeOption?.type === 'gdacs' ? (
            <>
              <Radio className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
              <span>Live Hazard</span>
            </>
          ) : (
            <>
              <Sparkles className="w-2.5 h-2.5 text-ocean-500" />
              <span>{activeOption?.category || 'Historical Benchmark'}</span>
            </>
          )}
        </span>

        {/* Date Pill */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <span>{formatDisplayDate(activeOption?.date)}</span>
        </span>
      </div>

      {/* Subtext Footnote / Calibration State */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/70 text-[11px]">
        <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Active Baseline Simulation</span>
        </span>
        <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px]">
          {calibratedLgusCount} LGUs calibrated · {activeRegionName}
        </span>
      </div>
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

export interface MapTelemetrySidebarProps {
  selected?: Municipality | null;
  selectedId: string | null;
  globalRank?: number | null;
  resilienceRankMap: Map<string, number>;
  onSelect: (id: string) => void;
  activeEvent?: DisasterEvent | null;
  activeEventId?: string | null;
  events?: DisasterEvent[];
  gdacsAlerts?: GdacsAlert[];
  onSelectEvent?: (eventId: string) => void;
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  currentRegionKey: string;
  activePreset: RegionPreset;
  onRegionChange?: (regionKey: string) => void;
  onFlyTo?: (coords: [number, number], zoom?: number) => void;
  allMunicipalities: Municipality[];
  activeRegionMunicipalities: Municipality[];
  isAudioEnabled?: boolean;
  isMapAudioPlaying?: boolean;
  liveAudioStatus?: EmergencyAudioStatus;
  audioStatusLabel?: string;
}

export default function MapTelemetrySidebar({
  selected,
  selectedId,
  globalRank,
  resilienceRankMap,
  onSelect,
  activeEvent,
  activeEventId,
  events,
  gdacsAlerts = [],
  onSelectEvent,
  onSimulateGdacs,
  currentRegionKey,
  activePreset,
  onRegionChange,
  onFlyTo,
  allMunicipalities,
  activeRegionMunicipalities,
  isAudioEnabled = false,
  isMapAudioPlaying = false,
  liveAudioStatus = 'restored',
  audioStatusLabel = 'Stable',
}: MapTelemetrySidebarProps) {
  const activeRegionName = currentRegionKey === 'panay' ? 'Panay Grid' : (activePreset?.name || currentRegionKey);
  const calibratedLgusCount = (activeEvent as any)?.affectedLgusCount || allMunicipalities.length || '187';

  // 3. Wire Selection to Global State & Spatial Scoping
  const handleSelectIncident = (chosen: UnifiedIncidentOption) => {
    // 1. Update active event in global state
    if (chosen.type === 'gdacs') {
      const rawAlert = chosen.rawItem || gdacsAlerts.find(
        (a) => String(a.id) === chosen.id || String(a.event_id) === chosen.id || a.name === chosen.name
      );
      if (rawAlert) {
        onSimulateGdacs?.(rawAlert);
      }
    } else {
      onSelectEvent?.(chosen.id);
    }

    // 2. Resolve target region & trigger regional polygon chunk loading
    const targetRegion = chosen.regionKey || resolveRegionFromCoordinates(chosen.coordinates[0], chosen.coordinates[1]);
    if (targetRegion && targetRegion !== currentRegionKey) {
      onRegionChange?.(targetRegion);
    }

    // 3. Pan / Fly Leaflet camera to incident coordinates
    onFlyTo?.(chosen.coordinates, chosen.type === 'gdacs' ? 8 : 9);

    // 4. Dispatch weather forecast location sync
    window.dispatchEvent(
      new CustomEvent('sanag:select-weather-location', {
        detail: {
          lat: chosen.coordinates[0],
          lon: chosen.coordinates[1],
          regionName: chosen.name,
          source: 'unified-incident-selector',
        },
      })
    );

    // 5. Clear municipality pin so camera and sidebar view focus cleanly on the disaster footprint
    onSelect('');
  };

  return (
    <div className="lg:col-span-4 flex flex-col w-full max-w-full min-w-0">
      {selected ? (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 backdrop-blur-sm p-5 animate-slide-in flex flex-col justify-between h-full shadow-lg dark:shadow-xl transition-colors">
          <div>
            {/* Interactive Unified Dropdown Selector (Step 1) */}
            <UnifiedIncidentSelector
              activeEvent={activeEvent}
              activeEventId={activeEventId}
              events={events}
              gdacsAlerts={gdacsAlerts}
              currentRegionKey={currentRegionKey}
              activeRegionName={activeRegionName}
              calibratedLgusCount={calibratedLgusCount}
              onSelectIncident={handleSelectIncident}
            />

            {/* Municipality Header */}
            <div className="flex items-start justify-between pb-3 mb-4 border-b border-slate-200 dark:border-white/10">
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400" />
                  <span className="text-xs font-semibold text-slate-500 dark:text-ink-400 uppercase tracking-wider">
                    {selected.province} Province
                  </span>
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
                  <Volume2
                    className={`h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 ${
                      isMapAudioPlaying ? 'animate-pulse' : 'opacity-60'
                    }`}
                  />
                  <span>Spatial Audio Profile</span>
                </span>
                <span
                  className={`font-semibold text-[11px] px-2 py-0.5 rounded ${
                    liveAudioStatus === 'critical'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      : liveAudioStatus === 'warning'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                      : liveAudioStatus === 'recovering'
                      ? 'bg-ocean-100 text-ocean-700 dark:bg-ocean-500/20 dark:text-ocean-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                  }`}
                >
                  {isMapAudioPlaying ? audioStatusLabel : `${audioStatusLabel} (Hover Map)`}
                </span>
              </div>
            )}

            {/* Recovery gauge */}
            <div className="mb-5 bg-slate-50 dark:bg-ink-950/50 rounded-xl p-3.5 border border-slate-200 dark:border-white/5 transition-colors">
              <div className="flex items-end justify-between mb-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-ink-400 uppercase tracking-wider">
                  Recovery Indicator
                </span>
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
                    {statusLabels[selected.status] || selected.status}
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
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-ink-300">
                Municipality Telemetry
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-ocean-50 text-ocean-700 border border-ocean-200 dark:bg-ocean-500/10 dark:text-ocean-300 dark:border-ocean-500/20 font-medium">
                {activeRegionName}
              </span>
            </div>

            {/* Interactive Unified Dropdown Selector (Step 1) */}
            <UnifiedIncidentSelector
              activeEvent={activeEvent}
              activeEventId={activeEventId}
              events={events}
              gdacsAlerts={gdacsAlerts}
              currentRegionKey={currentRegionKey}
              activeRegionName={activeRegionName}
              calibratedLgusCount={calibratedLgusCount}
              onSelectIncident={handleSelectIncident}
              className="my-3"
            />

            <div className="flex flex-col items-center justify-center text-center py-6">
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
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/10 text-[11px] text-slate-500 dark:text-ink-400 text-center">
            {currentRegionKey === 'panay'
              ? 'Covers 95 fine-grained LGUs in Iloilo, Capiz, Aklan, and Antique'
              : `Covers fine-grained municipalities in ${activeRegionName}`}
          </div>
        </div>
      )}
    </div>
  );
}
