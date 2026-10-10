import React from 'react';
import type { DisasterEvent } from '@/types';
import { getSeverityColor, formatAffectedPopulation } from '@/data/mockData';
import { resolveEventSeverity } from './EventSelectorPanel';
import { Activity, X, Zap, CloudRain, Waves } from 'lucide-react';

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

export function getSeverityColors(severity?: string) {
  const norm = (severity || '').toUpperCase();

  if (norm.includes('CRITICAL') || norm.includes('EXTREME') || norm.includes('RED') || norm.includes('SEVERE')) {
    return {
      dot: 'bg-rose-500',
      pill: 'bg-rose-500/15 border-rose-500/30 text-rose-500',
      glow: 'shadow-rose-500/50',
    };
  }
  if (norm.includes('HIGH') || norm.includes('ORANGE')) {
    return {
      dot: 'bg-amber-500',
      pill: 'bg-amber-500/15 border-amber-500/30 text-amber-500',
      glow: 'shadow-amber-500/50',
    };
  }
  if (norm.includes('MODERATE') || norm.includes('MEDIUM') || norm.includes('BLUE') || norm.includes('SKY')) {
    return {
      dot: 'bg-sky-500',
      pill: 'bg-sky-500/15 border-sky-500/30 text-sky-500',
      glow: 'shadow-sky-500/50',
    };
  }
  // Default Low
  return {
    dot: 'bg-emerald-500',
    pill: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500',
    glow: 'shadow-emerald-500/50',
  };
}

function formatTimelineDate(dateStr?: string): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const year = d.getFullYear();
    return `${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export default function EventTimeline({ events, activeEventId, onSelect, onDismiss }: EventTimelineProps) {
  // Strictly sort events in reverse chronological order (newest first)
  const sortedEvents = React.useMemo(() => {
    return [...events].sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || 0).getTime() || 0;
      const dateB = new Date(b.startDate || b.date || 0).getTime() || 0;
      return dateB - dateA;
    });
  }, [events]);

  const active = sortedEvents.find((e) => String(e.id) === String(activeEventId)) ?? sortedEvents[0] ?? null;

  return (
    <div className="relative w-full rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/70 p-4 sm:p-6 backdrop-blur-md shadow-lg dark:shadow-xl transition-colors">
      {/* Timeline Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-sm" />
            Disaster Incident Timeline
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Chronological record of grid collapses, typhoons, and baseline calibration events
          </p>
        </div>

        {/* 4-Tier Color Legend */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 self-start sm:self-auto">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            Low
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
            Moderate
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 ring-2 ring-amber-500/20" />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
            Critical
          </span>
        </div>
      </div>

      {/* Horizontal Timeline Track */}
      <div className="relative">
        {/* Continuous Horizontal Axis Line */}
        <div className="absolute top-[26px] left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500/80 via-slate-300 dark:via-slate-700 to-slate-200 dark:to-slate-800 pointer-events-none z-0" />

        {/* Scrollable Items Container */}
        <div className="relative z-10 flex gap-4 overflow-x-auto pb-4 pt-3 px-2 timeline-scroll scroll-smooth">
          {sortedEvents.map((event) => {
            const isSelected = !!activeEventId && String(event.id) === String(activeEventId);
            const severity = resolveEventSeverity(event);
            const colors = getSeverityColors(severity);
            
            return (
              <div 
                key={event.id}
                onClick={() => onSelect(event.id)}
                className="flex-shrink-0 flex flex-col items-center group cursor-pointer w-[210px] relative select-none"
              >
                {/* Timeline Node Pip on the Axis */}
                <div className="relative mb-3 flex items-center justify-center h-7">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 z-10 ${
                    isSelected 
                      ? 'bg-cyan-400 border-white shadow-[0_0_12px_rgba(6,182,212,0.9)] scale-125' 
                      : 'bg-white dark:bg-slate-900 border-slate-400 dark:border-slate-600 group-hover:border-cyan-400 group-hover:bg-cyan-950'
                  }`} />
                </div>

                {/* Date Milestone Pill */}
                <span className={`text-[11px] font-mono font-semibold tracking-wider mb-2 px-2.5 py-0.5 rounded-full transition-colors ${
                  isSelected 
                    ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm' 
                    : 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 group-hover:text-slate-900 dark:group-hover:text-slate-200'
                }`}>
                  {formatTimelineDate(event.startDate || event.date)}
                </span>

                {/* Event Card */}
                <div className={`w-full p-3.5 rounded-xl border transition-all duration-200 text-left flex flex-col justify-between relative ${
                  isSelected 
                    ? 'bg-white dark:bg-slate-900/90 border-cyan-500/80 shadow-[0_4px_20px_rgba(6,182,212,0.18)] -translate-y-0.5 ring-1 ring-cyan-500/30' 
                    : 'bg-slate-50/90 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-700'
                }`}>
                  {/* Event Title & Icon */}
                  <div className="flex items-start gap-2 mb-2">
                    <span className="p-1.5 rounded-lg bg-slate-200/70 dark:bg-slate-800/80 text-cyan-600 dark:text-cyan-400 shrink-0">
                      {typeIcon[event.type] ?? <Zap className="h-4 w-4" />}
                    </span>
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight">
                      {event.name}
                    </span>
                  </div>

                  {/* Card Bottom / Footer Row */}
                  <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-slate-200 dark:border-slate-800/60 text-[11px]">
                    {/* Minimal Color Indicator Dot */}
                    <div className="flex items-center gap-1.5" title={`Severity: ${severity}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${colors.dot} ring-2 ring-slate-900/10 dark:ring-white/10`} />
                    </div>

                    {/* Affected Count (Clean formatting without duplicate "affected") */}
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      {(() => {
                        const formatted = formatAffectedPopulation(event.affectedPopulation ?? (event as any).affectedCount ?? 0);
                        const raw = (event as any).affectedCount || formatted;
                        return String(raw).includes('affected') ? raw : `${raw} affected`;
                      })()}
                    </span>
                  </div>

                  {/* X dismiss button if selected */}
                  {isSelected && onDismiss && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
                      title="Dismiss active event"
                      className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-md bg-slate-200/80 hover:bg-rose-100 text-slate-500 hover:text-rose-600 dark:bg-white/10 dark:hover:bg-rose-500/25 dark:text-slate-400 dark:hover:text-rose-300 transition-all cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active event description */}
      {active && (
        <div className="mt-5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 p-4 sm:p-5 animate-fade-in transition-colors">
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
              style={{
                backgroundColor: `${getSeverityColor(active.severity)}20`,
                color: getSeverityColor(active.severity),
              }}
            >
              {typeIcon[active.type] ?? <Zap className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{active.name}</h4>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{active.date} → {active.endDate}</span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{active.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Affected: <span className="font-semibold text-slate-900 dark:text-white">{formatAffectedPopulation(active.affectedPopulation ?? 0)}</span>
                  {(active.affectedPopulation ?? 0) > 0 && (
                    <span className="text-slate-500 dark:text-slate-500 text-[11px] ml-1.5 font-normal">
                      ({(active.affectedPopulation ?? 0).toLocaleString()} citizens)
                    </span>
                  )}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
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
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200/70 hover:bg-rose-100 border border-slate-300 hover:border-rose-300 text-slate-500 hover:text-rose-600 dark:bg-white/5 dark:hover:bg-rose-500/15 dark:border-white/10 dark:hover:border-rose-500/30 dark:text-slate-400 dark:hover:text-rose-300 transition-all cursor-pointer flex-shrink-0 mt-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

