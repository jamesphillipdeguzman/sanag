import React from 'react';
import { Zap, X } from 'lucide-react';

export interface StationItem {
  id: string;
  name: string;
  voltage: string;
  status: string;
}

export interface ProvinceStationGroup {
  province: string;
  count: number;
  active_count?: number;
  stations?: StationItem[];
}

interface StationProvinceBreakdownPopoverProps {
  stationsCount: number;
  stationsByProvince: ProvinceStationGroup[];
  onClose?: () => void;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
  isMobile?: boolean;
  className?: string;
}

export default function StationProvinceBreakdownPopover({
  stationsCount,
  stationsByProvince,
  onClose,
  popoverRef,
  isMobile = false,
  className = '',
}: StationProvinceBreakdownPopoverProps) {
  const containerClasses = isMobile
    ? 'fixed sm:absolute top-14 left-3 right-3 sm:top-full sm:mt-2 sm:left-auto sm:right-0 sm:w-[340px] max-h-[420px] flex flex-col bg-white/95 text-slate-900 border border-slate-200/80 shadow-2xl backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden p-3.5 z-[9999] animate-in fade-in zoom-in-95 duration-150'
    : 'absolute right-0 top-full mt-2 z-[9999] w-84 sm:w-96 max-h-[460px] flex flex-col bg-white/95 text-slate-900 border border-slate-200/80 shadow-2xl backdrop-blur-md dark:bg-slate-900/95 dark:text-slate-100 dark:border-slate-800 rounded-2xl overflow-hidden p-4 animate-in fade-in zoom-in-95 duration-150';

  return (
    <div
      id={isMobile ? 'mobile-station-province-breakdown-popover' : 'station-province-breakdown-popover'}
      ref={popoverRef as any}
      className={`${containerClasses} ${className}`}
      role="dialog"
      aria-label="Active Transmission Stations breakdown per province"
    >
      {/* Header & Badge */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              Active Transmission Stations
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Grouped across Panay provinces
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50">
            {stationsCount} Active
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer sm:hidden"
              aria-label="Close popover"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Province Group Containers */}
      <div className="flex flex-col gap-2 my-2.5 max-h-[300px] overflow-y-auto pr-0.5 scrollbar-thin flex-1">
        {stationsByProvince && stationsByProvince.length > 0 ? (
          stationsByProvince.map((group) => {
            const activeCount = group.active_count ?? group.count;
            return (
              <div
                key={group.province}
                className="bg-slate-50/80 border border-slate-200/60 dark:bg-slate-800/40 dark:border-slate-800 rounded-xl p-3 transition-colors hover:border-emerald-500/30 dark:hover:border-emerald-500/40"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block shadow-sm shadow-emerald-500/50" />
                    {group.province}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {activeCount} Active Station{activeCount !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Substation Pills */}
                <div className="flex flex-wrap gap-1.5">
                  {group.stations && group.stations.length > 0 ? (
                    group.stations.map((st) => (
                      <span
                        key={st.id}
                        className="px-2 py-1 rounded-md text-[11px] font-medium bg-white text-slate-800 border border-slate-200 shadow-sm dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 flex items-center gap-1"
                        title={`${st.name} (${st.voltage}) · Status: ${st.status}`}
                      >
                        <span>
                          {st.name.replace(' Substation', '').replace(' Switching Station', '')}
                        </span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold font-mono text-[10px]">
                          {st.voltage}
                        </span>
                      </span>
                    ))
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">No stations listed</div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-3 text-xs text-slate-500 dark:text-slate-400 text-center">
            Loading station telemetry...
          </div>
        )}
      </div>

      {/* Footer Summary Line */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
        <span>Total grid baseline: {stationsCount} stations</span>
        <span className="font-medium text-emerald-600 dark:text-emerald-400">95 LGUs covered</span>
      </div>
    </div>
  );
}
