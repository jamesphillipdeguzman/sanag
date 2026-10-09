import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Satellite,
  Activity,
  Layers,
  Sparkles,
  Zap,
  Globe,
  Radio,
  Clock,
  Compass,
  Building2,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Info
} from 'lucide-react';

interface GuideGlossaryProps {
  onNavigateTab?: (tab: 'overview' | 'map' | 'recovery' | 'events') => void;
}

interface GlossaryItem {
  id: string;
  term: string;
  shortName?: string;
  category: 'satellite' | 'metric' | 'governance';
  definition: string;
  details?: string;
  formula?: string;
  tags: string[];
}

const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    id: 'viirs',
    term: 'VIIRS',
    shortName: 'Visible Infrared Imaging Radiometer Suite',
    category: 'satellite',
    definition: 'Multispectral radiometer sensor aboard Suomi NPP and NOAA-20 polar-orbiting satellites capturing calibrated nocturnal surface emissions across planetary grids at 750m resolution.',
    details: 'Equipped with on-board calibration systems, VIIRS operates in a sun-synchronous orbit with daily 1:30 AM equatorial overpasses, allowing cloud-filtered nocturnal radiance monitoring without daylight reflection interference.',
    tags: ['Sensor', 'NASA / NOAA', 'Satellite'],
  },
  {
    id: 'dnb',
    term: 'DNB',
    shortName: 'Day-Night Band',
    category: 'satellite',
    definition: 'Ultra-sensitive panchromatic spectral band (500–900 nm) on VIIRS capable of detecting low-light night-sky emissions, artificial human illumination, and electrical power grids.',
    details: 'Its dynamic range spans over 7 orders of magnitude, capturing everything from faint city streetlights to intense gas flares, lightning, and complete disaster blackout footprints.',
    tags: ['Panchromatic', 'Low-Light', 'Calibration'],
  },
  {
    id: 'radiance',
    term: 'Radiance',
    shortName: 'nW · cm⁻² · sr⁻¹',
    category: 'metric',
    formula: 'nW \\cdot cm^{-2} \\cdot sr^{-1}',
    definition: 'NanoWatts per square centimeter steradian; the physical spectral quantity measuring nightlight surface brightness emitted towards the satellite aperture.',
    details: 'Normal urban centers typically register 20–80+ nW·cm⁻²·sr⁻¹, while rural municipalities emit 1–8 nW·cm⁻²·sr⁻¹. Severe power outages cause near-zero post-impact readings.',
    tags: ['Physical Metric', 'Luminosity', 'Energy Density'],
  },
  {
    id: 'baseline-radiance',
    term: 'Baseline Radiance',
    shortName: 'Pre-Disaster Median',
    category: 'metric',
    definition: 'Cloud-free, lunar-corrected median pre-disaster luminosity used as the normal operating reference (100% benchmark) for each specific municipality.',
    details: 'Aggregated over stable pre-event observation windows, removing moonlight scattering and episodic cloud occlusions to establish reliable normative energy benchmarks.',
    tags: ['Reference', 'Normalization', 'Benchmark'],
  },
  {
    id: 'recovery-score',
    term: 'Recovery Score',
    shortName: 'R(t) = 0–100%',
    category: 'metric',
    formula: 'R(t) = \\min\\left(100, \\frac{\\text{Radiance}_{\\text{post}}}{\\text{Radiance}_{\\text{base}}} \\times 100\\right)',
    definition: 'Post-impact observed radiance divided by baseline radiance. Values ≥ 90% indicate benchmark restoration; < 60% indicate critical deficits / blackout clusters.',
    details: 'Color-coded into 3 official operational tiers: Near-Full Recovery (≥90%, Emerald), Active Restoration (60–89%, Amber), and Critical Deficit (<60%, Red).',
    tags: ['Performance', 'Index', 'Restoration'],
  },
  {
    id: 'day-0',
    term: 'Day-0',
    shortName: 'Event Onset Timestamp',
    category: 'metric',
    definition: 'The critical timestamp when peak hazard forces (cyclone landfall, earthquake tremor, or transmission trip) cause primary electrical grid collapse.',
    details: 'All comparative recovery curves and restoration trajectories are indexed relative to Day-0 (T+0d, T+3d, T+7d, T+14d, T+30d) for standardized longitudinal analysis.',
    tags: ['Timeline', 'Disaster Onset', 'Temporal Index'],
  },
  {
    id: 'lgu',
    term: 'LGU',
    shortName: 'Local Government Unit',
    category: 'governance',
    definition: 'Municipalities, component cities, and provincial administrations in the Philippines (e.g., the 95 LGUs of Panay Island across Iloilo, Capiz, Aklan, Antique).',
    details: 'Each LGU possesses a standardized Philippine Standard Geographic Code (PSGC/PCode) that SANAG maps with sub-district GeoJSON polygons to calculate localized recovery rates.',
    tags: ['Administration', 'Municipalities', 'PCode / PSGC'],
  },
  {
    id: 'gdacs',
    term: 'GDACS',
    shortName: 'Global Disaster Alert and Coordination System',
    category: 'governance',
    definition: 'Real-time multi-hazard alerting framework operated by the United Nations and the European Commission providing near real-time disaster alerts and impact zones.',
    details: 'SANAG ingests live GDACS feeds for Tropical Cyclones (TC), Floods (FL), Earthquakes (EQ), and Power Grid Failures (POW), enabling immediate automated radiance monitoring simulations.',
    tags: ['United Nations', 'Real-time Telemetry', 'Multi-hazard'],
  },
  {
    id: 'electric-coops',
    term: 'Electric Cooperatives',
    shortName: 'Distribution Utilities',
    category: 'governance',
    definition: 'Non-profit distribution utilities operating on Panay Island: ILECO I, II, III for Iloilo, CAPELCO for Capiz, AKELCO for Aklan, and ANTECO for Antique.',
    details: 'These entities manage local distribution feeder lines connected to the NGCP 138kV transmission backbone. SANAG provides feeder-level insights into which franchise areas face persistent outages.',
    tags: ['ILECO', 'CAPELCO', 'AKELCO', 'ANTECO'],
  },
];

