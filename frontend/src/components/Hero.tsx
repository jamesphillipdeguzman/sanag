import { Satellite, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import type { Municipality, DisasterEvent } from '@/types';
import { getSeverityColor } from '@/data/mockData';

interface HeroProps {
  municipalities: Municipality[];
  activeEvent: DisasterEvent;
  onSelectEvent: (id: string) => void;
  events: DisasterEvent[];
}

export default function Hero({ municipalities, activeEvent, onSelectEvent, events }: HeroProps) {
  const avgRecovery = Math.round(
    municipalities.reduce((sum, m) => sum + m.recoveryScore, 0) / municipalities.length,
  );
  const restoredCount = municipalities.filter((m) => m.status === 'restored').length;
  const criticalCount = municipalities.filter((m) => m.status === 'critical').length;

  return (
    <section id="overview" className="relative pt-24 pb-12 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-ink-950" />
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-ocean-600/20 blur-[120px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          {/* Left: Headline */}
          <div className="lg:col-span-7 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-3 py-1.5 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-ocean-200">Local GeoJSON Dataset</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.1] text-balance">
              Tracking Power Recovery Across{' '}
              <span className="gradient-text">Panay Island</span>{' '}
              from Space
            </h1>

            <p className="mt-6 text-lg text-ink-300 leading-relaxed max-w-2xl">
              SANAG visualizes municipality boundaries and recovery indicators across
              Panay Island. Connect a verified night-light data source later to replace
              the included demo metrics with live measurements.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#map"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-ocean-600 to-ocean-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-ocean-500/25 hover:shadow-ocean-500/40 hover:scale-[1.02] transition-all"
              >
                <Satellite className="h-4 w-4" />
                Explore the Map
              </a>
              <a
                href="#recovery"
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-all"
              >
                <TrendingUp className="h-4 w-4" />
                Recovery Trends
              </a>
            </div>
          </div>

          {/* Right: Event selector + stats */}
          <div className="lg:col-span-5 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            {/* Active event card */}
            <div className="glass rounded-2xl p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-ink-400 uppercase tracking-wider">Active Event</span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{
                    color: getSeverityColor(activeEvent.severity),
                    backgroundColor: `${getSeverityColor(activeEvent.severity)}20`,
                  }}
                >
                  {activeEvent.severity}
                </span>
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{activeEvent.name}</h3>
              <p className="text-sm text-ink-400 mb-4">{activeEvent.date}</p>

              <div className="flex flex-wrap gap-2">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => onSelectEvent(event.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      event.id === activeEvent.id
                        ? 'bg-ocean-500/20 text-ocean-200 border border-ocean-500/40'
                        : 'bg-white/5 text-ink-400 border border-white/10 hover:bg-white/10 hover:text-ink-200'
                    }`}
                  >
                    {event.name.length > 28 ? event.name.slice(0, 28) + '…' : event.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                icon={<Activity className="h-4 w-4" />}
                label="Avg Recovery"
                value={`${avgRecovery}%`}
                accent="text-ocean-300"
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="Restored"
                value={`${restoredCount}/${municipalities.length}`}
                accent="text-emerald-300"
              />
              <StatCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Critical"
                value={criticalCount.toString()}
                accent="text-rose-300"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatCard({
  icon, label, value, accent,
}: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="glass rounded-xl p-4 card-hover">
      <div className={`flex items-center gap-1.5 mb-2 ${accent}`}>
        {icon}
        <span className="text-[11px] font-medium text-ink-400 uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
