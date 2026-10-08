import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Camera,
  CheckCircle2,
  CloudLightning,
  Droplets,
  ExternalLink,
  Flame,
  LayoutGrid,
  List,
  Loader2,
  RefreshCw,
  Radio,
  Satellite,
  Search,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import type { DisasterEvent, GdacsAlert } from '@/types';
import { apiFetch } from '@/services/apiService';
import { getSeverityColor } from '@/data/mockData';
import MediaGalleryModal from './MediaGalleryModal';
import ErrorBoundary from './ErrorBoundary';
import {
  isEventCompatibleWithRegion,
  getRegionDisplayName,
  isPanayRegion,
  isNationwideRegion,
} from '@/utils/eventScope';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'historical' | 'gdacs';
export type ViewMode = 'grid' | 'list';

export interface MediaEventData {
  name: string;
  date?: string;
  type?: string;
  severity?: string;
}

interface EventSelectorPanelProps {
  /** Curated historical events from the database */
  events: DisasterEvent[];
  activeEvent?: DisasterEvent | null;
  onSelectEvent: (id: string) => void;
  onDismissEvent?: () => void;
  /** Called when user clicks a new GDACS alert card to simulate/import & activate it */
  onSimulateGdacs?: (alert: GdacsAlert, temporaryEvent?: DisasterEvent) => void | Promise<void>;
  importingGdacsId?: string | null;
  /** Set of event IDs that already exist in the events[] array (already imported) */
  importedEventIds?: Set<string>;
  /** Currently active geographic region key (e.g., 'panay', 'r4a', 'ncr', 'philippines') */
  selectedRegionKey?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getHistoricalIcon(event: DisasterEvent) {
  const type = event.type?.toLowerCase() ?? '';
  const name = event.name?.toLowerCase() ?? '';
  const cat  = event.category?.toLowerCase() ?? '';
  if (type.includes('flood')     || name.includes('flood')      || cat.includes('flood'))
    return <Droplets className="h-4 w-4 text-ocean-400 shrink-0" />;
  if (type.includes('typhoon')   || name.includes('typhoon')    || cat.includes('cyclone') || cat.includes('typhoon'))
    return <Wind     className="h-4 w-4 text-amber-400  shrink-0" />;
  if (type.includes('earthquake')|| name.includes('earthquake') || cat.includes('earthquake'))
    return <Activity className="h-4 w-4 text-emerald-400 shrink-0" />;
  return   <Zap     className="h-4 w-4 text-rose-400   shrink-0" />;
}

function getGdacsIcon(type: string, name: string) {
  const t = (type ?? '').toUpperCase();
  const n = (name ?? '').toLowerCase();
  if (t === 'TC' || n.includes('typhoon') || n.includes('cyclone') || n.includes('storm'))
    return <Wind           className="h-4 w-4 text-amber-400  shrink-0" />;
  if (t === 'EQ' || n.includes('earthquake'))
    return <Activity       className="h-4 w-4 text-rose-400   shrink-0" />;
  if (t === 'FL' || n.includes('flood') || n.includes('rain'))
    return <Droplets       className="h-4 w-4 text-ocean-400  shrink-0" />;
  if (t === 'VO' || n.includes('volcano'))
    return <Flame          className="h-4 w-4 text-orange-400 shrink-0" />;
  if (t === 'TS' || n.includes('tsunami'))
    return <CloudLightning className="h-4 w-4 text-purple-400 shrink-0" />;
  return   <Zap           className="h-4 w-4 text-emerald-400 shrink-0" />;
}

function gdacsLevelClasses(level: string) {
  const l = (level ?? '').toLowerCase();
  if (l === 'red')    return 'text-rose-300    bg-rose-500/15    border-rose-500/35';
  if (l === 'orange') return 'text-amber-300   bg-amber-500/15   border-amber-500/35';
  return                     'text-emerald-300 bg-emerald-500/15 border-emerald-500/35';
}

function gdacsLevelDot(level: string) {
  const l = (level ?? '').toLowerCase();
  if (l === 'red')    return 'bg-rose-500';
  if (l === 'orange') return 'bg-amber-500';
  return                     'bg-emerald-500';
}

function formatGdacsDate(dateStr?: unknown) {
  if (!dateStr || typeof dateStr !== 'string') return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return String(dateStr).slice(0, 10);
  }
}

