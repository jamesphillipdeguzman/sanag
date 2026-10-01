import { useMemo } from 'react';
import { Activity, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import type { Municipality, DisasterEvent, GdacsAlert } from '@/types';
import { formatAffectedPopulation } from '@/data/mockData';
import PanayMap from '@/components/PanayMap';
import GdacsAlertBanner from '@/components/GdacsAlertBanner';
import WeatherForecast from '@/components/WeatherForecast';
import EventSelectorPanel from '@/components/EventSelectorPanel';

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
  onSimulateGdacs?: (alert: GdacsAlert, tempEvent?: DisasterEvent) => void | Promise<void>;
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
  // Focus overview headline metrics on Panay Island by default (strictly Iloilo, Capiz, Aklan, and Antique = 93 LGUs)
  const PANAY_PROVINCE_SET = useMemo(() => new Set(['iloilo', 'capiz', 'aklan', 'antique']), []);

  const panayMunicipalities = useMemo(() => {
    const list = municipalities.filter((m) => {
      const prov = (m.province || '').toLowerCase().trim();
      if (prov === 'guimaras') return false;
      if (PANAY_PROVINCE_SET.has(prov)) return true;
      if (m.pcode) {
        return m.pcode.startsWith('PH06') && !m.pcode.startsWith('PH06079');
      }
      return !m.province && !m.region;
    });
    return list.length > 0 ? list : municipalities;
  }, [municipalities, PANAY_PROVINCE_SET]);

  const totalPanayLgus = panayMunicipalities.length > 0 ? panayMunicipalities.length : 93;

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



  return (
    <section id="overview" className="relative pt-20 lg:pt-24 pb-8 overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-ink-950 pointer-events-none transition-colors" />
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="absolute top-0 left-1/3 -translate-x-1/2 w-[700px] h-[320px] bg-ocean-600/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-40 right-10 w-[450px] h-[260px] bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ROW 1: Header + Summary Metrics (aligned for standard viewport visibility) */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-white/10 mb-3 animate-fade-in-up">
          {/* Header left */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-3 py-1 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-ocean-700 dark:text-ocean-200 uppercase tracking-wider">
                NASA VIIRS Nightlight Analytics · {totalPanayLgus} Panay LGUs
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Panay Island <span className="gradient-text">Power Recovery Grid</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-ink-300 mt-1 max-w-2xl">
              High-resolution satellite radiance tracking and daily restoration indexes across {totalPanayLgus} LGUs in Iloilo, Capiz, Aklan, and Antique.
            </p>
          </div>

          {/* Header right: Summary Metrics Cluster */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 shrink-0">
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label="Avg Recovery"
              value={`${avgRecovery}%`}
              accent="text-ocean-500 dark:text-ocean-300"
              badge="Island-wide"
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Restored"
              value={`${restoredCount}/${totalPanayLgus}`}
              accent="text-emerald-500 dark:text-emerald-300"
              badge="LGUs >= 90%"
            />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="Critical"
              value={criticalCount.toString()}
              accent="text-rose-500 dark:text-rose-300"
              badge="Outages < 30%"
            />
            <StatCard
              icon={<Users className="h-4 w-4" />}
              label="Affected Pop"
              value={formatAffectedPopulation(affectedPopulation)}
              accent="text-amber-500 dark:text-amber-300"
              badge="Impacted LGUs"
            />
          </div>
        </div>

        {/* Weather Forecast Mini-Widget Strip directly above GDACS telemetry bar */}
        <div className="mb-3 animate-fade-in-up" style={{ animationDelay: '0.02s' }}>
          <WeatherForecast />
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

        {/* ROW 2: Tabbed Event Selector — Historical Case Studies | Live GDACS Hazards */}
        <EventSelectorPanel
          events={events}
          activeEvent={activeEvent}
          onSelectEvent={onSelectEvent}
          onDismissEvent={onDismissEvent}
          onSimulateGdacs={onSimulateGdacs}
          importingGdacsId={importingGdacsId}
          importedEventIds={importedEventIds}
        />

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
            activeEvent={activeEvent}
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
    <div className="rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 lg:px-4 lg:py-3 card-hover border border-gray-200 dark:border-white/10 bg-white dark:bg-ink-900/80 text-gray-900 dark:text-white backdrop-blur-md flex flex-col justify-between min-w-[85px] sm:min-w-[105px] shadow-sm dark:shadow-none transition-colors">
      <div className={`flex items-center gap-1.5 mb-1 ${accent}`}>
        {icon}
        <span className="text-[10px] sm:text-[11px] font-semibold text-gray-500 dark:text-ink-400 uppercase tracking-wider truncate">
          {label}
        </span>
      </div>
      <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">{value}</p>
      <span className="text-[10px] text-gray-500 dark:text-ink-400 mt-0.5 truncate">{badge}</span>
    </div>
  );
}
