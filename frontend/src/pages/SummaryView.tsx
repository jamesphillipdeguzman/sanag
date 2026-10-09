import React, { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  TrendingUp,
  Users,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Calendar,
  Layers,
  MapPin,
  RefreshCw,
  Zap,
} from 'lucide-react';
import type { Municipality, DisasterEvent } from '@/types';
import { formatAffectedPopulation } from '@/data/mockData';
import { getStationsByProvince } from '@/data/transmissionStations';
import AiBriefingCard from '@/components/AiBriefingCard';
import { EventContextCard } from '@/components/ExecutiveBriefing';
import ErrorBoundary from '@/components/ErrorBoundary';
import PanaySilhouetteBackground from '@/components/PanaySilhouetteBackground';
import type { TabId } from '@/components/Navbar';

interface SummaryViewProps {
  municipalities: Municipality[];
  activeEvent?: DisasterEvent | null;
  events?: DisasterEvent[];
  onSelectEvent?: (id: string) => void;
  onNavigateTab?: (tab: TabId) => void;
  selectedRegionKey?: string;
  recoveryDate?: string | null;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent: string;
  badge: string;
  subtext?: string;
}

function StatCard({ icon, label, value, accent, badge, subtext }: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-4 sm:p-5 backdrop-blur-xl shadow-sm dark:shadow-md transition-all hover:border-slate-300 dark:hover:border-white/20 group">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-white/5">
          {badge}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${accent}`}>
          {value}
        </div>
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>

      {subtext && (
        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 truncate">
          {subtext}
        </p>
      )}
    </div>
  );
}

export default function SummaryView({
  municipalities = [],
  activeEvent,
  events = [],
  onSelectEvent,
  onNavigateTab,
  selectedRegionKey,
  recoveryDate,
}: SummaryViewProps) {
  // Focus headline metrics on Panay Island LGUs by default
  const PANAY_PROVINCE_SET = useMemo(() => new Set(['iloilo', 'capiz', 'aklan', 'antique']), []);
  const PANAY_PCODE_PREFIXES = useMemo(() => ['ph06004', 'ph06006', 'ph06019', 'ph06030'], []);

  const panayMunicipalities = useMemo(() => {
    const list = municipalities.filter((m) => {
      const prov = (m.province || '').toLowerCase().trim();
      if (prov) {
        return PANAY_PROVINCE_SET.has(prov);
      }
      if (m.pcode) {
        const pcodeLower = m.pcode.toLowerCase();
        return PANAY_PCODE_PREFIXES.some((prefix) => pcodeLower.startsWith(prefix));
      }
      return false;
    });
    return list.length > 0 ? list : municipalities;
  }, [municipalities, PANAY_PROVINCE_SET, PANAY_PCODE_PREFIXES]);

  const totalPanayLgus = panayMunicipalities.length > 0 ? panayMunicipalities.length : 95;

  const avgRecovery = panayMunicipalities.length > 0
    ? Math.round(
        panayMunicipalities.reduce((sum, m) => sum + m.recoveryScore, 0) /
          panayMunicipalities.length
      )
    : 0;

  const restoredCount = panayMunicipalities.filter((m) => m.status === 'restored').length;
  const criticalCount = panayMunicipalities.filter((m) => m.status === 'critical').length;

  const affectedPopulation = useMemo(() => {
    const affectedLGUs = panayMunicipalities.filter(
      (m) =>
        m.status === 'critical' ||
        m.status === 'warning' ||
        (m.recoveryScore !== undefined && m.recoveryScore < 60)
    );
    if (affectedLGUs.length > 0) {
      return affectedLGUs.reduce((sum, m) => sum + (m.population || 0), 0);
    }
    const unrestored = panayMunicipalities.filter((m) => m.status !== 'restored');
    if (unrestored.length > 0) {
      return unrestored.reduce((sum, m) => sum + (m.population || 0), 0);
    }
    return activeEvent?.affectedPopulation || 0;
  }, [panayMunicipalities, activeEvent?.affectedPopulation]);

  const stationsByProvince = useMemo(() => {
    return getStationsByProvince();
  }, []);

  return (
    <section id="summary" className="relative pb-16 overflow-hidden animate-fade-in">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-[#090d16] pointer-events-none transition-colors" />
      <div className="absolute inset-0 grid-bg opacity-25 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[600px] h-[300px] bg-emerald-500/10 dark:bg-emerald-500/8 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-[500px] h-[300px] bg-ocean-500/10 dark:bg-cyan-500/8 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-8">
        {/* Header Block with Breadcrumbs & Action Controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                Step 04 · Executive Synthesis & AI Situational Intelligence
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
              Executive Synthesis & Situational Briefing
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Consolidated high-level power restoration totals across {totalPanayLgus} LGUs paired with LLM-synthesized disaster telemetry.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab?.('recovery')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
              <span>Step 3: Recovery Curves</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab?.('map')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition-all cursor-pointer shadow-sm"
            >
              <span>Inspect Map</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* TOP: Island-Wide KPI Metrics Cards Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Island-Wide Telemetry KPIs
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Panay Grid · {totalPanayLgus} Monitored LGUs
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<Activity className="h-5 w-5 text-cyan-500" />}
              label="Average Recovery"
              value={`${avgRecovery}%`}
              accent="text-cyan-600 dark:text-cyan-300"
              badge="Island-wide"
              subtext="Aggregated radiance restoration index"
            />
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
              label="Restored LGUs"
              value={`${restoredCount} / ${totalPanayLgus}`}
              accent="text-emerald-600 dark:text-emerald-300"
              badge="≥ 90% Recovered"
              subtext="LGUs at near-normal nighttime light"
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5 text-rose-500" />}
              label="Critical Deficit"
              value={criticalCount.toString()}
              accent="text-rose-600 dark:text-rose-300"
              badge="< 60% Outages"
              subtext="Severe blackout jurisdictions"
            />
            <StatCard
              icon={<Users className="h-5 w-5 text-amber-500" />}
              label="Affected Population"
              value={formatAffectedPopulation(affectedPopulation)}
              accent="text-amber-600 dark:text-amber-300"
              badge="Impact Zone"
              subtext="Citizens in affected municipal grids"
            />
          </div>
        </div>

        {/* TRANSMISSION & SUBSTATION INFRASTRUCTURE */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Transmission & Substation Infrastructure
              </h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              14 Active Stations · 187 Monitored LGUs
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
              {stationsByProvince.map((group) => (
                <div
                  key={group.province}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 p-3 sm:p-3.5 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200/60 dark:border-slate-800/60">
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                        {group.province}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      {group.active_count} / {group.count} Active
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {group.stations.map((station) => (
                      <div
                        key={station.id}
                        className="rounded-lg bg-white/90 dark:bg-slate-900/80 border border-slate-200/60 dark:border-slate-800/60 p-2.5 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-1">
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {station.name}
                            </h4>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {station.operator}
                            </p>
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                              station.operationalStatus === 'Energized'
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                : station.operationalStatus === 'Islanded'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : station.operationalStatus === 'Tripped'
                                ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40'
                            }`}
                          >
                            {station.operationalStatus || 'Energized'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-slate-100 dark:border-slate-800/60 text-slate-500 dark:text-slate-400">
                          <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                            {station.voltage}
                          </span>
                          <span className="truncate max-w-[140px] text-right" title={station.coverage?.join(', ')}>
                            {station.coverage?.join(', ') || 'District Grid'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE: Active Disaster Event Context Badge with Incident Parameters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Active Incident Context & Baseline Drivers
              </h2>
            </div>
            {activeEvent && (
              <span className="text-xs text-slate-400 font-mono">
                Event ID: {activeEvent.id}
              </span>
            )}
          </div>

          <EventContextCard event={activeEvent} variant="full" />
        </div>

        {/* BOTTOM: AI Situational Briefing Container (Gemini synthesis, structured vs markdown view toggle, and regeneration controls) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-500" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Automated Gemini Situational Intelligence
              </h2>
            </div>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Powered by Google Gemini Flash & NASA VIIRS Daily Passes
            </span>
          </div>

          <ErrorBoundary name="Executive AI Situational Briefing" resetKey={activeEvent?.id}>
            <AiBriefingCard event={activeEvent} municipalities={panayMunicipalities} />
          </ErrorBoundary>
        </div>

        {/* Continuity Flow: Bottom Navigation Anchor */}
        <div className="pt-6 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Completed analysis steps 1 through 4.</span>
            <span>·</span>
            <button
              type="button"
              onClick={() => onNavigateTab?.('home')}
              className="text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
            >
              Return to Home Launchpad
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab?.('guide')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer font-semibold"
            >
              View Guide & Glossary →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
