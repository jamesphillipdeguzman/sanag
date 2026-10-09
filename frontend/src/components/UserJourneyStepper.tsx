import React from 'react';
import {
  AlertTriangle,
  Globe,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { TabId } from './Navbar';

export interface UserJourneyStepperProps {
  onNavigateTab?: (tab: TabId) => void;
  className?: string;
}

interface StepItem {
  id: TabId;
  stepNumber: string;
  stepPhase: string;
  title: string;
  description: string;
  ctaText: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: {
    badge: string;
    iconBg: string;
    iconColor: string;
    borderHover: string;
    glow: string;
    ctaHover: string;
  };
}

const STEPS: StepItem[] = [
  {
    id: 'events',
    stepNumber: '01',
    stepPhase: 'Incident Selection',
    title: 'Select Disaster Event',
    description:
      'Choose an active typhoon, flood, or earthquake from GDACS or historical archives to set satellite baselines.',
    ctaText: 'Start at Events →',
    icon: AlertTriangle,
    accentColor: {
      badge: 'text-amber-500 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
      iconBg: 'bg-amber-500/15 border-amber-500/30 text-amber-500 dark:text-amber-400',
      iconColor: 'text-amber-500 dark:text-amber-400',
      borderHover: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
      glow: 'from-amber-500/10 via-transparent to-transparent',
      ctaHover: 'group-hover:text-amber-500 dark:group-hover:text-amber-400',
    },
  },
  {
    id: 'map',
    stepNumber: '02',
    stepPhase: 'Spatial Nightlights',
    title: 'Explore Spatial Grid',
    description:
      'Inspect municipal boundary blackouts, 500m VIIRS radiance loss, and active transmission substations.',
    ctaText: 'Inspect Map →',
    icon: Globe,
    accentColor: {
      badge: 'text-cyan-500 dark:text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      iconBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-500 dark:text-cyan-400',
      iconColor: 'text-cyan-500 dark:text-cyan-400',
      borderHover: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      glow: 'from-cyan-500/10 via-transparent to-transparent',
      ctaHover: 'group-hover:text-cyan-500 dark:group-hover:text-cyan-400',
    },
  },
  {
    id: 'recovery',
    stepNumber: '03',
    stepPhase: 'Restoration Dynamics',
    title: 'Track Recovery Curves',
    description:
      'Compare day-by-day municipal trajectory curves against normal radiance to identify <60% critical deficits.',
    ctaText: 'Compare Curves →',
    icon: TrendingUp,
    accentColor: {
      badge: 'text-violet-500 dark:text-violet-400 bg-violet-500/10 border-violet-500/20',
      iconBg: 'bg-violet-500/15 border-violet-500/30 text-violet-500 dark:text-violet-400',
      iconColor: 'text-violet-500 dark:text-violet-400',
      borderHover: 'hover:border-violet-500/50 hover:shadow-violet-500/10',
      glow: 'from-violet-500/10 via-transparent to-transparent',
      ctaHover: 'group-hover:text-violet-500 dark:group-hover:text-violet-400',
    },
  },
  {
    id: 'summary',
    stepNumber: '04',
    stepPhase: 'Actionable Intelligence',
    title: 'Executive Synthesis',
    description:
      'Review island-wide restoration totals and consult AI-synthesized situational intelligence for response planning.',
    ctaText: 'Read Summary →',
    icon: Sparkles,
    accentColor: {
      badge: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      iconBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 dark:text-emerald-400',
      iconColor: 'text-emerald-500 dark:text-emerald-400',
      borderHover: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
      glow: 'from-emerald-500/10 via-transparent to-transparent',
      ctaHover: 'group-hover:text-emerald-500 dark:group-hover:text-emerald-400',
    },
  },
];

export default function UserJourneyStepper({
  onNavigateTab,
  className = '',
}: UserJourneyStepperProps) {
  return (
    <div className={`w-full relative ${className}`}>
      {/* Section Subtitle & Narrative Lead */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wider uppercase border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 mb-2">
            <span>Workflow Arc</span>
            <span className="text-slate-400">·</span>
            <span>4 Interconnected Stages</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            How Disaster Telemetry Flows
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">
            Follow the analytical roadmap from satellite baseline calibration to automated executive intelligence.
          </p>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
          <span className="text-cyan-500 dark:text-cyan-400">Step 01</span>
          <span className="text-slate-300 dark:text-slate-700">────────</span>
          <span className="text-cyan-500 dark:text-cyan-400">Step 02</span>
          <span className="text-slate-300 dark:text-slate-700">────────</span>
          <span className="text-violet-500 dark:text-violet-400">Step 03</span>
          <span className="text-slate-300 dark:text-slate-700">────────</span>
          <span className="text-emerald-500 dark:text-emerald-400">Step 04</span>
        </div>
      </div>

      {/* Stepper Cards Grid with Glowing Desktop Connector Track */}
      <div className="relative">
        {/* Desktop Faint Connecting Glowing Rail */}
        <div
          aria-hidden="true"
          className="hidden xl:block absolute top-[52px] left-12 right-12 h-[2px] bg-gradient-to-r from-amber-500/20 via-cyan-500/20 via-violet-500/20 to-emerald-500/20 pointer-events-none z-0"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 relative z-10">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onNavigateTab?.(step.id)}
                className={`group relative text-left rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all duration-300 cursor-pointer hover:-translate-y-1.5 ${step.accentColor.borderHover} flex flex-col justify-between`}
              >
                {/* Subtle Radial Atmosphere Behind Card */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${step.accentColor.glow} opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none`}
                />

                <div>
                  {/* Step Header: Badge & Icon */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold font-mono px-2 py-0.5 rounded-md border ${step.accentColor.badge}`}
                      >
                        {step.stepNumber}
                      </span>
                      <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
                        {step.stepPhase}
                      </span>
                    </div>

                    <div
                      className={`h-9 w-9 rounded-xl border flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shadow-xs ${step.accentColor.iconBg}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Step Title & Description */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                    {step.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Card Bottom CTA */}
                <div className="pt-4 mt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span className={`transition-colors ${step.accentColor.ctaHover}`}>
                    {step.ctaText}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