export function formatEventDate(dateStr?: unknown) {
  if (!dateStr || typeof dateStr !== 'string') return '—';
  try {
    const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00Z` : dateStr);
    if (isNaN(d.getTime())) return String(dateStr).slice(0, 10);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return String(dateStr).slice(0, 10);
  }
}

export function getEventTypeBadge(type?: string) {
  const t = (type ?? '').toLowerCase();
  if (t === 'typhoon') {
    return {
      label: 'Typhoon',
      className: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/25',
    };
  }
  if (t === 'monsoon_flood' || t === 'flood') {
    return {
      label: t === 'monsoon_flood' ? 'Monsoon Flood' : 'Flood',
      className: 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/25',
    };
  }
  if (t === 'earthquake') {
    return {
      label: 'Earthquake',
      className: 'text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-300 dark:bg-rose-500/10 dark:border-rose-500/25',
    };
  }
  if (t === 'grid_failure' || t === 'blackout') {
    return {
      label: t === 'grid_failure' ? 'Grid Failure' : 'Blackout',
      className: 'text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-500/10 dark:border-purple-500/25',
    };
  }
  return {
    label: type ? type.charAt(0).toUpperCase() + type.slice(1) : 'Hazard',
    className: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/25',
  };
}

/**
 * Constructs a temporary DisasterEvent object matching the historical event catalog structure
 * from live GDACS hazard telemetry (title, coordinates, severity, event type, and date).
 */
export function createTemporaryEventFromGdacs(alert: GdacsAlert): DisasterEvent {
  const rawAlertId = alert.event_id != null ? String(alert.event_id) : '';
  const id = alert.id ? String(alert.id) : (rawAlertId ? `gdacs-${rawAlertId}` : `gdacs-sim-${Date.now()}`);
  const title = alert.name || alert.description?.slice(0, 30) || 'Live GDACS Hazard Event';

  // 1. Coordinates extraction (ensuring valid [lat, lng])
  let lat: number | null = alert.latitude != null ? Number(alert.latitude) : null;
  let lng: number | null = alert.longitude != null ? Number(alert.longitude) : null;
  if ((lat == null || lng == null) && Array.isArray(alert.coordinates) && alert.coordinates.length >= 2) {
    const [c0, c1] = alert.coordinates;
    if (c0 >= 100 && c1 < 50) {
      lng = Number(c0);
      lat = Number(c1);
    } else {
      lat = Number(c0);
      lng = Number(c1);
    }
  }

  // 2. Severity mapping ('Severe' | 'High' | 'Moderate')
  const rawSev = (alert.severity_text || alert.alert_level || '').toLowerCase();
  let severity: 'Severe' | 'High' | 'Moderate' = 'Moderate';
  if (rawSev.includes('red') || rawSev.includes('severe') || rawSev.includes('catastrophic') || rawSev.includes('major')) {
    severity = 'Severe';
  } else if (rawSev.includes('orange') || rawSev.includes('high')) {
    severity = 'High';
  } else {
    severity = 'Moderate';
  }

  // 3. Event type mapping
  const rawType = (alert.type || alert.category || title).toLowerCase();
  let disasterType: DisasterEvent['type'] = 'disaster';
  if (rawType.includes('tc') || rawType.includes('typhoon') || rawType.includes('cyclone') || rawType.includes('storm')) {
    disasterType = 'typhoon';
  } else if (rawType.includes('eq') || rawType.includes('earthquake') || rawType.includes('quake') || rawType.includes('seismic')) {
    disasterType = 'earthquake';
  } else if (rawType.includes('fl') || rawType.includes('flood') || rawType.includes('rain') || rawType.includes('monsoon')) {
    disasterType = 'flood';
  } else if (rawType.includes('blackout') || rawType.includes('grid') || rawType.includes('power')) {
    disasterType = 'blackout';
  } else {
    disasterType = 'disaster';
  }

  // 4. Date parsing & 31-day event duration window matching historical catalog
  const rawDate = alert.date || alert.fromdate || new Date().toISOString().slice(0, 10);
  const date = rawDate.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(rawDate)
    ? rawDate.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const sDate = new Date(`${date}T00:00:00Z`);
  const eDate = new Date(sDate.getTime() + 31 * 86400000);
  const endDate = isNaN(eDate.getTime()) ? date : eDate.toISOString().slice(0, 10);

  const affectedPopulation = alert.alert_score
    ? Math.round(Number(alert.alert_score) * 200000)
    : severity === 'Severe' ? 750000 : severity === 'High' ? 320000 : 95000;

  return {
    id,
    name: title,
    date,
    endDate,
    severity,
    type: disasterType,
    affectedPopulation,
    description: alert.description || `${title} — Real-time GDACS hazard monitoring alert detected in the Philippines.`,
    category: alert.category || (alert.type ? String(alert.type) : 'Hazard'),
    alert_level: alert.alert_level || (severity === 'Severe' ? 'Red' : severity === 'High' ? 'Orange' : 'Green'),
    viirs_data_available: true,
    critical_municipalities: [],
    latitude: lat,
    longitude: lng,
    coordinates: (lat != null && lng != null) ? [lat, lng] : null,
    is_live_simulated: true,
  };
}

// ─── EventSelectorPanel (main export) ────────────────────────────────────────

export default function EventSelectorPanel({
  events,
  activeEvent,
  onSelectEvent,
  onDismissEvent,
  onSimulateGdacs,
  importingGdacsId = null,
  importedEventIds = new Set(),
  selectedRegionKey,
}: EventSelectorPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('historical');
  const [mediaModalEvent, setMediaModalEvent] = useState<MediaEventData | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sanag_event_view_mode');
        if (saved === 'grid' || saved === 'list') return saved;
      } catch {
        // ignore localStorage access error
      }
    }
    return 'grid';
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sanag_event_view_mode', mode);
      } catch {
        // ignore localStorage access error
      }
    }
  };

  return (
    <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>

      {/* ── Panel Header with Title, Responsive View Toggle & Source Tabs ─────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-ink-300">
            Disaster Event Monitoring
          </span>
          {activeTab === 'historical' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 border border-slate-300 dark:bg-white/5 dark:text-ink-400 dark:border-white/10">
              {events.length} Incidents Tracked
            </span>
          )}

          {/* Desktop View Mode Toggle (Grid vs. List) — HIDDEN on mobile (< md / 768px) */}
          <div
            role="group"
            aria-label="Event layout view mode"
            className="hidden md:flex items-center p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-900 border border-slate-300 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              title="Grid view (multi-column cards)"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              className={`flex items-center justify-center p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('list')}
              title="List view (single-column compact rows)"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
              className={`flex items-center justify-center p-1.5 rounded-md transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Pill toggle */}
        <div
          role="tablist"
          aria-label="Event source"
          className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-ink-900/70 border border-slate-200 dark:border-white/10 self-start sm:self-auto shrink-0"
        >
          <TabButton
            id="tab-historical"
            panelId="panel-historical"
            active={activeTab === 'historical'}
            onClick={() => setActiveTab('historical')}
            icon={<Satellite className="h-3.5 w-3.5 shrink-0" />}
            label="Historical Case Studies"
            badge={String(events.length)}
          />
          <TabButton
            id="tab-gdacs"
            panelId="panel-gdacs"
            active={activeTab === 'gdacs'}
            onClick={() => setActiveTab('gdacs')}
            icon={<Radio className="h-3.5 w-3.5 shrink-0" />}
            label="Live GDACS Hazards"
            liveIndicator
          />
        </div>
      </div>

      {/* ── Tab Panels ───────────────────────────────────────────────────── */}
      <div
        id="panel-historical"
        role="tabpanel"
        aria-labelledby="tab-historical"
        hidden={activeTab !== 'historical'}
      >
        <ErrorBoundary name="Historical Event Monitoring" resetKey={activeEvent?.id}>
          <HistoricalPanel
            events={events}
            activeEvent={activeEvent}
            onSelectEvent={onSelectEvent}
            onDismissEvent={onDismissEvent}
            onOpenMedia={setMediaModalEvent}
            selectedRegionKey={selectedRegionKey}
            viewMode={viewMode}
          />
        </ErrorBoundary>
      </div>

      <div
        id="panel-gdacs"
        role="tabpanel"
        aria-labelledby="tab-gdacs"
        hidden={activeTab !== 'gdacs'}
      >
        <ErrorBoundary name="Live GDACS Hazards Panel" resetKey={activeEvent?.id}>
          <GdacsPanel
            events={events}
            activeEvent={activeEvent}
            onSelectEvent={onSelectEvent}
            onSimulateGdacs={onSimulateGdacs}
            onOpenMedia={setMediaModalEvent}
            importingGdacsId={importingGdacsId}
            importedEventIds={importedEventIds}
            viewMode={viewMode}
          />
        </ErrorBoundary>
      </div>

      {/* In-App Media Gallery & Ground Footage Modal */}
      <MediaGalleryModal
        isOpen={mediaModalEvent !== null}
        onClose={() => setMediaModalEvent(null)}
        eventName={mediaModalEvent?.name || ''}
        eventDate={mediaModalEvent?.date}
        eventType={mediaModalEvent?.type}
        eventSeverity={mediaModalEvent?.severity}
      />
    </div>
  );
}

// ─── TabButton ────────────────────────────────────────────────────────────────

function TabButton({
  id,
  panelId,
  active,
  onClick,
  icon,
  label,
  badge,
  liveIndicator = false,
}: {
  id: string;
  panelId: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  liveIndicator?: boolean;
}) {
  return (
    <button
      id={id}
      role="tab"
      aria-selected={active}
      aria-controls={panelId}
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500/50 ${
        active
          ? 'bg-white dark:bg-ink-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/15'
          : 'text-slate-500 dark:text-ink-400 hover:text-slate-700 dark:hover:text-ink-200'
      }`}
    >
      <span className={active ? 'text-ocean-500 dark:text-ocean-300' : ''}>{icon}</span>
      {/* Full label on ≥sm, first word only on mobile */}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>

      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold ml-0.5 ${
          active
            ? 'bg-ocean-50 text-ocean-700 border-ocean-200 dark:bg-ocean-500/15 dark:text-ocean-300 dark:border-ocean-500/30'
            : 'bg-slate-200/60 text-slate-500 border-slate-300 dark:bg-white/5 dark:text-ink-500 dark:border-white/10'
        }`}>
          {badge}
        </span>
      )}

      {liveIndicator && (
        <span className="relative flex h-1.5 w-1.5 ml-0.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
        </span>
      )}
    </button>
  );
}

// ─── HistoricalPanel ──────────────────────────────────────────────────────────

function HistoricalPanel({
  events,
  activeEvent,
  onSelectEvent,
  onDismissEvent,
  onOpenMedia,
  selectedRegionKey,
  viewMode = 'grid',
}: {
  events: DisasterEvent[];
  activeEvent?: DisasterEvent | null;
  onSelectEvent: (id: string) => void;
  onDismissEvent?: () => void;
  onOpenMedia: (data: MediaEventData) => void;
  selectedRegionKey?: string;
  viewMode?: ViewMode;
}) {
  // Strictly sort historical presets in reverse chronological order (newest / most recent first)
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || 0).getTime() || 0;
      const dateB = new Date(b.startDate || b.date || 0).getTime() || 0;
      return dateB - dateA; // Descending (latest first)
    });
  }, [events]);

  const [searchQuery, setSearchQuery] = useState('');

  // Filter events based on search query (name, type, date, description, severity, category)
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedEvents;

    return sortedEvents.filter((evt) => {
      const name = (evt.name || '').toLowerCase();
      const type = (evt.type || '').toLowerCase();
      const desc = (evt.description || '').toLowerCase();
      const severity = (evt.severity || '').toLowerCase();
      const category = (evt.category || '').toLowerCase();
      const rawDate = String(evt.startDate || evt.date || evt.endDate || '').toLowerCase();
      const formattedDate = formatEventDate(evt.startDate || evt.date).toLowerCase();

      return (
        name.includes(q) ||
        type.includes(q) ||
        desc.includes(q) ||
        severity.includes(q) ||
        category.includes(q) ||
        rawDate.includes(q) ||
        formattedDate.includes(q)
      );
    });
  }, [sortedEvents, searchQuery]);

  const isPanayOrNationwide = isPanayRegion(selectedRegionKey) || isNationwideRegion(selectedRegionKey);
  const regionName = getRegionDisplayName(selectedRegionKey);
  const incompatibleEvents = filteredEvents.filter((e) => !isEventCompatibleWithRegion(e, selectedRegionKey));
  const hasIncompatible = !isPanayOrNationwide && incompatibleEvents.length > 0;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2.5">
        <p className="text-[11px] text-slate-500 dark:text-ink-400">
          Select a curated incident to recompute spatial radiance &amp; recovery curves from NASA VIIRS satellite data.
        </p>

        {/* Region context badge */}
        {!isPanayOrNationwide && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ocean-700 dark:text-ocean-300 bg-ocean-500/10 border border-ocean-500/25 px-2.5 py-0.5 rounded-full self-start sm:self-auto shrink-0">
            <span>Scope: {regionName}</span>
          </span>
        )}
      </div>

      {/* Event Selector Dropdown Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 p-3 rounded-xl bg-slate-100/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
        {/* Primary Control Cluster: Event Dropdown & Search Input */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Event Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="historical-event-select" className="text-xs font-semibold text-slate-700 dark:text-ink-200 shrink-0">
              Event Dropdown:
            </label>
            <div className="relative min-w-[200px] sm:min-w-[230px]">
              <select
                id="historical-event-select"
                value={filteredEvents.some((evt) => evt.id === activeEvent?.id) ? activeEvent?.id || '' : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const chosen = filteredEvents.find((evt) => evt.id === val) || sortedEvents.find((evt) => evt.id === val);
                  if (chosen && !isEventCompatibleWithRegion(chosen, selectedRegionKey)) return;
                  onSelectEvent(val);
                }}
                className="w-full text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-2.5 pr-8 text-slate-800 dark:text-white shadow-sm focus:border-emerald-500 focus:outline-none cursor-pointer"
              >
                {!filteredEvents.some((evt) => evt.id === activeEvent?.id) && (
                  <option value="" disabled>
                    {filteredEvents.length === 0 ? 'No matching events' : 'Choose an event...'}
                  </option>
                )}
                {filteredEvents.map((evt) => {
                  const isCompatible = isEventCompatibleWithRegion(evt, selectedRegionKey);
                  return (
                    <option
                      key={evt.id}
                      value={evt.id}
                      disabled={!isCompatible}
                      className={!isCompatible ? 'text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-slate-950 font-normal' : 'text-slate-900 dark:text-white font-medium'}
                    >
                      {evt.name} {!isCompatible ? `(Incompatible with ${regionName})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Search Input Field with distinct flexible sizing */}
          <div className="relative flex-1 min-w-[200px] max-w-xs sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              id="historical-event-search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by name, type, or date..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-8 pr-7 text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                title="Clear search filter"
                aria-label="Clear search filter"
                className="absolute right-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Informational Warning Banner: neatly stacked or side-by-side without overlap */}
        {hasIncompatible && (
          <div className="flex items-center gap-2 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-lg w-full md:w-auto md:max-w-md xl:max-w-lg shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="leading-snug">
              <strong>{regionName} active:</strong> {incompatibleEvents.length} Panay-exclusive incident{incompatibleEvents.length > 1 ? 's' : ''} disabled to prevent geographic mismatch.
            </span>
          </div>
        )}
      </div>

      {/* Responsive View Mode: Empty State vs Grid vs List */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-center">
          <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
            <Search className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No events match &ldquo;{searchQuery}&rdquo;
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
            Try adjusting your search query, or search by disaster type (e.g., typhoon, earthquake) or date.
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-3.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
          >
            Clear Search Filter
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEvents.map((event) => {
            const isSelected    = !!activeEvent && String(event.id) === String(activeEvent.id);
            const isCompatible  = isEventCompatibleWithRegion(event, selectedRegionKey);
            const severityColor = getSeverityColor(event.severity);
            const typeBadge     = getEventTypeBadge(event.type);
            const formattedDate = formatEventDate(event.startDate || event.date);

            return (
              <div key={event.id} className="relative">
                <div
                  role="button"
                  tabIndex={isCompatible ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isCompatible) onSelectEvent(event.id);
                  }}
                  onKeyDown={(e) => {
                    if (isCompatible && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectEvent(event.id);
                    }
                  }}
                  aria-disabled={!isCompatible}
                  aria-pressed={isSelected}
                  title={
                    !isCompatible
                      ? `"${event.name}" is a Panay-exclusive disaster event and is disabled for ${regionName} to prevent geographic mismatches.`
                      : undefined
                  }
                  className={`group relative text-left w-full p-3.5 rounded-xl border transition-all flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    !isCompatible
                      ? 'opacity-50 grayscale-[40%] bg-slate-100/70 dark:bg-slate-950/70 border-dashed border-slate-300 dark:border-slate-800 cursor-not-allowed'
                      : isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-md ring-1 ring-emerald-500/50 dark:border-emerald-500 dark:bg-gradient-to-br dark:from-emerald-950/30 dark:via-slate-900/90 dark:to-slate-900 dark:shadow-[0_0_20px_rgba(16,185,129,0.18)] dark:ring-emerald-400/50 cursor-pointer'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-500/50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/90 dark:hover:border-emerald-500/40 shadow-sm dark:shadow-none cursor-pointer'
                  }`}
                >
                  {!isCompatible && (
                    <div className="mb-2 py-0.5 px-2 rounded bg-rose-500/10 border border-rose-500/25 text-[10px] font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      <span>Panay Exclusive · Disabled for {regionName}</span>
                    </div>
                  )}

                  {/* Header: Icon, Title & Active Checkmark */}
                  <div className="flex items-start justify-between gap-2 mb-2 w-full">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        {getHistoricalIcon(event)}
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-sm font-bold truncate pr-3 ${
                          !isCompatible
                            ? 'text-slate-500 dark:text-slate-400'
                            : isSelected
                            ? 'text-slate-900 dark:text-white'
                            : 'text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                        }`}>
                          {event.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${typeBadge.className}`}>
                            {typeBadge.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        <span className="hidden xl:inline">Active</span>
                      </span>
                    )}
                  </div>

                  {/* Metadata Row: Formatted Date, VIIRS status, Severity */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 w-full gap-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400 dark:text-slate-400 shrink-0" />
                      <span className="truncate">{formattedDate}</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                        event.viirs_data_available !== false
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/25'
                          : 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/25'
                      }`}
                      title={event.viirs_data_available !== false ? 'NASA VIIRS Radiance Confirmed' : 'VIIRS Radiance Pending'}
                    >
                      {event.viirs_data_available !== false ? 'VIIRS Ready' : 'VIIRS Pending'}
                    </span>
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        color: severityColor,
                        backgroundColor: `${severityColor}18`,
                        border: `1px solid ${severityColor}35`,
                      }}
                    >
                      {event.severity}
                    </span>
                  </div>

                  {/* Action Row: In-App Search Ground Images Button */}
                  <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-1 w-full">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMedia({
                          name: event.name,
                          date: formattedDate,
                          type: event.type,
                          severity: event.severity,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors py-0.5 px-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer"
                      title="Search ground images and damage photography in-app"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Search Ground Images</span>
                    </button>
                  </div>
                </div>

                {/* Dismiss X — only on the active card */}
                {isSelected && onDismissEvent && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDismissEvent(); }}
                    title="Dismiss active event"
                    className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-md bg-slate-200/80 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-500/25 dark:text-slate-400 dark:hover:text-rose-300 transition-all cursor-pointer z-10"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* List View: single-column compact rows */
        <div className="flex flex-col gap-2.5">
          {filteredEvents.map((event) => {
            const isSelected    = !!activeEvent && String(event.id) === String(activeEvent.id);
            const isCompatible  = isEventCompatibleWithRegion(event, selectedRegionKey);
            const severityColor = getSeverityColor(event.severity);
            const typeBadge     = getEventTypeBadge(event.type);
            const formattedDate = formatEventDate(event.startDate || event.date);

            return (
              <div key={event.id} className="relative">
                <div
                  role="button"
                  tabIndex={isCompatible ? 0 : -1}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (isCompatible) onSelectEvent(event.id);
                  }}
                  onKeyDown={(e) => {
                    if (isCompatible && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectEvent(event.id);
                    }
                  }}
                  aria-disabled={!isCompatible}
                  aria-pressed={isSelected}
                  title={
                    !isCompatible
                      ? `"${event.name}" is a Panay-exclusive disaster event and is disabled for ${regionName} to prevent geographic mismatches.`
                      : undefined
                  }
                  className={`group relative text-left w-full px-3.5 py-2.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    !isCompatible
                      ? 'opacity-50 grayscale-[40%] bg-slate-100/70 dark:bg-slate-950/70 border-dashed border-slate-300 dark:border-slate-800 cursor-not-allowed'
                      : isSelected
                      ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500/50 dark:border-emerald-500 dark:bg-gradient-to-r dark:from-emerald-950/30 dark:via-slate-900/90 dark:to-slate-900 dark:ring-emerald-400/50 cursor-pointer'
                      : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-emerald-500/50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900/90 dark:hover:border-emerald-500/40 shadow-sm dark:shadow-none cursor-pointer'
                  }`}
                >
                  {/* Left Side: Icon, Type Badge, Title, Formatted Start Date */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className={`p-1.5 rounded-lg shrink-0 ${isSelected ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                      {getHistoricalIcon(event)}
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 self-start sm:self-auto ${typeBadge.className}`}>
                        {typeBadge.label}
                      </span>
                      <h3 className={`text-sm font-bold truncate ${
                        !isCompatible
                          ? 'text-slate-500 dark:text-slate-400'
                          : isSelected
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                      }`}>
                        {event.name}
                      </h3>
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                        <Calendar className="h-3 w-3 text-slate-400 dark:text-slate-400 shrink-0" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>
                  </div>

                  {/* Right Side: VIIRS badge, Severity, Resource URL link, Selection status */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                        event.viirs_data_available !== false
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/25'
                          : 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/25'
                      }`}
                      title={event.viirs_data_available !== false ? 'NASA VIIRS Radiance Confirmed' : 'VIIRS Radiance Pending'}
                    >
                      {event.viirs_data_available !== false ? 'VIIRS Ready' : 'VIIRS Pending'}
                    </span>

                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        color: severityColor,
                        backgroundColor: `${severityColor}18`,
                        border: `1px solid ${severityColor}35`,
                      }}
                    >
                      {event.severity}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenMedia({
                          name: event.name,
                          date: formattedDate,
                          type: event.type,
                          severity: event.severity,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors px-2 py-0.5 rounded bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 cursor-pointer"
                      title="Search ground images and damage photography in-app"
                    >
                      <Camera className="h-3 w-3" />
                      <span className="hidden sm:inline">Search Ground Images</span>
                      <span className="sm:hidden">Images</span>
                    </button>

                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pl-1 shrink-0">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Dismiss X — only on the active card */}
                {isSelected && onDismissEvent && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDismissEvent(); }}
                    title="Dismiss active event"
                    className="absolute -top-1.5 -right-1.5 md:top-2 md:right-2 flex h-5 w-5 items-center justify-center rounded-md bg-slate-200 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-500/25 dark:text-slate-400 dark:hover:text-rose-300 transition-all cursor-pointer z-10 shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── GdacsPanel ───────────────────────────────────────────────────────────────

function GdacsPanel({
  events,
  activeEvent,
  onSelectEvent,
  onSimulateGdacs,
  onOpenMedia,
  importingGdacsId,
  importedEventIds,
  viewMode = 'grid',
}: {
  events: DisasterEvent[];
  activeEvent?: DisasterEvent | null;
  onSelectEvent: (id: string) => void;
  onSimulateGdacs?: (alert: GdacsAlert, tempEvent?: DisasterEvent) => void | Promise<void>;
  onOpenMedia?: (data: MediaEventData) => void;
  importingGdacsId?: string | null;
  importedEventIds?: Set<string>;
  viewMode?: ViewMode;
}) {
  const resolveImportedId = (alert: GdacsAlert): string | null => {
    const candidates = [
      alert.id ? String(alert.id) : null,
      alert.event_id != null ? `gdacs-${alert.event_id}` : null,
      alert.event_id != null ? String(alert.event_id) : null,
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      if (importedEventIds?.has(c)) return c;
    }
    const normName = (alert.name ?? '').toLowerCase().trim();
    const byName = events.find((e) => (e.name ?? '').toLowerCase().trim() === normName);
    if (byName) return byName.id;
    return null;
  };
  const [alerts,    setAlerts]    = useState<GdacsAlert[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/gdacs/alerts?limit=25');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      const list: GdacsAlert[] = Array.isArray(json)
        ? json
        : Array.isArray(json.alerts)
        ? json.alerts
        : [];

      // Strictly sort normalized GDACS events in reverse chronological order (newest first)
      const sortedList = [...list].sort((a, b) => {
        const dateA = new Date(a.fromdate || a.startDate || a.date || a.pubDate || 0).getTime() || 0;
        const dateB = new Date(b.fromdate || b.startDate || b.date || b.pubDate || 0).getTime() || 0;
        return dateB - dateA;
      });

      setAlerts(sortedList);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Memoize sorted alerts with fallback protection
  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => {
      const dateA = new Date(a.fromdate || a.startDate || a.date || a.pubDate || 0).getTime() || 0;
      const dateB = new Date(b.fromdate || b.startDate || b.date || b.pubDate || 0).getTime() || 0;
      return dateB - dateA; // Descending (latest first)
    });
  }, [alerts]);

  const lastFetchLabel = lastFetch
    ? lastFetch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const handleCardClick = (alert: GdacsAlert) => {
    const importedId = resolveImportedId(alert);
    if (importedId) {
      onSelectEvent(importedId);
      return;
    }

    const tempEvent = createTemporaryEventFromGdacs(alert);

    if (onSimulateGdacs) {
      onSimulateGdacs(alert, tempEvent);
    }
  };

  return (
    <div>
      {/* Sub-header */}
      <div className="flex items-center justify-between mb-2.5 gap-3">
        <p className="text-[11px] text-slate-500 dark:text-ink-400">
          Real-time GDACS natural hazard alerts filtered for the Philippines. Click{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-300">Simulate</span>{' '}
          to load a live event into the recovery engine.
        </p>
        <button
          type="button"
          onClick={fetchAlerts}
          disabled={loading}
          title="Refresh live GDACS alerts"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-ink-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />
          }
          <span className="hidden sm:inline">Refresh</span>
          {lastFetchLabel && !loading && (
            <span className="text-[10px] text-slate-400 dark:text-ink-500 hidden md:inline">
              · {lastFetchLabel}
            </span>
          )}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && sortedAlerts.length === 0 && (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2.5"}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`${viewMode === 'grid' ? 'h-28' : 'h-16'} rounded-xl bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 animate-pulse`}
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-ink-200">Could not load live alerts</p>
          <p className="text-xs text-slate-500 dark:text-ink-400 max-w-xs">{error}</p>
          <button
            type="button"
            onClick={fetchAlerts}
            className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && sortedAlerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <Radio className="h-8 w-8 text-ink-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-ink-200">No active GDACS alerts</p>
          <p className="text-xs text-slate-500 dark:text-ink-400">
            No live natural hazard alerts for the Philippines at this time.
          </p>
        </div>
      )}

      {/* Alert cards */}
      {sortedAlerts.length > 0 && (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" : "flex flex-col gap-2.5"}>
          {sortedAlerts.map((alert) => {
            const alertId      = String(alert.event_id ?? alert.id ?? '');
            const isImporting  = importingGdacsId === alertId;
            const importedId   = resolveImportedId(alert);
            const isImported   = importedId !== null || !!alert.is_imported;
            const isActiveCard = importedId !== null && !!activeEvent && String(importedId) === String(activeEvent.id);

            return (
              <GdacsAlertCard
                key={alertId}
                alert={alert}
                alertId={alertId}
                isImporting={isImporting}
                isImported={isImported}
                isActive={isActiveCard}
                onCardClick={() => handleCardClick(alert)}
                onSimulate={onSimulateGdacs}
                onOpenMedia={onOpenMedia}
                viewMode={viewMode}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── GdacsAlertCard ───────────────────────────────────────────────────────────

function GdacsAlertCard({
  alert,
  alertId,
  isImporting,
  isImported,
  isActive,
  onCardClick,
  onSimulate,
  onOpenMedia,
  viewMode = 'grid',
}: {
  alert: GdacsAlert;
  alertId: string;
  isImporting: boolean;
  isImported: boolean;
  isActive: boolean;
  onCardClick: () => void;
  onSimulate?: (alert: GdacsAlert, tempEvent?: DisasterEvent) => void | Promise<void>;
  onOpenMedia?: (data: MediaEventData) => void;
  viewMode?: ViewMode;
}) {
  const levelClasses = gdacsLevelClasses(alert.alert_level);
  const dotClass     = gdacsLevelDot(alert.alert_level);

  const coords = alert.coordinates ?? (alert.latitude != null && alert.longitude != null
    ? [alert.longitude, alert.latitude] as [number, number]
    : null);
  const coordLabel = coords
    ? `${Number(coords[1] ?? coords[0]).toFixed(3)}°, ${Number(coords[0] ?? coords[1]).toFixed(3)}°`
    : null;

  if (viewMode === 'list') {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCardClick();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onCardClick();
          }
        }}
        aria-pressed={isActive}
        className={`group relative text-left w-full px-3.5 py-2.5 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-sm dark:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
          isActive
            ? 'border-emerald-500 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-500/50 dark:border-emerald-500 dark:bg-gradient-to-r dark:from-emerald-950/30 dark:via-slate-900/90 dark:to-slate-900 dark:ring-emerald-400/50 cursor-default'
            : isImported
            ? 'border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-500/8 dark:border-emerald-500/40 hover:border-emerald-500/70 dark:hover:border-emerald-400/60 hover:shadow-md cursor-pointer'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/90 cursor-pointer'
        }`}
      >
        {/* Left: Icon, Badge, Name, Date, Country */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className={`p-1.5 rounded-lg shrink-0 ${
            isActive ? 'bg-emerald-100 dark:bg-emerald-500/20'
            : isImported ? 'bg-emerald-50 dark:bg-emerald-500/15'
            : 'bg-slate-100 dark:bg-slate-800'
          }`}>
            {getGdacsIcon(alert.type, alert.name)}
          </div>
          <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
            <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 self-start sm:self-auto ${levelClasses}`}>
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
              {alert.alert_level}
            </span>
            <h3
              className={`text-sm font-bold truncate ${
                isActive ? 'text-slate-900 dark:text-white'
                : 'text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-white'
              }`}
              title={alert.name}
            >
              {alert.name}
            </h3>
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 shrink-0">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>{formatGdacsDate(alert.date || alert.fromdate)}</span>
            </span>
          </div>
        </div>

        {/* Right: Actions, Coords & External link */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto flex-wrap">
          {coordLabel && (
            <span
              className="hidden lg:inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700"
              title="Centroid Geographic Coordinates"
            >
              <Radio className="h-2.5 w-2.5 text-emerald-400" />
              {coordLabel}
            </span>
          )}

          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              Active Simulation
            </span>
          ) : isImported ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick();
              }}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Select Event
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick();
              }}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-sm shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  Simulate
                </>
              )}
            </button>
          )}

          {onOpenMedia && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMedia({
                  name: alert.name,
                  date: formatGdacsDate(alert.date || alert.fromdate),
                  type: alert.type || alert.category,
                  severity: alert.alert_level,
                });
              }}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors px-2 py-0.5 rounded bg-emerald-50/60 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 cursor-pointer"
              title="Search ground images in-app"
            >
              <Camera className="h-3 w-3" />
              <span className="hidden sm:inline">Images</span>
            </button>
          )}

          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              title="View on GDACS website"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">GDACS</span>
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCardClick();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      aria-pressed={isActive}
      className={`group relative text-left w-full flex flex-col justify-between p-3.5 rounded-xl border transition-all shadow-sm dark:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
        isActive
          ? 'border-emerald-500 bg-emerald-50/80 shadow-md ring-1 ring-emerald-500/50 dark:border-emerald-500 dark:bg-gradient-to-br dark:from-emerald-950/30 dark:via-slate-900/90 dark:to-slate-900 dark:shadow-[0_0_20px_rgba(16,185,129,0.18)] dark:ring-emerald-400/50 cursor-default'
          : isImported
          ? 'border-emerald-400/50 bg-emerald-50/40 dark:bg-emerald-500/8 dark:border-emerald-500/40 hover:border-emerald-500/70 dark:hover:border-emerald-400/60 hover:shadow-md cursor-pointer'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/90 cursor-pointer'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`p-1.5 rounded-lg shrink-0 ${
          isActive ? 'bg-emerald-100 dark:bg-emerald-500/20'
          : isImported ? 'bg-emerald-50 dark:bg-emerald-500/15'
          : 'bg-slate-100 dark:bg-slate-800'
        }`}>
          {getGdacsIcon(alert.type, alert.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-bold truncate leading-tight ${
              isActive ? 'text-slate-900 dark:text-white'
              : 'text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-white'
            }`}
            title={alert.name}
          >
            {alert.name}
          </h3>
          <p
            className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5"
            title={alert.description}
          >
            {alert.description || `${alert.type} · ${alert.country ?? 'Philippines'}`}
          </p>
        </div>

        {/* Active badge */}
        {isActive && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
            <span className="hidden xl:inline">Active</span>
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 gap-1 flex-wrap">
        <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${levelClasses}`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
          {alert.alert_level}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
          <Calendar className="h-3 w-3 shrink-0" />
          {formatGdacsDate(alert.date || alert.fromdate)}
        </span>
        {alert.country && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[72px]">
            {alert.country}
          </span>
        )}
      </div>

      {/* Action / telemetry row */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex-wrap">
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
              Active Simulation
            </span>
          ) : isImported ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick();
              }}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 hover:bg-emerald-500/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Select Event
            </button>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCardClick();
              }}
              disabled={isImporting}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 shadow-sm shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5 fill-current" />
                  Simulate Event
                </>
              )}
            </button>
          )}

          {coordLabel && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700"
              title="Centroid Geographic Coordinates"
            >
              <Radio className="h-2.5 w-2.5 text-emerald-400" />
              {coordLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {onOpenMedia && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMedia({
                  name: alert.name,
                  date: formatGdacsDate(alert.date || alert.fromdate),
                  type: alert.type || alert.category,
                  severity: alert.alert_level,
                });
              }}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors py-0.5 px-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-500/10 cursor-pointer"
              title="Search ground images in-app"
            >
              <Camera className="h-3 w-3" />
              <span>Images</span>
            </button>
          )}

          {alert.url && (
            <a
              href={alert.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-300 transition-colors"
              title="View on GDACS website"
            >
              <ExternalLink className="h-3 w-3" />
              <span className="hidden sm:inline">GDACS</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

