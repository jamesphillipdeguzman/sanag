import React from 'react';
import type { Municipality, DisasterEvent } from '@/types';
import {
  Wind,
  Zap,
  Activity,
  Info,
  Layers,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Flame,
} from 'lucide-react';
import AiBriefingCard from './AiBriefingCard';

interface EventContextCardProps {
  event?: DisasterEvent | null;
  className?: string;
  variant?: 'compact' | 'full';
}

/**
 * Standardized root-cause metadata fallback resolver for historical Panay disasters
 */
export function resolveEventContext(event?: DisasterEvent | null) {
  const id = (event?.id || '').toLowerCase();
  const name = (event?.name || '').toLowerCase();
  const rawCat = (event?.category || '').toLowerCase();
  const rawType = (event?.type || '').toLowerCase();

  let eventType = event?.event_type;
  let disasterCategory = event?.disaster_category;
  let rootCauseSummary = event?.root_cause_summary;
  let infrastructureImpact = event?.infrastructure_impact;

  if (
    id.includes('volcano') ||
    id.includes('eruption') ||
    id.includes('taal') ||
    id.includes('mayon') ||
    id.includes('kanlaon') ||
    id.includes('bulusan') ||
    name.includes('volcano') ||
    name.includes('eruption') ||
    name.includes('taal') ||
    name.includes('mayon') ||
    name.includes('kanlaon') ||
    name.includes('bulusan') ||
    rawCat.includes('volcan') ||
    rawCat.includes('eruption') ||
    rawCat === 'vo' ||
    rawType === 'volcano' ||
    rawType === 'vo'
  ) {
    eventType = eventType || 'Volcanic Eruption';
    disasterCategory = disasterCategory || 'Volcanic Eruption';
    rootCauseSummary =
      rootCauseSummary ||
      'Heavy tephra/ashfall accumulation on sub-transmission insulators causing flashover trips, acidic ash corrosion, and visibility-restricted emergency repair corridors.';
    infrastructureImpact =
      infrastructureImpact ||
      'De-energization and high-pressure water washing of substation transformer bushings and insulator strings to clear conductive ash deposits before safe re-energization.';
  } else if (id.includes('kalmaegi') || name.includes('kalmaegi') || name.includes('tino')) {
    eventType = eventType || 'Tropical Cyclone';
    disasterCategory = disasterCategory || 'Category 3 Landfall';
    rootCauseSummary =
      rootCauseSummary ||
      'High sustained winds exceeding 185 km/h, widespread fallen distribution poles, localized flooding of low-lying substations, and severe line-clearing obstructions across coastal and northern corridors.';
    infrastructureImpact =
      infrastructureImpact ||
      'Physical distribution grid damage requiring heavy on-the-ground hardware replacement; recovery follows a gradual, step-wise restoration curve over multiple observation cycles.';
  } else if (
    id.includes('collapse') ||
    id.includes('blackout') ||
    id.includes('grid') ||
    name.includes('grid collapse') ||
    name.includes('blackout')
  ) {
    eventType = eventType || 'Grid Disturbance / Frequency Trip';
    disasterCategory = disasterCategory || 'Cascading System Separation';
    rootCauseSummary =
      rootCauseSummary ||
      'Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.';
    infrastructureImpact =
      infrastructureImpact ||
      'Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate.';
  } else if (id.includes('odette') || id.includes('rai') || name.includes('odette') || name.includes('rai')) {
    eventType = eventType || 'Super Typhoon';
    disasterCategory = disasterCategory || 'Category 5 Landfall';
    rootCauseSummary =
      rootCauseSummary ||
      'Catastrophic transmission tower toppling, severed high-voltage backbone interconnects, and total regional blackout footprint extending across Visayan provinces.';
    infrastructureImpact =
      infrastructureImpact ||
      'Long-term grid reconstruction requiring emergency temporary bypass towers; persistent, weeks-long multi-LGU critical deficit.';
  } else if (id.includes('trami') || name.includes('kristine')) {
    eventType = eventType || 'Severe Tropical Storm';
    disasterCategory = disasterCategory || 'High-Volume Monsoon Inundation';
    rootCauseSummary =
      rootCauseSummary ||
      'Unprecedented continuous precipitation, inundated low-lying substations, and widespread transmission right-of-way landslides across river basins.';
    infrastructureImpact =
      infrastructureImpact ||
      'Substation water-logging and precautionary sectional feeder isolations; rapid recovery as floodwaters recede followed by equipment drying.';
  } else if (id.includes('carina') || id.includes('habagat')) {
    eventType = eventType || 'Southwest Monsoon / Tropical Cyclone';
    disasterCategory = disasterCategory || 'Monsoon Flooding & Landslide';
    rootCauseSummary =
      rootCauseSummary ||
      'Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.';
    infrastructureImpact =
      infrastructureImpact ||
      'Localized feeder trips and pole destabilization in saturated soils; moderate recovery timeline.';
  } else {
    // Avoid defaulting unmapped types strictly to 'Tropical Cyclone'
    const isCyclone = rawType.includes('typhoon') || rawType.includes('cyclone') || rawCat.includes('cyclone') || rawCat.includes('typhoon');
    const isEarthquake = rawType.includes('earthquake') || rawType.includes('quake') || rawCat.includes('earthquake');
    const isFlood = rawType.includes('flood') || rawCat.includes('flood');

    if (rawType === 'grid_failure') {
      eventType = eventType || 'Grid Disturbance';
    } else if (isCyclone) {
      eventType = eventType || 'Tropical Cyclone';
    } else if (isEarthquake) {
      eventType = eventType || 'Earthquake / Seismic Hazard';
    } else if (isFlood) {
      eventType = eventType || 'Flood / Monsoon Inundation';
    } else if (event?.category && !['hazard', 'disaster', 'hazard event'].includes(rawCat)) {
      eventType = eventType || event.category;
    } else {
      eventType = eventType || 'Geological / Natural Hazard';
    }

    disasterCategory = disasterCategory || (event?.category || 'Natural Hazard');
    rootCauseSummary =
      rootCauseSummary ||
      'Natural hazard, geophysical, or meteorological disturbance impacting regional power transmission and distribution lines.';
    infrastructureImpact =
      infrastructureImpact ||
      'Physical grid restoration in progress with daily satellite radiance tracking.';
  }

  const isGridTrip = eventType.toLowerCase().includes('grid') || eventType.toLowerCase().includes('frequency');
  const isVolcano = eventType.toLowerCase().includes('volcan') || eventType.toLowerCase().includes('eruption');

  return {
    eventType,
    disasterCategory,
    rootCauseSummary,
    infrastructureImpact,
    isGridTrip,
    isVolcano,
  };
}

