import React from 'react';
import { X, Lock, Radio } from 'lucide-react';
import type { GdacsAlert, DisasterEvent } from '@/types';

export interface GDACSModalProps {
  alert?: GdacsAlert | DisasterEvent | any | null;
  event?: GdacsAlert | DisasterEvent | any | null;
  onClose: () => void;
  activeEventId?: string | null;
  activeSimulatedEvent?: any;
  onSimulate?: (event: any) => void;
  setActiveSimulatedEvent?: (event: any) => void;
  className?: string;
}

export default function GDACSModal({
  alert,
  event: eventProp,
  onClose,
  activeEventId = null,
  activeSimulatedEvent,
  onSimulate,
  setActiveSimulatedEvent,
  className = '',
}: GDACSModalProps) {
  const event = alert || eventProp;
  if (!event) return null;

  const rawLevel = (event.alert_level || event.severity || 'Green').toString().toLowerCase();
  let alertBadgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-400 dark:border-emerald-700/50';
  if (rawLevel === 'red' || rawLevel === 'severe') {
    alertBadgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-400 dark:border-rose-700/50';
  } else if (rawLevel === 'orange' || rawLevel === 'high') {
    alertBadgeStyle = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-400 dark:border-amber-700/50';
  }

  const eventName = (event.name || event.eventname || event.title || '').toLowerCase().trim();
  const rawAlertId = event.event_id != null ? String(event.event_id) : undefined;

  // A. Standardize Active State Matching:
  // Handles both live alerts and historical incident objects
  const isCurrentSimulated = Boolean(
    (activeSimulatedEvent || activeEventId) &&
    (
      (activeSimulatedEvent && (
        (typeof activeSimulatedEvent === 'object' && (
          (activeSimulatedEvent.id && (
            activeSimulatedEvent.id === event.id ||
            activeSimulatedEvent.id === event.eventId ||
            activeSimulatedEvent.id === event.event_id ||
            activeSimulatedEvent.id === `gdacs-${event.event_id}` ||
            activeSimulatedEvent.id === String(event.event_id)
          )) ||
          (activeSimulatedEvent.eventId && (
            activeSimulatedEvent.eventId === (event.eventId || event.id || event.event_id)
          )) ||
          (activeSimulatedEvent.name && eventName && (
            activeSimulatedEvent.name.toLowerCase().trim() === eventName
          ))
        )) ||
        (typeof activeSimulatedEvent === 'string' && (
          activeSimulatedEvent === event.id ||
          activeSimulatedEvent === event.eventId ||
          activeSimulatedEvent === event.event_id ||
          activeSimulatedEvent === `gdacs-${event.event_id}` ||
          activeSimulatedEvent === String(event.event_id) ||
          (eventName && activeSimulatedEvent.toLowerCase().trim() === eventName)
        ))
      )) ||
      (activeEventId && (
        activeEventId === event.id ||
        activeEventId === event.eventId ||
        activeEventId === event.event_id ||
        activeEventId === `gdacs-${event.event_id}` ||
        activeEventId === String(event.event_id) ||
        (rawAlertId && (activeEventId === rawAlertId || activeEventId === `gdacs-${rawAlertId}`)) ||
        (eventName && activeEventId.toLowerCase().trim() === eventName)
      ))
    )
  );

  // B. Universal Simulation Handler:
  // Works uniformly regardless of whether event comes from live GDACS or historical archives
  const handleSimulate = () => {
    if (isCurrentSimulated) {
      // Option to stop/reset simulation
      setActiveSimulatedEvent?.(null);
      onSimulate?.(null);
    } else {
      const simulatedPayload = {
        id: event.id || event.eventId || (event.event_id != null ? `gdacs-${event.event_id}` : event.name),
        eventId: event.eventId || event.id,
        event_id: event.event_id,
        name: event.name || event.eventname || event.title || 'Simulated Event',
        date: event.date || event.startDate || event.fromdate,
        startDate: event.startDate || event.date,
        endDate: event.endDate,
        type: event.type || "historical",
        severity: event.severity || event.severity_text || event.alert_level || 'Severe',
        alert_level: event.alert_level || (event.severity === 'Severe' ? 'Red' : event.severity === 'High' ? 'Orange' : 'Green'),
        coordinates: event.coordinates || (event.latitude != null && event.longitude != null ? [event.latitude, event.longitude] : undefined),
        latitude: event.latitude ?? event.coordinates?.[0],
        longitude: event.longitude ?? event.coordinates?.[1],
        isHistorical: !event.isLive && !event.is_live_simulated && (event.event_id == null || event.type === 'grid_failure'),
        viirs_data_available: event.viirs_data_available !== false,
      };

      setActiveSimulatedEvent?.(simulatedPayload);
      onSimulate?.(simulatedPayload);
    }
  };

  const lat = event.latitude ?? event.coordinates?.[0];
  const lng = event.longitude ?? event.coordinates?.[1];

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
            {event.alert_level || event.severity || 'Green Alert'}
          </span>
          {event.type && (
            <span className="rounded-md bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-700 dark:text-slate-300">
              {event.type}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:white transition-colors p-1 rounded-lg cursor-pointer shrink-0"
          aria-label="Close alert card"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Structured Card Content without outer scroll gutters */}
      <div className="space-y-3 overflow-hidden">
        <div>
          <h3 id="gdacs-alert-title" className="text-base font-bold text-slate-900 dark:text-white mb-1 leading-snug">
            {event.name}
          </h3>
          {event.description && (
            <div className="max-h-24 overflow-y-auto pr-1 text-xs scrollbar-none">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {event.description}
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
              {event.date || event.startDate || 'Active Event'}
            </span>
          </div>

          {(event.severity_text || event.severity) && (
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span className="text-slate-500 dark:text-slate-400 text-xs">Severity:</span>
              <span className="truncate ml-1 font-semibold text-amber-700 dark:text-amber-300">
                {event.severity_text || event.severity}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
            <span className="text-slate-500 dark:text-slate-400 text-xs">VIIRS Radiance:</span>
            <span
              className={
                event.viirs_data_available !== false
                  ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                  : 'text-amber-700 dark:text-amber-400 font-semibold'
              }
            >
              {event.viirs_data_available !== false
                ? '✓ Ready to Simulate'
                : '⏳ VIIRS Data Pending'}
            </span>
          </div>
        </div>

        {/* Action / Simulation Trigger (Guaranteed no-scrollbar trigger) */}
        {(onSimulate || setActiveSimulatedEvent) && (
          <div className="pt-1 shrink-0 overflow-hidden">
            {event.viirs_data_available === false && !isCurrentSimulated ? (
              <button
                type="button"
                disabled
                className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 flex items-center justify-center gap-2 cursor-not-allowed opacity-75 pointer-events-none"
                title="Simulation disabled: Live hazard pending NASA VIIRS nightlight radiance data"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Simulate Event (VIIRS Pending)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSimulate}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isCurrentSimulated
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/50"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-950/30"
                }`}
              >
                {isCurrentSimulated ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>Active Simulation</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    <span>Simulate Event</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { GDACSModal as EventAlertCard };