export default function GuideGlossary({ onNavigateTab }: GuideGlossaryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'satellite' | 'metric' | 'governance'>('all');

  const filteredGlossary = useMemo(() => {
    return GLOSSARY_ITEMS.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.term.toLowerCase().includes(q) ||
        (item.shortName && item.shortName.toLowerCase().includes(q)) ||
        item.definition.toLowerCase().includes(q) ||
        (item.details && item.details.toLowerCase().includes(q)) ||
        item.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [searchTerm, activeCategory]);

  return (
    <div className="w-full py-2 sm:py-4 animate-fade-in-up">
      {/* Header introduction banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl p-5 sm:p-7 mb-8 shadow-sm dark:shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-ocean-500/10 via-emerald-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-ocean-500/30 bg-ocean-500/10 px-3 py-1 mb-2.5">
              <BookOpen className="h-3.5 w-3.5 text-ocean-600 dark:text-ocean-300" />
              <span className="text-[11px] font-semibold text-ocean-700 dark:text-ocean-200 uppercase tracking-wider">
                Documentation & Analytical Standards
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Platform Guide & <span className="gradient-text">Disaster Analytics Glossary</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
              Understand how SANAG leverages NASA VIIRS Earth observation radiometry to calculate post-disaster power grid restoration curves and guide emergency response operations across the Philippines.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab?.('overview')}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>Back to Overview</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main two-column educational layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* COLUMN 1: Platform Walkthrough / How to Use (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ocean-500/10 border border-ocean-500/30 text-ocean-500">
                <Compass className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Platform Walkthrough
              </h3>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">4-Step Workflow</span>
          </div>

          {/* Step 1 */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5 shadow-sm dark:shadow-md hover:border-ocean-500/40 transition-all group">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ocean-500/10 border border-ocean-500/30 text-ocean-600 dark:text-ocean-400 font-black text-sm group-hover:scale-105 transition-transform">
                01
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-ocean-500 dark:group-hover:text-ocean-300 transition-colors">
                    Select a Disaster Event or Live Hazard
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-ocean-600 dark:text-ocean-400 px-2 py-0.5 rounded-full bg-ocean-500/10 border border-ocean-500/20">
                    Step 1
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Choose from landmark historical events (e.g., <strong className="text-slate-800 dark:text-slate-100">Jan 2024 Panay Blackout</strong>, <strong className="text-slate-800 dark:text-slate-100">Super Typhoon Carina</strong>, or <strong className="text-slate-800 dark:text-slate-100">Typhoon Ursula</strong>) or ingest real-time multi-hazard telemetry from the live UN GDACS feed.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('events')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-ocean-600 dark:text-ocean-400 hover:underline cursor-pointer"
                  >
                    <span>Browse Disaster Events Tab</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5 shadow-sm dark:shadow-md hover:border-emerald-500/40 transition-all group">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black text-sm group-hover:scale-105 transition-transform">
                02
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-300 transition-colors">
                    Inspect Day-0 Radiance Drops on the Map
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    Step 2
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Open the interactive Philippine Satellite Grid map to inspect municipality-level blackout severity. Darkened polygons immediately identify LGUs with severe radiance collapse (&lt;60% recovery) on Day-0.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('map')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    <span>Open Satellite Grid Map</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5 shadow-sm dark:shadow-md hover:border-blue-500/40 transition-all group">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-black text-sm group-hover:scale-105 transition-transform">
                03
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors">
                    Compare Utility & Cooperative Curves
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">
                    Step 3
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Navigate to the Recovery Grid tab to analyze longitudinal restoration rates across franchise territories (ILECO I/II/III, CAPELCO, AKELCO, ANTECO). Sort LGUs by the Municipal Resilience Index.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('recovery')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <span>View Comparative Recovery Curves</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/60 p-5 shadow-sm dark:shadow-md hover:border-amber-500/40 transition-all group">
            <div className="flex items-start gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-black text-sm group-hover:scale-105 transition-transform">
                04
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-500 dark:group-hover:text-amber-300 transition-colors">
                    Review Executive AI Situational Briefings
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
                    Step 4
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                  Generate instant AI executive summaries powered by Gemini 2.0 Flash. Synthesizes satellite radiance drops, weather forecast headwinds, and critical utility outages into actionable recommendations.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onNavigateTab?.('overview')}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    <span>Inspect AI Situational Briefing</span>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: Disaster Analytics Glossary (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          {/* Section header + Search bar + Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                <Satellite className="h-4 w-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Disaster Analytics Glossary
              </h3>
            </div>

            {/* Category filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { id: 'all', label: `All (${GLOSSARY_ITEMS.length})` },
                { id: 'satellite', label: 'Satellite & Physics' },
                { id: 'metric', label: 'Metrics & Scoring' },
                { id: 'governance', label: 'Grid & LGUs' },
              ].map((cat) => {
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id as any)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${isActive
                      ? 'bg-emerald-500 text-white font-semibold shadow-sm shadow-emerald-500/20 border border-emerald-400/40'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border dark:border-slate-700/50'
                      }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search concepts (e.g. VIIRS, Radiance, Recovery Score, LGU, ILECO)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/90 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/40 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Glossary cards list */}
          <div className="flex flex-col gap-3.5 max-h-[720px] overflow-y-auto pr-1">
            {filteredGlossary.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <Info className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                <p className="text-sm font-medium">No glossary terms match "{searchTerm}"</p>
                <button
                  type="button"
                  onClick={() => { setSearchTerm(''); setActiveCategory('all'); }}
                  className="mt-2 text-xs text-ocean-600 dark:text-ocean-400 underline font-semibold cursor-pointer"
                >
                  Clear search filters
                </button>
              </div>
            ) : (
              filteredGlossary.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white/95 dark:bg-slate-900/70 p-4 sm:p-5 shadow-sm dark:shadow-md hover:border-slate-300 dark:hover:border-white/20 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                        {item.term}
                      </h4>
                      {item.shortName && (
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          ({item.shortName})
                        </span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md font-bold tracking-wider ${item.category === 'satellite'
                        ? 'bg-ocean-500/15 text-ocean-700 dark:text-ocean-300 border border-ocean-500/30'
                        : item.category === 'metric'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                        }`}
                    >
                      {item.category}
                    </span>
                  </div>

                  <p className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                    {item.definition}
                  </p>

                  {item.formula && (
                    <div className="mt-2.5 p-2 rounded-lg bg-slate-100 dark:bg-black/50 border border-slate-200 dark:border-white/5 font-mono text-xs text-ocean-700 dark:text-ocean-300">
                      {item.formula}
                    </div>
                  )}

                  {item.details && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed border-t border-slate-100 dark:border-white/5 pt-2">
                      {item.details}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-1">
                    {item.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 px-2 py-0.5 rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
