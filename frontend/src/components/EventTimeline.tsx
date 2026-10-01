import React from 'react';
import type { DisasterEvent } from '@/types';
import { getSeverityColor, formatAffectedPopulation } from '@/data/mockData';
import { Activity, X, Zap, CloudRain, Waves, ChevronRight } from 'lucide-react';

interface EventTimelineProps {
  events: DisasterEvent[];
  activeEventId: string;
  onSelect: (id: string) => void;
  onDismiss?: () => void;
}

const typeIcon: Record<string, React.ReactNode> = {
  blackout: <Zap className="h-4 w-4" />,
  grid_failure: <Zap className="h-4 w-4" />,
  typhoon: <CloudRain className="h-4 w-4" />,
  flood: <Waves className="h-4 w-4" />,
  monsoon_flood: <Waves className="h-4 w-4" />,
  earthquake: <Activity className="h-4 w-4" />,
  // GDACS short-codes — map to the same icons so imported events render correctly
  TC: <CloudRain className="h-4 w-4" />,
  FL: <Waves className="h-4 w-4" />,
  EQ: <Activity className="h-4 w-4" />,
};

export default function EventTimeline({ events, activeEventId, onSelect, onDismiss }: EventTimelineProps) {
  // Strictly sort events in reverse chronological order (newest first)
  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || 0).getTime() || 0;
      const dateB = new Date(b.startDate || b.date || 0).getTime() || 0;
      return dateB - dateA;
    });
  }, [events]);

  const active = sortedEvents.find((e) => e.id === activeEventId);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 backdrop-blur-sm overflow-hidden shadow-lg dark:shadow-xl transition-colors">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Disaster Event Timeline</h3>
        <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">Select an event to inspect before, during, and after scenarios</p>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-white/15 to-transparent" />

          <div className="flex gap-3 overflow-x-auto scrollbar-thin py-2 px-1">
            {sortedEvents.map((event) => {
              const isActive = event.id === activeEventId;
              const color = getSeverityColor(event.severity);

              return (
                <div key={event.id} className="relative flex-shrink-0 w-44">
                  <button
                    onClick={() => onSelect(event.id)}
                    className={`relative w-full rounded-xl border p-3 text-left transition-all ${
                      isActive
                        ? 'border-ocean-500 bg-ocean-50/80 shadow-md ring-1 ring-ocean-400/50 scale-[1.02] dark:border-white/30 dark:bg-white/10 dark:ring-0'
                        : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 dark:border-white/10 dark:bg-ink-950/40 dark:hover:border-white/20 dark:hover:bg-white/5'
                    }`}
                  >
                    {/* Node dot */}
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {typeIcon[event.type]}
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{event.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-ink-400">{event.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${color}20`, color }}
                      >
                        {event.severity}
                      </span>
                      <span className="text-[10px] text-slate-600 dark:text-ink-300 font-medium">
                        {formatAffectedPopulation(event.affectedPopulation)}
                      </span>
                    </div>
                  </button>

                  {/* X dismiss button — only on the active card */}
                  {isActive && onDismiss && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                      title="Dismiss active event"
                      className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-slate-200/80 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-white/10 dark:hover:bg-rose-500/25 dark:text-ink-400 dark:hover:text-rose-300 transition-all cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Active event description */}
        {active && (
          <div className="mt-5 rounded-xl bg-slate-50 dark:bg-ink-950/50 border border-slate-200 dark:border-white/5 p-4 animate-fade-in transition-colors">
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                style={{
                  backgroundColor: `${getSeverityColor(active.severity)}20`,
                  color: getSeverityColor(active.severity),
                }}
              >
                {typeIcon[active.type]}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{active.name}</h4>
                  <span className="text-xs text-slate-500 dark:text-ink-400">{active.date} → {active.endDate}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-ink-300 leading-relaxed">{active.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                  <span className="text-slate-500 dark:text-ink-400">
                    Affected: <span className="font-semibold text-slate-900 dark:text-white">{formatAffectedPopulation(active.affectedPopulation)}</span>
                    {active.affectedPopulation > 0 && (
                      <span className="text-slate-500 dark:text-ink-500 text-[11px] ml-1.5 font-normal">
                        ({active.affectedPopulation.toLocaleString()} citizens)
                      </span>
                    )}
                  </span>
                  <span className="text-slate-500 dark:text-ink-400">
                    Type: <span className="font-semibold capitalize text-slate-900 dark:text-white">{active.type}</span>
                  </span>
                </div>
              </div>
              {/* X dismiss button in the detail panel */}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  title="Dismiss active event"
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/70 hover:bg-rose-100 border border-slate-300 hover:border-rose-300 text-slate-500 hover:text-rose-600 dark:bg-white/5 dark:hover:bg-rose-500/15 dark:border-white/10 dark:hover:border-rose-500/30 dark:text-ink-500 dark:hover:text-rose-300 transition-all cursor-pointer flex-shrink-0 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
