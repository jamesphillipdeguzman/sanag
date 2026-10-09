import React, { useMemo } from 'react';
import {
  Satellite,
  Compass,
  ArrowRight,
  Sparkles,
  Zap,
  Globe,
  Radio,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  MapPin,
  Flame,
  Activity,
  Layers,
} from 'lucide-react';
import type { DisasterEvent, GdacsAlert, Municipality } from '@/types';
import WeatherForecast from '@/components/WeatherForecast';
import GdacsAlertBanner from '@/components/GdacsAlertBanner';
import UserJourneyStepper from '@/components/UserJourneyStepper';
import PanaySilhouetteBackground from '@/components/PanaySilhouetteBackground';
import type { TabId } from '@/components/Navbar';

export interface HomeViewProps {
  activeEvent?: DisasterEvent | null;
  events?: DisasterEvent[];
  onSelectEvent?: (id: string) => void;
  onNavigateTab?: (tab: TabId) => void;
  selectedRegionKey?: string;
  selectedMunicipality?: Municipality | null;
  selectedId?: string | null;
  gdacsAlerts?: GdacsAlert[];
  onSimulateGdacs?: (alert: GdacsAlert) => void | Promise<void>;
  isGdacsLoading?: boolean;
  onRefreshGdacs?: () => void;
  importingGdacsId?: string | null;
  importedEventIds?: Set<string>;
  totalLgusCount?: number;
  activeStationsCount?: number;
}