/**
 * Event Context & Primary Driver Micro-Card
 * Differentiates physical disaster damage from operational grid disturbances,
 * displaying official root-cause narratives alongside VIIRS radiance context.
 */
export function EventContextCard({ event, className = '', variant = 'full' }: EventContextCardProps) {
  const { eventType, disasterCategory, rootCauseSummary, infrastructureImpact, isGridTrip, isVolcano } =
    resolveEventContext(event);

  return (
    <div
      className={`rounded-xl border border-slate-200/90 dark:border-white/10 bg-gradient-to-br ${isVolcano
        ? 'from-rose-500/5 via-slate-50 dark:via-ink-900/40 to-amber-500/5 border-rose-500/25 dark:border-rose-500/20'
        : isGridTrip
          ? 'from-amber-500/5 via-slate-50 dark:via-ink-900/40 to-ocean-500/5 border-amber-500/25 dark:border-amber-500/20'
          : 'from-ocean-500/5 via-slate-50 dark:via-ink-900/40 to-emerald-500/5 border-ocean-500/25 dark:border-ocean-500/20'
        } p-4 sm:p-4.5 shadow-sm transition-all ${className}`}
    >
      {/* Top Header Row with Title and Tag Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${isVolcano
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              : isGridTrip
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                : 'bg-ocean-100 text-ocean-700 dark:bg-ocean-500/20 dark:text-ocean-300'
              }`}
          >
            {isVolcano ? <Flame className="h-4 w-4" /> : isGridTrip ? <Zap className="h-4 w-4" /> : <Wind className="h-4 w-4" />}
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
            Event Context & Primary Driver
          </span>
        </div>

        {/* Tag Badges: {event_type} and {disaster_category} */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${isVolcano
              ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-500/15 dark:text-rose-200 dark:border-rose-500/30'
              : isGridTrip
                ? 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-500/15 dark:text-amber-200 dark:border-amber-500/30'
                : 'bg-ocean-50 text-ocean-800 border-ocean-300 dark:bg-ocean-500/15 dark:text-ocean-200 dark:border-ocean-500/30'
              }`}
          >
            <Activity className="h-3 w-3" />
            {eventType}
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/10 dark:text-slate-200 dark:border-white/15">
            <Layers className="h-3 w-3 text-slate-400" />
            {disasterCategory}
          </span>
        </div>
      </div>

      {/* Primary Driver Body */}
      <div className="space-y-2 text-xs leading-relaxed text-slate-700 dark:text-ink-200">
        <p>
          <strong className="font-semibold text-slate-900 dark:text-white">Primary Driver: </strong>
          {rootCauseSummary}
        </p>

        {variant === 'full' && infrastructureImpact && (
          <p className="text-[11.5px] text-slate-600 dark:text-ink-300 pt-0.5">
            <strong className="font-semibold text-slate-800 dark:text-slate-200">Physical Grid Impact: </strong>
            {infrastructureImpact}
          </p>
        )}
      </div>

      {/* Methodology Footnote */}
      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-white/10 flex items-start gap-1.5 text-[10.5px] text-slate-500 dark:text-ink-400">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-ocean-500/80 dark:text-ocean-400/80" />
        <span className="italic leading-normal">
          Root cause derived from official incident/meteorological reports; recovery trajectory quantified via VIIRS DNB nocturnal radiance.
        </span>
      </div>
    </div>
  );
}

interface ExecutiveBriefingProps {
  event?: DisasterEvent | null;
  municipalities: Municipality[];
  className?: string;
}

/**
 * ExecutiveBriefing Component
 * Combines the Event Context & Root Cause micro-card with the AI-driven situational assessment.
 */
export default function ExecutiveBriefing({ event, municipalities, className = '' }: ExecutiveBriefingProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Event Context & Primary Driver Micro-Card */}
      <EventContextCard event={event} />

      {/* Full AI Situational Assessment */}
      <AiBriefingCard event={event} municipalities={municipalities} />
    </div>
  );
}
