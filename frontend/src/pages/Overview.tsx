import { useMemo } from 'react';
import { Activity, AlertTriangle, Calendar, CheckCircle2, CloudRain, Droplets, TrendingUp, Users, Wind, X, Zap } from 'lucide-react';
import type { Municipality, DisasterEvent, GdacsAlert } from '@/types';
import { getSeverityColor, formatAffectedPopulation } from '@/data/mockData';
import PanayMap from '@/components/PanayMap';
import GdacsAlertBanner from '@/components/GdacsAlertBanner';

interface OverviewProps {
  municipalities: Municipality[];
  activeEvent: DisasterEvent;
  events: DisasterEvent[];
  onSelectEvent: (id: string) => void;
  onDismissEvent?: () => void;
  selectedId: string | null;
  onSelectMunicipality: (id: string) => void;
  globalRank?: number | null;
  recoveryDate?: string | null;
  isMapLoading?: boolean;
  gdacsAlerts?: GdacsAlert[];
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  isGdacsLoading?: boolean;
  onRefreshGdacs?: () => void;
  importingGdacsId?: string | null;
  importedEventIds?: Set<string>;
  onMunicipalitiesLoaded?: (newItems: Municipality[]) => void;
}

export default function Overview({
  municipalities,
  activeEvent,
  events,
  onSelectEvent,
  onDismissEvent,
  selectedId,
  globalRank,
  onSelectMunicipality,
  recoveryDate,
  isMapLoading = false,
  gdacsAlerts = [],
  onSimulateGdacs,
  isGdacsLoading = false,
  onRefreshGdacs,
  importingGdacsId = null,
  importedEventIds = new Set(),
  onMunicipalitiesLoaded,
}: OverviewProps) {
  // Focus overview headline metrics on Panay Island by default
  const panayMunicipalities = useMemo(() => {
    const list = municipalities.filter(
      (m) =>
        ['Iloilo', 'Capiz', 'Aklan', 'Antique', 'Panay'].includes(m.province) ||
        (m.pcode && m.pcode.startsWith('PH06')) ||
        (!m.province && !m.region)
    );
    return list.length > 0 ? list : municipalities;
  }, [municipalities]);

  const avgRecovery = panayMunicipalities.length > 0
    ? Math.round(panayMunicipalities.reduce((sum, m) => sum + m.recoveryScore, 0) / panayMunicipalities.length)
    : 0;
  const restoredCount = panayMunicipalities.filter((m) => m.status === 'restored').length;
  const criticalCount = panayMunicipalities.filter((m) => m.status === 'critical').length;

  // Dynamically compute the affected population for the selected event based on current Panay LGU statuses
  const affectedPopulation = useMemo(() => {
    const affectedLGUs = panayMunicipalities.filter(
      (m) => m.status === 'critical' || m.status === 'warning' || (m.recoveryScore !== undefined && m.recoveryScore < 60)
    );
    if (affectedLGUs.length > 0) {
      return affectedLGUs.reduce((sum, m) => sum + (m.population || 0), 0);
    }
    const unrestored = panayMunicipalities.filter((m) => m.status !== 'restored');
    if (unrestored.length > 0) {
      return unrestored.reduce((sum, m) => sum + (m.population || 0), 0);
    }
    return activeEvent.affectedPopulation || 0;
  }, [panayMunicipalities, activeEvent.affectedPopulation]);

  const getEventIcon = (event: DisasterEvent) => {
    const type = event.type?.toLowerCase() || '';
    const name = event.name?.toLowerCase() || '';
    const cat = event.category?.toLowerCase() || '';
    if (type.includes('flood') || name.includes('monsoon') || name.includes('flood') || cat.includes('flood')) {
      return <Droplets className="h-4 w-4 text-ocean-400 shrink-0" />;
    }
    if (type.includes('typhoon') || name.includes('typhoon') || name.includes('storm') || cat.includes('typhoon') || cat.includes('cyclone')) {
      return <Wind className="h-4 w-4 text-amber-400 shrink-0" />;
    }
    if (type.includes('earthquake') || name.includes('earthquake') || cat.includes('earthquake')) {
      return <Activity className="h-4 w-4 text-emerald-400 shrink-0" />;
    }
    return <Zap className="h-4 w-4 text-rose-400 shrink-0" />;
  };

  return (
    <section id="overview" className="relative pt-20 lg:pt-24 pb-8 overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-ink-950 pointer-events-none" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[700px] h-[320px] bg-ocean-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-40 right-10 w-[450px] h-[260px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ROW 1: Header + Summary Metrics (aligned for standard viewport visibility) */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-white/10 mb-3 animate-fade-in-up">
          {/* Header left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-3 py-1 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-ocean-200 uppercase tracking-wider">
                NASA VIIRS Nightlight Analytics · 93 Panay LGUs
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
              Panay Island <span className="gradient-text">Power Recovery Grid</span>
            </h1>
            <p className="text-xs sm:text-sm text-ink-300 mt-1 max-w-2xl">
              High-resolution satellite radiance tracking and daily restoration indexes across Iloilo, Capiz, Aklan, and Antique.
            </p>
          </div>

          {/* Header right: Summary Metrics Cluster */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 shrink-0">
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Avg Recovery"
              value={`${avgRecovery}%`}
              accent="text-ocean-300"
              badge="Island-wide"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Restored"
              value={`${restoredCount}/${municipalities.length}`}
              accent="text-emerald-300"
              badge="LGUs >= 90%"
            />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Critical"
              value={criticalCount.toString()}
              accent="text-rose-300"
              badge="Outages < 30%"
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Affected Pop"
              value={formatAffectedPopulation(affectedPopulation)}
              accent="text-amber-300"
              badge="Impacted LGUs"
            />
          </div>
        </div>

        {/* GDACS Situational Telemetry Marquee Banner directly beneath Header */}
        <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '0.04s' }}>
          <GdacsAlertBanner
            alerts={gdacsAlerts}
            isLoading={isGdacsLoading}
            onRefresh={onRefreshGdacs}
            onImport={onSimulateGdacs}
            importingId={importingGdacsId}
            activeEventId={activeEvent.id}
            importedEventIds={importedEventIds}
            onSelectEvent={onSelectEvent}
            events={events}
          />
        </div>

        {/* ROW 2: Event Selector Cards (Clean layout without overlapping) */}
        <div className="mb-5 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                Disaster Event Monitoring
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-ink-400 border border-white/10">
                {events.length} Incidents Tracked
              </span>
            </div>
            <span className="text-xs text-ink-400 hidden sm:inline">
              Select an incident to recompute spatial radiance &amp; recovery curves
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {events.map((event) => {
              const isSelected = event.id === activeEvent.id;
              const severityColor = getSeverityColor(event.severity);

              return (
                <div key={event.id} className="relative">
                  <button
                    type="button"
                    onClick={() => onSelectEvent(event.id)}
                    aria-pressed={isSelected}
                    className={`group relative text-left w-full p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-ocean-500/80 bg-gradient-to-br from-ocean-500/15 via-ink-900/90 to-ink-900 shadow-[0_0_20px_rgba(89,159,253,0.18)] ring-1 ring-ocean-400/50'
                        : 'border-white/10 bg-ink-900/60 hover:bg-ink-900/90 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2 w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-ocean-500/20' : 'bg-white/5'}`}>
                          {getEventIcon(event)}
                        </div>
                        <h3 className={`text-sm font-bold truncate pr-5 ${isSelected ? 'text-white' : 'text-ink-200 group-hover:text-white'}`}>
                          {event.name}
                        </h3>
                      </div>

                      {isSelected && (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-ocean-300 shrink-0">
                          <CheckCircle2 className="h-3.5 w-3.5 text-ocean-400" />
                          <span className="hidden xl:inline">Active</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-ink-400 mt-1 pt-2 border-t border-white/5 w-full gap-1">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-ink-400 shrink-0" />
                        <span className="truncate">{event.date}</span>
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider shrink-0 ${
                          event.viirs_data_available !== false
                            ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                            : 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                        }`}
                        title={
                          event.viirs_data_available !== false
                            ? 'NASA VIIRS Radiance Observations Confirmed Across Grid'
                            : 'VIIRS Ground Sensor Radiance Pending Confirmation'
                        }
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

                  {/* X dismiss button — only visible on the active card, top-right corner */}
                  {isSelected && onDismissEvent && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDismissEvent(); }}
                      title="Dismiss active event"
                      className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-md bg-white/10 hover:bg-rose-500/25 text-ink-400 hover:text-rose-300 transition-all cursor-pointer z-10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ROW 3: Interactive Leaflet Map & Side Panel (Immediately visible in standard viewport) */}
        <section id="map" className="relative animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <PanayMap
            municipalities={municipalities}
            selectedId={selectedId}
            globalRank={globalRank}
            onSelect={onSelectMunicipality}
            recoveryDate={recoveryDate}
            isLoading={isMapLoading}
            gdacsAlerts={gdacsAlerts}
            activeEventId={activeEvent?.id}
            onSimulateGdacs={onSimulateGdacs}
            onMunicipalitiesLoaded={onMunicipalitiesLoaded}
          />
        </section>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  badge: string;
}) {
  return (
    <div className="glass rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 lg:px-4 lg:py-3 card-hover border border-white/10 flex flex-col justify-between min-w-[85px] sm:min-w-[105px]">
      <div className={`flex items-center gap-1.5 mb-1 ${accent}`}>
        {icon}
        <span className="text-[10px] sm:text-[11px] font-semibold text-ink-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-white tracking-tight truncate">{value}</p>
      <span className="text-[10px] text-ink-400 mt-0.5 truncate">{badge}</span>
    </div>
  );
}
