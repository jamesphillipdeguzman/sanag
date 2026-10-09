import React from 'react';
import { X, Lock, Radio } from 'lucide-react';
import type { GdacsAlert } from '@/types';

export interface GDACSModalProps {
  alert: GdacsAlert | null;
  onClose: () => void;
  activeEventId?: string | null;
  onSimulate?: (alert: GdacsAlert) => void;
  className?: string;
}

export default function GDACSModal({
  alert,
  onClose,
  activeEventId = null,
  onSimulate,
  className = '',
}: GDACSModalProps) {
  if (!alert) return null;

  const alertLevel = (alert.alert_level || 'Green').toLowerCase();
  let alertBadgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-700/50';
  if (alertLevel === 'red') {
    alertBadgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-700/50';
  } else if (alertLevel === 'orange') {
    alertBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-700/50';
  }

  const isCurrentActiveSimulation =
    activeEventId === alert.id ||
    activeEventId === `gdacs-${alert.event_id}` ||
    activeEventId === String(alert.event_id);

  const lat = alert.latitude ?? alert.coordinates?.[0];
  const lng = alert.longitude ?? alert.coordinates?.[1];

  return (
    <div
      id="active-gdacs-alert-card"
      className={`gdacs-alert-card absolute top-20 left-3 right-3 sm:right-auto sm:left-8 z-[1200] sm:w-[360px] max-w-[calc(100%-24px)] flex flex-col bg-white/95 text-slate-900 border border-slate-200/80 shadow-2xl backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden animate-in fade-in duration-200 p-5 ${className}`}
      role="dialog"
      aria-labelledby="gdacs-alert-title"
    >
      {/* Header with status badges and close button */}
      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${alertBadgeStyle}`}
          >
            {alert.alert_level || 'Green'} Alert
          </span>
          {alert.type && (
            <span className="rounded-md bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300">
              {alert.type}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors p-1 rounded-lg cursor-pointer shrink-0"
          aria-label="Close alert card"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Structured Card Content without outer scroll gutters */}
      <div className="space-y-3 overflow-hidden">
        <div>
          <h3 id="gdacs-alert-title" className="text-base font-bold text-slate-900 dark:text-white mb-1 leading-snug">
            {alert.name}
          </h3>
          {alert.description && (
            <div className="max-h-24 overflow-y-auto pr-1 text-xs scrollbar-none">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {alert.description}
              </p>
            </div>
          )}
        </div>

        {/* Key-Value Grid (Coordinates, Date, Severity) */}
        <div className="bg-slate-50 border border-slate-200/70 dark:bg-slate-800/60 dark:border-slate-700/60 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs">Coordinates:</span>
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
              {lat != null ? `${lat.toFixed(4)}°` : 'N/A'},{' '}
              {lng != null ? `${lng.toFixed(4)}°` : 'N/A'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400 text-xs">Date:</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {alert.date || 'Active Event'}
            </span>
          </div>

          {alert.severity_text && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 text-xs">Severity:</span>
              <span className="truncate ml-1 font-semibold text-amber-700 dark:text-amber-300">
                {alert.severity_text}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 text-xs">VIIRS Radiance:</span>
            <span
              className={
                alert.viirs_data_available !== false
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-amber-700 dark:text-amber-400 font-semibold'
              }
            >
              {alert.viirs_data_available !== false
                ? '✓ Ready to Simulate'
                : '⏳ VIIRS Data Pending'}
            </span>
          </div>
        </div>

        {/* Action / Simulation Trigger (Guaranteed no-scrollbar trigger) */}
        {onSimulate && (
          <div className="pt-1 shrink-0 overflow-hidden">
            {isCurrentActiveSimulation ? (
              <div className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 flex items-center justify-center gap-1.5 cursor-default">
                <span>✓ Active Simulation</span>
              </div>
            ) : alert.viirs_data_available === false ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-3 rounded-xl text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center gap-1.5 cursor-not-allowed opacity-75 pointer-events-none"
                title="Simulation disabled: Live hazard pending NASA VIIRS nightlight radiance data"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Simulate Event (VIIRS Pending)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSimulate(alert)}
                className="w-full py-2.5 px-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-ocean-600 to-ocean-500 hover:from-ocean-500 hover:to-ocean-400 hover:brightness-105 shadow-md shadow-ocean-500/20 transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                title="Ready to Simulate: Confirmed NASA VIIRS radiance data available"
              >
                <Radio className="w-3.5 h-3.5 text-white" />
                <span>Simulate Event</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { GDACSModal as EventAlertCard };