export default function HomeView({
  activeEvent,
  events = [],
  onSelectEvent,
  onNavigateTab,
  selectedRegionKey,
  selectedMunicipality,
  selectedId,
  gdacsAlerts = [],
  onSimulateGdacs,
  isGdacsLoading = false,
  onRefreshGdacs,
  importingGdacsId = null,
  importedEventIds = new Set(),
  totalLgusCount = 95,
  activeStationsCount = 19,
}: HomeViewProps) {
  return (
    <section id="home" className="relative pb-20 overflow-hidden animate-fade-in">
      {/* Visual Tone & Atmosphere: obsidian/slate #090d16 with ambient glows */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-[#090d16] pointer-events-none transition-colors" />
      <div className="absolute inset-0 grid-bg opacity-20 pointer-events-none" />

      {/* Subtle Warm Gold & Starlight Cyan Ambient Glow Orbs */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-cyan-500/[0.07] dark:bg-cyan-400/[0.06] blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-48 right-10 w-[500px] h-[350px] bg-amber-500/[0.06] dark:bg-amber-400/[0.05] blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-96 left-12 w-[550px] h-[350px] bg-emerald-500/[0.05] dark:bg-emerald-400/[0.04] blur-[140px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10 flex flex-col gap-10">
        {/* ========================================================================= */}
        {/* HERO SECTION & NARRATIVE HOOK                                             */}
        {/* ========================================================================= */}
        <div className="relative rounded-3xl border border-slate-200/80 dark:border-slate-800/70 bg-white/70 dark:bg-slate-900/40 p-6 sm:p-10 lg:p-12 backdrop-blur-2xl shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.25)] overflow-hidden">
          {/* Background Nightlight Silhouette & Photon Scatter */}
          <div className="absolute inset-0 opacity-20 dark:opacity-30 pointer-events-none flex items-center justify-end overflow-hidden pr-6">
            <div className="w-[380px] h-[380px] sm:w-[480px] sm:h-[480px]">
              <PanaySilhouetteBackground />
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column (lg:col-span-7) */}
            <div className="lg:col-span-7 flex flex-col items-start">
              {/* Badge / Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-500/10 px-3.5 py-1 mb-4">
                <span className="text-cyan-500 dark:text-cyan-400 font-bold text-xs">✦</span>
                <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-300 uppercase tracking-widest">
                  SATELLITE RADIANCE & DISASTER ANALYTICS
                </span>
              </div>

              {/* Provocative Hook */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-[1.15] mb-4">
                What if we could pinpoint electrical grid collapse{' '}
                <span className="gradient-text">before field reports even arrive?</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-8 max-w-2xl">
                SANAG transforms NOAA VIIRS nightlight telemetry and NASA Black Marble data into near-real-time visibility on blackout zones, municipal restoration speeds, and vulnerable communities across Panay Island and beyond.
              </p>

              {/* Action Buttons & Current Event Context Banner */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('events')}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-cyan-600/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <span>Step 1: Choose Disaster Event</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onNavigateTab?.('map')}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300/80 dark:border-slate-700/80 bg-white/80 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-sm"
                >
                  <Globe className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                  <span>Inspect Spatial Grid (Step 2)</span>
                </button>

                {activeEvent && (
                  <div className="w-full sm:w-auto flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs font-semibold backdrop-blur-md">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    <span className="text-slate-500 dark:text-slate-400">Baseline:</span>
                    <span className="truncate max-w-[200px] font-bold text-slate-900 dark:text-white">
                      {activeEvent.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">({activeEvent.date})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column (lg:col-span-5): Visual stage container hosting sanag-hero.webp */}
            <div className="lg:col-span-5 relative flex items-center justify-center p-2 sm:p-4 overflow-hidden rounded-2xl">
              {/* Soft ambient background glow */}
              <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Hero Image */}
              <img
                src="/sanag-hero.webp"
                alt="Satellite earth radiance scanning visualization"
                className="relative z-10 w-full max-w-[440px] lg:max-w-none h-auto object-contain select-none drop-shadow-[0_12px_40px_rgba(6,182,212,0.18)]"
                width={1200}
                height={896}
                loading="eager"
              />

              {/* Subtle shooting star orbital streak */}
              <span className="shooting-star pointer-events-none" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SLIM ENVIRONMENTAL RIBBON (Weather + Live GDACS Ticker)                  */}
        {/* ========================================================================= */}
        <div className="relative z-10 w-full">
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl shadow-xs">
            {/* Left: Weather Forecast Mini-Pill Strip */}
            <div className="flex-1 min-w-0">
              <WeatherForecast
                selectedRegionKey={selectedRegionKey}
                selectedMunicipality={selectedMunicipality}
                selectedId={selectedId}
              />
            </div>

            {/* Right: Live GDACS Hazard Alert Banner */}
            <div className="flex-1 min-w-0 border-t xl:border-t-0 xl:border-l border-slate-200/80 dark:border-slate-800/80 pt-2 xl:pt-0 xl:pl-3">
              <GdacsAlertBanner
                alerts={gdacsAlerts}
                isLoading={isGdacsLoading}
                onRefresh={onRefreshGdacs}
                onImport={onSimulateGdacs}
                importingId={importingGdacsId}
                activeEventId={activeEvent?.id}
                importedEventIds={importedEventIds}
                onSelectEvent={onSelectEvent}
                events={events}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4-STEP INTERACTIVE USER ROADMAP                                           */}
        {/* ========================================================================= */}
        <div className="relative z-10 w-full pt-2">
          <UserJourneyStepper onNavigateTab={onNavigateTab} />
        </div>

        {/* ========================================================================= */}
        {/* PLATFORM ARCHITECTURE & SATELLITE PILLARS                                */}
        {/* ========================================================================= */}
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md">
            <div className="flex items-center gap-2.5 mb-2.5 text-cyan-600 dark:text-cyan-400">
              <Satellite className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                500m VIIRS Day/Night Band
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              NOAA-20 and Suomi NPP orbital sensors detect nighttime radiant emissions down to nanowatts per square centimeter, isolating true electric outages from cloud attenuation.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md">
            <div className="flex items-center gap-2.5 mb-2.5 text-violet-600 dark:text-violet-400">
              <TrendingUp className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                R_t Restoration Metrics
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Empirical recovery indexing benchmarks post-event radiance against undisturbed baseline nights, segmenting critical deficits (&lt;60%) from active cooperative restoration.
            </p>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/60 dark:bg-slate-900/40 backdrop-blur-md">
            <div className="flex items-center gap-2.5 mb-2.5 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Gemini Situational AI
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Google Gemini 2.0 Flash synthesizes multi-LGU radiance loss, population impact, and electric cooperative timelines into actionable executive briefs.
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* QUICK EXPLORATION FOOTNOTE & GUIDE LINK                                  */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-slate-100/60 dark:bg-slate-900/30 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {totalLgusCount} LGUs Monitored
            </span>
            <span>·</span>
            <span>{activeStationsCount} Active Transmission Nodes</span>
            <span>·</span>
            <span>GDACS Multi-Hazard Calibration</span>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab?.('guide')}
            className="inline-flex items-center gap-1.5 font-semibold text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
          >
            <span>Read Methodology Guide & Glossary</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
