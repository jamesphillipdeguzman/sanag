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
  Play
} from 'lucide-react';
import type { GdacsAlert } from '@/types';

interface GdacsAlertBannerProps {
  alerts: GdacsAlert[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onImport?: (alert: GdacsAlert) => Promise<void> | void;
  importingId?: string | null;
  activeEventId?: string | null;
  importedEventIds?: Set<string>;
  onSelectEvent?: (id: string) => void;
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
      className="relative rounded-lg border border-white/10 bg-slate-950/70 backdrop-blur-md overflow-hidden shadow-sm transition-all"
      title="Live GDACS Hazard Telemetry — Hover to pause scrolling"
    >
      <div className="flex items-center h-9 sm:h-10 px-2 sm:px-3 text-xs">
        {/* Fixed Left Telemetry Anchor */}
        <div className="flex items-center gap-2 pr-3 border-r border-white/10 shrink-0 z-20 bg-slate-950/90 py-1">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
          </span>
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-rose-400 animate-pulse shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-ink-200">
              <span className="hidden sm:inline">GDACS</span> Telemetry
            </span>
          </div>
        </div>

        {/* Center Marquee Scroll Track */}
        <div className="relative flex-1 overflow-hidden h-full flex items-center">
          {/* Subtle Left & Right Edge Fade Gradients */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 sm:w-10 bg-gradient-to-l from-slate-950 via-slate-950/80 to-transparent z-10" />

          {isLoading && alerts.length === 0 ? (
            <div className="flex items-center gap-2 text-[11px] text-ink-400 px-4">
              <Loader2 className="h-3 w-3 animate-spin text-ocean-400" />
              <span>Connecting to live GDACS disaster alert telemetry...</span>
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-[11px] text-ink-400 px-4 italic">
              No active Philippine disaster alerts flagged by GDACS in current telemetry window.
            </div>
          ) : (
            <div className="gdacs-marquee-track flex items-center gap-6 sm:gap-8 px-4 cursor-default">
              {displayAlerts.map((alert, idx) => {
                const eventId = alert.id || `gdacs-${alert.event_id}`;
                const isImporting = importingId === String(alert.event_id) || importingId === eventId;
                const isImported = importedEventIds.has(eventId) || importedEventIds.has(String(alert.event_id)) || alert.is_imported;
                const isActive = activeEventId === eventId || activeEventId === String(alert.event_id);
                const badgeClass = getAlertBadge(alert.alert_level);

                return (
                  <div
                    key={`${alert.event_id || alert.id}-${idx}`}
                    className="flex items-center gap-2 shrink-0 group/item hover:bg-white/5 py-1 px-1.5 rounded transition-colors"
                  >
                    {/* Hazard Icon */}
                    {getHazardIcon(alert.type, alert.name)}

                    {/* Alert Level Badge */}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${badgeClass}`}>
                      {alert.alert_level}
                    </span>

                    {/* Alert Title */}
                    <span 
                      className="text-[11px] sm:text-xs font-medium text-white/95 group-hover/item:text-ocean-200 transition-colors whitespace-nowrap"
                      title={alert.description || alert.name}
                    >
                      {alert.name}
                    </span>

                    {/* Severity / Date Subtitle */}
                    {alert.severity_text && (
                      <span className="text-[10px] text-amber-200/80 hidden sm:inline whitespace-nowrap">
                        ({alert.severity_text})
                      </span>
                    )}

                    {alert.date && !alert.severity_text && (
                      <span className="text-[10px] text-ink-400 hidden lg:inline whitespace-nowrap">
                        {alert.date}
                      </span>
                    )}

                    {/* Interactive Action Button */}
                    <div className="ml-1 shrink-0 flex items-center gap-1.5">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />
                          <span>Active</span>
                        </span>
                      ) : isImported ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectEvent?.(eventId);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-ocean-300 hover:text-white bg-ocean-500/15 hover:bg-ocean-500/30 border border-ocean-500/30 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                          title="View simulation on grid"
                        >
                          <Play className="h-2.5 w-2.5 text-ocean-300" />
                          <span>Select</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onImport?.(alert);
                          }}
                          disabled={isImporting}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-ocean-600/80 hover:bg-ocean-500 border border-ocean-400/40 px-2 py-0.5 rounded shadow-xs hover:shadow-ocean-500/20 cursor-pointer transition-all disabled:opacity-50"
                          title="Simulate disaster radiance & recovery curve across 93 LGUs"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                              <span>Seeding...</span>
                            </>
                          ) : (
                            <>
                              <Radio className="h-2.5 w-2.5 text-white" />
                              <span>Simulate</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Dossier link */}
                      {alert.url && (
                        <a
                          href={alert.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-ink-400 hover:text-white transition-colors p-0.5"
                          title="Official GDACS Dossier"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Separator */}
                    <span className="text-white/20 select-none text-[11px] ml-1">•</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Right Sync & Count */}
        <div className="flex items-center gap-2 pl-3 border-l border-white/10 shrink-0 z-20 bg-slate-950/90 py-1">
          <span className="text-[10px] font-medium text-ink-400 hidden md:inline">
            {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-1 text-[10px] text-ink-300 hover:text-white px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-40 cursor-pointer"
              title="Sync live GDACS feed"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${isLoading ? 'animate-spin text-ocean-400' : ''}`} />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
