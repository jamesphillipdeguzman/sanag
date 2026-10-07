import React, { useMemo } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  ExternalLink, 
  Flame, 
  Loader2, 
  Radio, 
  RefreshCw, 
  Wind, 
  Droplets, 
  Zap,
  Play,
  Satellite,
  Lock
} from 'lucide-react';
import type { GdacsAlert, DisasterEvent } from '@/types';

interface GdacsAlertBannerProps {
  alerts: GdacsAlert[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onImport?: (alert: GdacsAlert) => Promise<void> | void;
  importingId?: string | null;
  activeEventId?: string | null;
  importedEventIds?: Set<string>;
  onSelectEvent?: (id: string) => void;
  events?: DisasterEvent[];
}

export default function GdacsAlertBanner({
  alerts = [],
  isLoading = false,
  onRefresh,
  onImport,
  importingId = null,
  activeEventId = null,
  importedEventIds = new Set(),
  onSelectEvent,
  events = [],
}: GdacsAlertBannerProps) {
  const getHazardIcon = (type: string, name: string) => {
    const t = (type || '').toUpperCase();
    const n = (name || '').toLowerCase();
    if (t === 'TC' || n.includes('typhoon') || n.includes('cyclone') || n.includes('storm')) {
      return <Wind className="h-3 w-3 text-amber-400 shrink-0" />;
    }
    if (t === 'EQ' || n.includes('earthquake')) {
      return <Activity className="h-3 w-3 text-rose-400 shrink-0" />;
    }
    if (t === 'FL' || n.includes('flood') || n.includes('rain')) {
      return <Droplets className="h-3 w-3 text-ocean-400 shrink-0" />;
    }
    if (t === 'VO' || n.includes('volcano')) {
      return <Flame className="h-3 w-3 text-orange-400 shrink-0" />;
    }
    return <Zap className="h-3 w-3 text-emerald-400 shrink-0" />;
  };

  const getAlertBadge = (level: string) => {
    const lvl = (level || '').toLowerCase();
    if (lvl === 'red') {
      return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    }
    if (lvl === 'orange') {
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    }
    return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  };

  // Duplicate alerts to create a smooth, seamless CSS marquee loop
  const displayAlerts = useMemo(() => {
    if (!alerts || alerts.length === 0) return [];
    let list = [...alerts];
    while (list.length < 5) {
      list = [...list, ...alerts];
    }
    return [...list, ...list];
  }, [alerts]);

  return (
    <div 
      className="relative rounded-lg border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/70 backdrop-blur-md overflow-hidden shadow-xs dark:shadow-sm transition-all"
      title="Live GDACS Hazard Telemetry — Hover to pause scrolling"
    >
      <div className="flex items-center h-9 sm:h-10 px-2 sm:px-3 text-xs">
        {/* Fixed Left Telemetry Anchor */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200 dark:border-white/10 shrink-0 z-20 bg-white/95 dark:bg-slate-950/90 py-1">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-rose-500 dark:text-rose-400 animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:text-ink-200">
              <span className="hidden sm:inline">GDACS</span> Telemetry
            </span>
          </div>
        </div>

        {/* Center Marquee Scroll Track */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          {/* Subtle Left & Right Edge Fade Gradients */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r from-white via-white/80 to-transparent dark:from-slate-950 dark:via-slate-950/80 dark:to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-white via-white/80 to-transparent dark:from-slate-950 dark:via-slate-950/80 dark:to-transparent z-10" />

          {isLoading && alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 px-4">
              <Loader2 className="h-3 w-3 animate-spin text-ocean-600 dark:text-ocean-400" />
              <span>Connecting to live GDACS disaster alert telemetry...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-[11px] text-slate-500 dark:text-ink-400 px-4 italic">
              No active Philippine disaster alerts flagged by GDACS in current telemetry window.
            </div>
          ) : (
            <div className="gdacs-marquee-track flex items-center gap-6 sm:gap-8 px-4 cursor-default">
              {displayAlerts.map((alert, idx) => {
                const rawAlertId = alert.event_id != null ? String(alert.event_id) : '';
                const baseEventId = alert.id ? String(alert.id) : (rawAlertId ? `gdacs-${rawAlertId}` : '');
                const normName = (alert.name || '').toLowerCase().trim();

                // Check if alert already exists in the active events list
                const matchingEvent = events.find((e) => {
                  const eId = String(e.id);
                  const eName = (e.name || '').toLowerCase().trim();
                  return (
                    (baseEventId && (eId === baseEventId || `gdacs-${eId}` === baseEventId)) ||
                    (rawAlertId && (eId === rawAlertId || eId === `gdacs-${rawAlertId}`)) ||
                    (normName && eName === normName)
                  );
                });

                const isImporting = Boolean(
                  (rawAlertId && importingId === rawAlertId) ||
                  (baseEventId && importingId === baseEventId)
                );
                const isImported = Boolean(
                  matchingEvent ||
                  (baseEventId && importedEventIds.has(baseEventId)) ||
                  (rawAlertId && importedEventIds.has(rawAlertId)) ||
                  alert.is_imported
                );
                const resolvedEventId = matchingEvent ? String(matchingEvent.id) : baseEventId;
                const isActive = Boolean(
                  activeEventId && (
                    activeEventId === resolvedEventId ||
                    (baseEventId && activeEventId === baseEventId) ||
                    (rawAlertId && activeEventId === rawAlertId)
                  )
                );
                const badgeClass = getAlertBadge(alert.alert_level);
                const viirsAvailable = alert.viirs_data_available ?? false;

                const handleTileClick = () => {
                  if (isActive) return;
                  if (isImported || matchingEvent) {
                    onSelectEvent?.(resolvedEventId);
                  } else if (viirsAvailable && onImport) {
                    onImport(alert);
                  }
                };

                return (
                  <div
                    key={`${alert.event_id || alert.id}-${idx}`}
                    onClick={handleTileClick}
                    className="flex items-center gap-2 shrink-0 group/item hover:bg-white/5 py-1 px-1.5 rounded transition-colors cursor-pointer"
                  >
                    {/* Hazard Icon */}
                    {getHazardIcon(alert.type, alert.name)}

                    {/* Alert Level Badge */}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${badgeClass}`}>
                      {alert.alert_level}
                    </span>

                    {/* Alert Title */}
                    <span 
                      className="text-[11px] sm:text-xs font-medium text-slate-900 group-hover/item:text-ocean-600 dark:text-white/95 dark:group-hover/item:text-ocean-200 transition-colors whitespace-nowrap"
                      title={alert.description || alert.name}
                    >
                      {alert.name}
                    </span>

                    {/* Severity / Date Subtitle */}
                    {alert.severity_text && (
                      <span className="text-[10px] text-amber-700 dark:text-amber-200/80 hidden sm:inline whitespace-nowrap">
                        ({alert.severity_text})
                      </span>
                    )}

                    {alert.date && !alert.severity_text && (
                      <span className="text-[10px] text-slate-500 dark:text-ink-400 hidden lg:inline whitespace-nowrap">
                        {alert.date}
                      </span>
                    )}

                    {/* Interactive Action Button & Telemetry Feedback */}
                    <div className="ml-1 shrink-0 flex items-center gap-1.5">
                      {/* Satellite Availability Badge for unimported events */}
                      {!isImported && !isActive && (
                        viirsAvailable ? (
                          <span 
                            className="hidden md:inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 px-1.5 py-0.5 rounded shrink-0 cursor-default"
                            title="Ready to Simulate: NASA VIIRS DNB nightlight radiance data confirmed across Panay LGU grid."
                          >
                            <Satellite className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Ready to Simulate</span>
                          </span>
                        ) : (
                          <span 
                            className="inline-flex items-center gap-1 text-[9px] font-medium text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-300/90 dark:bg-amber-500/15 dark:border-amber-500/30 px-1.5 py-0.5 rounded shrink-0 cursor-help"
                            title="VIIRS Data Pending: Live hazard has not impacted ground sensors yet or satellite overpass telemetry is awaiting downlink confirmation."
                          >
                            <Satellite className="h-2.5 w-2.5 text-amber-500 dark:text-amber-400 animate-pulse" />
                            <span className="hidden sm:inline">VIIRS Data Pending</span>
                            <span className="sm:hidden">VIIRS Pending</span>
                          </span>
                        )
                      )}

                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Active</span>
                        </span>
                      ) : isImported ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent?.(resolvedEventId);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-ocean-700 hover:text-ocean-900 bg-ocean-50 hover:bg-ocean-100 border border-ocean-200 dark:text-ocean-300 dark:hover:text-white dark:bg-ocean-500/15 dark:hover:bg-ocean-500/30 dark:border-ocean-500/30 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          title="View simulation on grid"
                        >
                          <Play className="h-2.5 w-2.5 text-ocean-600 dark:text-ocean-300" />
                          <span>Select</span>
                        </button>
                      ) : viirsAvailable ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onImport?.(alert);
                          }}
                          disabled={isImporting}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-ocean-600 hover:bg-ocean-500 border border-ocean-400/40 px-2 py-0.5 rounded shadow-xs hover:shadow-ocean-500/20 cursor-pointer transition-all disabled:opacity-50"
                          title="Simulate Event: Confirmed NASA VIIRS radiance data available across 95 LGUs"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              <span>Seeding...</span>
                            </>
                          ) : (
                            <>
                              <Radio className="h-2.5 w-2.5 text-white" />
                              <span>Simulate Event</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={true}
                          aria-disabled="true"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 dark:text-ink-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded opacity-60 cursor-not-allowed select-none"
                          title="Simulation Unavailable: VIIRS satellite radiance data pending for this live hazard date."
                        >
                          <Lock className="h-2.5 w-2.5 text-slate-400 dark:text-ink-400" />
                          <span>Simulate Event</span>
                        </button>
                      )}

                      {/* Dossier link */}
                      {alert.url && (
                        <a
                          href={alert.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-slate-700 dark:text-ink-400 dark:hover:text-white transition-colors p-0.5"
                          title="Official GDACS Dossier"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Separator */}
                    <span className="text-slate-300 dark:text-white/20 select-none text-[11px] ml-1">•</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Right Sync & Count */}
        <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-white/10 shrink-0 z-20 bg-white/95 dark:bg-slate-950/90 py-1">
          <span className="text-[10px] font-medium text-slate-500 dark:text-ink-400 hidden md:inline">
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-slate-100 hover:bg-slate-200 dark:text-ink-300 dark:hover:text-white dark:border-white/10 dark:hover:border-white/20 dark:bg-white/5 dark:hover:bg-white/10 px-1.5 py-0.5 rounded transition-colors disabled:opacity-40 cursor-pointer"
              title="Sync live GDACS feed"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isLoading ? 'animate-spin text-ocean-500 dark:text-ocean-400' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
