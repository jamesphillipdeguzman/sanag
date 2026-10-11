import React, { useMemo, useState } from 'react';
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
  ChevronDown,
} from 'lucide-react';
import type { Municipality, DisasterEvent } from '@/types';
import { formatAffectedPopulation } from '@/data/mockData';
import { getStationsByProvince } from '@/data/transmissionStations';
import AiBriefingCard from '@/components/AiBriefingCard';
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
  selectedMunicipality?: Municipality | null;
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
  selectedMunicipality,
}: SummaryViewProps) {
  // Focus headline metrics on Panay Island LGUs by default
  const PANAY_PROVINCE_SET = useMemo(() => new Set(['iloilo', 'capiz', 'aklan', 'antique']), []);
  const PANAY_PCODE_PREFIXES = useMemo(() => ['ph0604', 'ph0606', 'ph0619', 'ph0630'], []);

  const panayMunicipalities = useMemo(() => {
    // 1. If an individual municipality is selected (e.g. Agoncillo on the map),
    // scope to that municipality and its province
    if (selectedMunicipality) {
      const muniName = (selectedMunicipality.name || '').toLowerCase();
      const muniPcode = (selectedMunicipality.pcode || '').toLowerCase();
      const muniProv = (selectedMunicipality.province || '').toLowerCase();

      const matched = municipalities.filter((m) => {
        if (muniProv && (m.province || '').toLowerCase() === muniProv) return true;
        if (muniName && (m.name || '').toLowerCase() === muniName) return true;
        if (muniPcode && (m.pcode || '').toLowerCase() === muniPcode) return true;
        return false;
      });

      if (matched.length > 0) return matched;
    }

    // 2. If the active event defined critical/impacted LGUs, scope to those
    const criticalList = activeEvent?.critical_municipalities ?? [];
    if (criticalList.length > 0) {
      const targetPcodes = new Set(
        criticalList.map((c: any) => (c.pcode || c.code || '').toLowerCase()).filter(Boolean)
      );
      const targetNames = new Set(
        criticalList.map((c: any) => (c.name || '').toLowerCase()).filter(Boolean)
      );

      const eventMatched = municipalities.filter(
        (m) =>
          (m.pcode && targetPcodes.has(m.pcode.toLowerCase())) ||
          (m.name && targetNames.has(m.name.toLowerCase()))
      );
      if (eventMatched.length > 0) return eventMatched;
    }

    // 3. If a region or province dropdown key is selected
    if (selectedRegionKey && selectedRegionKey !== 'all') {
      const regMatched = municipalities.filter(
        (m) => (m.province || '').toLowerCase() === selectedRegionKey.toLowerCase()
      );
      if (regMatched.length > 0) return regMatched;
    }

    // 4. Default baseline: Panay Island filter
    const defaultGrid = municipalities.filter((m) => {
      const prov = (m.province || '').toLowerCase().trim();
      if (prov) return PANAY_PROVINCE_SET.has(prov);
      if (m.pcode) {
        const pcodeLower = m.pcode.toLowerCase();
        return PANAY_PCODE_PREFIXES.some((prefix) => pcodeLower.startsWith(prefix));
      }
      return false;
    });

    return defaultGrid.length > 0 ? defaultGrid : municipalities;
  }, [
    municipalities,
    activeEvent,
    selectedMunicipality,
    selectedRegionKey,
    PANAY_PROVINCE_SET,
    PANAY_PCODE_PREFIXES,
  ]);

  const isPanayScope = useMemo(() => {
    if (panayMunicipalities.length === 0) return true;
    return panayMunicipalities.every((m) => {
      const prov = (m.province || '').toLowerCase().trim();
      return prov ? PANAY_PROVINCE_SET.has(prov) : true;
    });
  }, [panayMunicipalities, PANAY_PROVINCE_SET]);

  const totalPanayLgus = panayMunicipalities.length > 0 ? panayMunicipalities.length : 95;

  const avgRecovery = panayMunicipalities.length > 0
    ? Math.round(
      panayMunicipalities.reduce((sum, m) => sum + (m.recoveryScore ?? 0), 0) /
      panayMunicipalities.length
    )
    : 0;

  const restoredCount = panayMunicipalities.filter((m) => m.status === 'restored').length;
  const criticalCount = panayMunicipalities.filter((m) => m.status === 'critical').length;

  const affectedPopulation = useMemo(() => {
    const affectedLGUs = panayMunicipalities.filter((m) => {
      const score = m.recoveryScore != null
        ? (m.recoveryScore > 1 ? m.recoveryScore : m.recoveryScore * 100)
        : 100;
      return m.status === 'critical' || m.status === 'warning' || score < 60;
    });

    if (affectedLGUs.length > 0) {
      return affectedLGUs.reduce((sum, m) => sum + (m.population || 0), 0);
    }

    return 0;
  }, [panayMunicipalities]);

  const stationsByProvince = useMemo(() => {
    return getStationsByProvince();
  }, []);



  // Collapsed by default: empty record
  const [expandedProvinces, setExpandedProvinces] = useState<Record<string, boolean>>({});

  const toggleProvince = (provinceName: string) => {
    setExpandedProvinces((prev) => ({
      ...prev,
      [provinceName]: !prev[provinceName],
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    stationsByProvince.forEach((group) => {
      allExpanded[group.province] = true;
    });
    setExpandedProvinces(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedProvinces({});
  };

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
              {panayMunicipalities.some(m => (m.province || '').toLowerCase().includes('batangas'))
                ? 'Batangas Grid'
                : 'Panay Grid'} · {totalPanayLgus} Monitored LGUs
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
        {isPanayScope && (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-500" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Transmission & Substation Infrastructure
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  14 Active Stations · 187 Monitored LGUs
                </span>
                <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">·</span>
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={handleExpandAll}
                    className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors cursor-pointer"
                  >
                    Expand All
                  </button>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={handleCollapseAll}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-lg backdrop-blur-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 items-start">
                {stationsByProvince.map((group) => {
                  const isExpanded = !!expandedProvinces[group.province];
                  return (
                    <div
                      key={group.province}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 p-3 sm:p-3.5 flex flex-col transition-all"
                    >
                      {/* Collapsible Header Button */}
                      <button
                        type="button"
                        onClick={() => toggleProvince(group.province)}
                        className="flex items-center justify-between w-full text-left p-1 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition group cursor-pointer"
                        aria-expanded={isExpanded}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                          <span className="font-bold text-xs sm:text-sm uppercase tracking-wider text-slate-800 dark:text-slate-100 group-hover:text-amber-500 dark:group-hover:text-amber-400 transition-colors">
                            {group.province}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Active badge */}
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 shrink-0">
                            {group.active_count} / {group.count} Active
                          </span>

                          {/* Animated Chevron Indicator */}
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-180 text-amber-500 dark:text-amber-400' : ''
                              }`}
                          />
                        </div>
                      </button>

                      {/* Collapsible Content: Substation Cards List */}
                      {isExpanded && (
                        <div className="mt-3 space-y-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800/60 transition-all duration-200 animate-fade-in">
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
                                  className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${station.operationalStatus === 'Energized'
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        )}

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

        {/* Step 4 Sequential Back / Next Navigation */}
        <div className="pt-6 border-t border-slate-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => onNavigateTab?.('recovery')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm shadow-sm transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer"
          >
            <span>← Step 3: Recovery</span>
          </button>
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left order-first sm:order-none">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Step 4 Complete</span>
            <span className="mx-2">·</span>
            <span>Executive KPIs & AI Briefing Synthesized</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab?.('guide')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer shrink-0"
          >
            <span>Methodology Guide →</span>
          </button>
        </div>
      </div>
    </section>
  );
}
