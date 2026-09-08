import type { DisasterEvent } from '@/types';
import { getSeverityColor } from '@/data/mockData';
import { Zap, CloudRain, Waves, ChevronRight } from 'lucide-react';

interface EventTimelineProps {
  events: DisasterEvent[];
  activeEventId: string;
  onSelect: (id: string) => void;
}

const typeIcon: Record<string, React.ReactNode> = {
  blackout: <Zap className="h-4 w-4" />,
  typhoon: <CloudRain className="h-4 w-4" />,
  flood: <Waves className="h-4 w-4" />,
};

export default function EventTimeline({ events, activeEventId, onSelect }: EventTimelineProps) {
  const active = events.find((e) => e.id === activeEventId);

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10">
        <h3 className="text-sm font-semibold text-white">Disaster Event Timeline</h3>
        <p className="text-xs text-ink-400 mt-0.5">Select an event to inspect before, during, and after scenarios</p>
      </div>

      {/* Timeline */}
      <div className="p-5">
        <div className="relative">
          {/* Horizontal line */}
          <div className="absolute top-5 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

          <div className="flex gap-3 overflow-x-auto scrollbar-thin pb-2">
            {events.map((event) => {
              const isActive = event.id === activeEventId;
              const color = getSeverityColor(event.severity);

              return (
                <button
                  key={event.id}
                  onClick={() => onSelect(event.id)}
                  className={`relative flex-shrink-0 w-44 rounded-xl border p-3 text-left transition-all ${
                    isActive
                      ? 'border-white/30 bg-white/10 scale-[1.02]'
                      : 'border-white/10 bg-ink-950/40 hover:border-white/20 hover:bg-white/5'
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
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{event.name}</p>
                      <p className="text-[10px] text-ink-400">{event.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {event.severity}
                    </span>
                    <span className="text-[10px] text-ink-400">
                      {(event.affectedPopulation / 1000).toFixed(0)}K affected
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active event description */}
        {active && (
          <div className="mt-5 rounded-xl bg-ink-950/50 border border-white/5 p-4 animate-fade-in">
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
                  <h4 className="text-sm font-bold text-white">{active.name}</h4>
                  <span className="text-xs text-ink-400">{active.date} → {active.endDate}</span>
                </div>
                <p className="text-sm text-ink-300 leading-relaxed">{active.description}</p>
                <div className="mt-3 flex items-center gap-4 text-xs">
                  <span className="text-ink-400">
                    Affected: <span className="font-semibold text-white">{active.affectedPopulation.toLocaleString()}</span>
                  </span>
                  <span className="text-ink-400">
                    Type: <span className="font-semibold capitalize text-white">{active.type}</span>
                  </span>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-ink-500 flex-shrink-0 mt-1" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
