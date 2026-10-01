import { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  CloudLightning,
  Droplets,
  ExternalLink,
  Flame,
  Loader2,
  RefreshCw,
  Radio,
  Satellite,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import type { DisasterEvent, GdacsAlert } from '@/types';
import { getSeverityColor } from '@/data/mockData';
import {
  isEventCompatibleWithRegion,
  getRegionDisplayName,
  isPanayRegion,
  isNationwideRegion,
} from '@/utils/eventScope';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'historical' | 'gdacs';

interface EventSelectorPanelProps {
  /** Curated historical events from the database */
  events: DisasterEvent[];
  activeEvent: DisasterEvent;
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

function formatGdacsDate(dateStr?: string) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr.slice(0, 10);
  }
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

  return (
    <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>

      {/* ── Panel Header with Tabbed Toggle ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-ink-300">
            Disaster Event Monitoring
          </span>
          {activeTab === 'historical' && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600 border border-slate-300 dark:bg-white/5 dark:text-ink-400 dark:border-white/10">
              {events.length} Incidents Tracked
            </span>
          )}
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
        <HistoricalPanel
          events={events}
          activeEvent={activeEvent}
          onSelectEvent={onSelectEvent}
          onDismissEvent={onDismissEvent}
          selectedRegionKey={selectedRegionKey}
        />
      </div>

      <div
        id="panel-gdacs"
        role="tabpanel"
        aria-labelledby="tab-gdacs"
        hidden={activeTab !== 'gdacs'}
      >
        <GdacsPanel
          events={events}
          activeEvent={activeEvent}
          onSelectEvent={onSelectEvent}
          onSimulateGdacs={onSimulateGdacs}
          importingGdacsId={importingGdacsId}
          importedEventIds={importedEventIds}
        />
      </div>
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
  selectedRegionKey,
}: {
  events: DisasterEvent[];
  activeEvent: DisasterEvent;
  onSelectEvent: (id: string) => void;
  onDismissEvent?: () => void;
  selectedRegionKey?: string;
}) {
  const isPanayOrNationwide = isPanayRegion(selectedRegionKey) || isNationwideRegion(selectedRegionKey);
  const regionName = getRegionDisplayName(selectedRegionKey);
  const incompatibleEvents = events.filter((e) => !isEventCompatibleWithRegion(e, selectedRegionKey));
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 p-3 rounded-xl bg-slate-100/90 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label htmlFor="historical-event-select" className="text-xs font-semibold text-slate-700 dark:text-ink-200 shrink-0">
            Event Dropdown:
          </label>
          <div className="relative flex-1 max-w-md">
            <select
              id="historical-event-select"
              value={activeEvent?.id || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) return;
                const chosen = events.find((evt) => evt.id === val);
                if (chosen && !isEventCompatibleWithRegion(chosen, selectedRegionKey)) return;
                onSelectEvent(val);
              }}
              className="w-full text-xs font-semibold rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-ink-900 py-1.5 pl-2.5 pr-8 text-slate-800 dark:text-white shadow-sm focus:border-ocean-500 focus:outline-none cursor-pointer"
            >
              {events.map((evt) => {
                const isCompatible = isEventCompatibleWithRegion(evt, selectedRegionKey);
                return (
                  <option
                    key={evt.id}
                    value={evt.id}
                    disabled={!isCompatible}
                    className={!isCompatible ? 'text-slate-400 dark:text-ink-600 bg-slate-100 dark:bg-ink-950 font-normal' : 'text-slate-900 dark:text-white font-medium'}
                  >
                    {evt.name} {!isCompatible ? `(Incompatible with ${regionName})` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {hasIncompatible && (
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 rounded-lg shrink-0">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>
              <strong>{regionName} active:</strong> {incompatibleEvents.length} Panay-exclusive incident{incompatibleEvents.length > 1 ? 's' : ''} disabled to prevent geographic mismatch.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {events.map((event) => {
          const isSelected    = event.id === activeEvent.id;
          const isCompatible  = isEventCompatibleWithRegion(event, selectedRegionKey);
          const severityColor = getSeverityColor(event.severity);

          return (
            <div key={event.id} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (isCompatible) onSelectEvent(event.id);
                }}
                disabled={!isCompatible}
                aria-disabled={!isCompatible}
                aria-pressed={isSelected}
                title={
                  !isCompatible
                    ? `"${event.name}" is a Panay-exclusive disaster event and is disabled for ${regionName} to prevent geographic mismatches.`
                    : undefined
                }
                className={`group relative text-left w-full p-3.5 rounded-xl border transition-all flex flex-col justify-between ${
                  !isCompatible
                    ? 'opacity-50 grayscale-[40%] bg-slate-100/70 dark:bg-ink-950/70 border-dashed border-slate-300 dark:border-white/10 cursor-not-allowed'
                    : isSelected
                    ? 'border-ocean-500 bg-ocean-50/80 shadow-md ring-1 ring-ocean-400/50 dark:border-ocean-500/80 dark:bg-gradient-to-br dark:from-ocean-500/15 dark:via-ink-900/90 dark:to-ink-900 dark:shadow-[0_0_20px_rgba(89,159,253,0.18)] dark:ring-ocean-400/50 cursor-pointer'
                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 dark:border-white/10 dark:bg-ink-900/60 dark:hover:bg-ink-900/90 dark:hover:border-white/20 shadow-sm dark:shadow-none cursor-pointer'
                }`}
              >
                {!isCompatible && (
                  <div className="mb-2 py-0.5 px-2 rounded bg-rose-500/10 border border-rose-500/25 text-[10px] font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Panay Exclusive · Disabled for {regionName}</span>
                  </div>
                )}

                <div className="flex items-start justify-between gap-2 mb-2 w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-ocean-100 dark:bg-ocean-500/20' : 'bg-slate-100 dark:bg-white/5'}`}>
                      {getHistoricalIcon(event)}
                    </div>
                    <h3 className={`text-sm font-bold truncate pr-5 ${
                      !isCompatible
                        ? 'text-slate-500 dark:text-ink-400'
                        : isSelected
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-800 dark:text-ink-200 group-hover:text-ocean-600 dark:group-hover:text-white'
                    }`}>
                      {event.name}
                    </h3>
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-ocean-600 dark:text-ocean-300 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400" />
                      <span className="hidden xl:inline">Active</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-ink-400 mt-1 pt-2 border-t border-slate-100 dark:border-white/5 w-full gap-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400 dark:text-ink-400 shrink-0" />
                    <span className="truncate">{event.date}</span>
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
              </button>

              {/* Dismiss X — only on the active card */}
              {isSelected && onDismissEvent && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onDismissEvent(); }}
                  title="Dismiss active event"
                  className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-md bg-slate-200/80 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-white/10 dark:hover:bg-rose-500/25 dark:text-ink-400 dark:hover:text-rose-300 transition-all cursor-pointer z-10"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── GdacsPanel ───────────────────────────────────────────────────────────────

function GdacsPanel({
  events,
  activeEvent,
  onSelectEvent,
  onSimulateGdacs,
  importingGdacsId,
  importedEventIds,
}: {
  events: DisasterEvent[];
  activeEvent: DisasterEvent;
  onSelectEvent: (id: string) => void;
  onSimulateGdacs?: (alert: GdacsAlert, tempEvent?: DisasterEvent) => void | Promise<void>;
  importingGdacsId?: string | null;
  importedEventIds?: Set<string>;
}) {
  /**
   * Resolve a GDACS alert to its already-imported DisasterEvent ID.
   * The importedEventIds Set contains every event.id that exists in the events[]
   * array. We try several common ID shapes that handleImportGdacs uses:
   *   - alert.id (e.g. "gdacs-19900614")
   *   - "gdacs-" + alert.event_id
   *   - String(alert.event_id)
   */
  const resolveImportedId = (alert: GdacsAlert): string | null => {
    const candidates = [
      alert.id ? String(alert.id) : null,
      alert.event_id != null ? `gdacs-${alert.event_id}` : null,
      alert.event_id != null ? String(alert.event_id) : null,
    ].filter(Boolean) as string[];
    for (const c of candidates) {
      if (importedEventIds?.has(c)) return c;
      // Also check by matching event name in the events array
    }
    // Fallback: match by normalised name
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
      const res = await fetch('/api/v1/gdacs/alerts?limit=25');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const json = await res.json();
      const list: GdacsAlert[] = Array.isArray(json)
        ? json
        : Array.isArray(json.alerts)
        ? json.alerts
        : [];
      setAlerts(list);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load live alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch once when this panel first mounts (i.e. user first switches to tab)
  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const lastFetchLabel = lastFetch
    ? lastFetch.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  const handleCardClick = (alert: GdacsAlert) => {
    const importedId = resolveImportedId(alert);
    if (importedId) {
      // Already in the events array — re-select it to reload the map + radiance
      onSelectEvent(importedId);
      return;
    }

    // Construct temporary event matching historical catalog
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-ink-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
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
      {loading && alerts.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl bg-slate-100 dark:bg-ink-900/50 border border-slate-200 dark:border-white/5 animate-pulse"
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
            className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-ocean-600 hover:bg-ocean-500 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <Radio className="h-8 w-8 text-ink-500" />
          <p className="text-sm font-semibold text-slate-700 dark:text-ink-200">No active GDACS alerts</p>
          <p className="text-xs text-slate-500 dark:text-ink-400">
            No live natural hazard alerts for the Philippines at this time.
          </p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((alert) => {
            const alertId      = String(alert.event_id ?? alert.id ?? '');
            const isImporting  = importingGdacsId === alertId;
            const importedId   = resolveImportedId(alert);
            const isImported   = importedId !== null || !!alert.is_imported;
            const isActiveCard = importedId !== null && importedId === activeEvent?.id;

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
}: {
  alert: GdacsAlert;
  alertId: string;
  isImporting: boolean;
  isImported: boolean;
  /** True when this card's event is the currently active/selected event */
  isActive: boolean;
  /** Called when the card surface or action button is clicked */
  onCardClick: () => void;
  onSimulate?: (alert: GdacsAlert, tempEvent?: DisasterEvent) => void | Promise<void>;
}) {
  const levelClasses = gdacsLevelClasses(alert.alert_level);
  const dotClass     = gdacsLevelDot(alert.alert_level);

  // Lat/lng telemetry string — shown when coordinates are available
  const coords = alert.coordinates ?? (alert.latitude != null && alert.longitude != null
    ? [alert.longitude, alert.latitude] as [number, number]
    : null);
  const coordLabel = coords
    ? `${Number(coords[1] ?? coords[0]).toFixed(3)}°, ${Number(coords[0] ?? coords[1]).toFixed(3)}°`
    : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onCardClick();
        }
      }}
      aria-pressed={isActive}
      className={`group relative text-left w-full flex flex-col justify-between p-3.5 rounded-xl border transition-all shadow-sm dark:shadow-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500/50 ${
        isActive
          ? 'border-ocean-500 bg-ocean-50/80 shadow-md ring-1 ring-ocean-400/50 dark:border-ocean-500/80 dark:bg-gradient-to-br dark:from-ocean-500/15 dark:via-ink-900/90 dark:to-ink-900 dark:shadow-[0_0_20px_rgba(89,159,253,0.18)] dark:ring-ocean-400/50 cursor-default'
          : isImported
          ? 'border-ocean-400/50 bg-ocean-50/40 dark:bg-ocean-500/8 dark:border-ocean-500/40 hover:border-ocean-500/70 dark:hover:border-ocean-400/60 hover:shadow-md cursor-pointer'
          : 'border-slate-200 bg-white dark:border-white/10 dark:bg-ink-900/60 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-50 dark:hover:bg-ink-900/90 cursor-pointer'
      }`}
    >
      {/* Top row */}
      <div className="flex items-start gap-2 mb-2">
        <div className={`p-1.5 rounded-lg shrink-0 ${
          isActive ? 'bg-ocean-100 dark:bg-ocean-500/20'
          : isImported ? 'bg-ocean-50 dark:bg-ocean-500/15'
          : 'bg-slate-100 dark:bg-white/5'
        }`}>
          {getGdacsIcon(alert.type, alert.name)}
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`text-sm font-bold truncate leading-tight ${
              isActive ? 'text-slate-900 dark:text-white'
              : 'text-slate-800 dark:text-ink-100 group-hover:text-ocean-700 dark:group-hover:text-white'
            }`}
            title={alert.name}
          >
            {alert.name}
          </h3>
          <p
            className="text-[11px] text-slate-500 dark:text-ink-400 truncate mt-0.5"
            title={alert.description}
          >
            {alert.description || `${alert.type} · ${alert.country ?? 'Philippines'}`}
          </p>
        </div>

        {/* Active badge — mirrors Historical tab design */}
        {isActive && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-ocean-600 dark:text-ocean-300 shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400" />
            <span className="hidden xl:inline">Active</span>
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 gap-1 flex-wrap">
        <span className={`flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${levelClasses}`}>
          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass}`} />
          {alert.alert_level}
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-ink-400">
          <Calendar className="h-3 w-3 shrink-0" />
          {formatGdacsDate(alert.date || alert.fromdate)}
        </span>
        {alert.country && (
          <span className="text-[10px] text-slate-400 dark:text-ink-500 truncate max-w-[72px]">
            {alert.country}
          </span>
        )}
      </div>

      {/* Action / telemetry row */}
      <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-white/5 flex-wrap">
        <div className="flex items-center gap-2">
          {isActive ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-ocean-700 dark:text-ocean-300 bg-ocean-500/15 border border-ocean-500/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-ocean-500 dark:text-ocean-400" />
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
              className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-ink-400 bg-slate-100/80 dark:bg-white/5 px-2 py-0.5 rounded border border-slate-200/60 dark:border-white/5"
              title="Centroid Geographic Coordinates"
            >
              <Radio className="h-2.5 w-2.5 text-ocean-400" />
              {coordLabel}
            </span>
          )}
        </div>

        {alert.url && (
          <a
            href={alert.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-ink-500 hover:text-ocean-500 dark:hover:text-ocean-300 transition-colors ml-auto"
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
