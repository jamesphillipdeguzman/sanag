import { useState, useEffect } from 'react';
import { Ruler, X } from 'lucide-react';

export interface ViirsScaleRulerProps {
  pinned: boolean;
  nightGlow?: boolean;
  mapHovered?: boolean;
  showGrid?: boolean;
  onToggleGrid?: () => void;
  zoom?: number;
  scaleCalibration?: number; // Multiplier: 1.0 = nominal 500m/pixel (1 DNB = 500m)
  onClose?: () => void;
}

export default function ViirsScaleRuler({
  pinned,
  nightGlow = false,
  mapHovered = false,
  showGrid = false,
  onToggleGrid,
  zoom = 8,
  scaleCalibration = 1.0,
  onClose,
}: ViirsScaleRulerProps) {
  const [isVisible, setIsVisible] = useState<boolean>(true);

  // Re-open if the pinned state is re-activated externally
  useEffect(() => {
    if (pinned) {
      setIsVisible(true);
    }
  }, [pinned]);

  if (!isVisible || (!pinned && !mapHovered)) {
    return null;
  }

  // ── NASA VIIRS Day/Night Band (DNB) Spatial Scale Math (1 DNB = 500m Nominal) ──
  const effectiveCalibration =
    typeof scaleCalibration === 'number' && isFinite(scaleCalibration) && scaleCalibration > 0
      ? scaleCalibration
      : 1.0;
  const calibratedDnbMeters = 500 * effectiveCalibration;

  // Web Mercator ground resolution at latitude ~11°N (Panay Island & Western Visayas)
  const latRad = (11 * Math.PI) / 180;
  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zoom);

  // Target on-screen pixel width (~120px-180px for the widget ruler bar)
  const targetPx = 150;

  // Standard cartographic round distances in meters
  const NICE_DISTANCES = [
    250, 500, 1000, 2000, 2500, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 75000, 100000, 150000, 200000,
  ];

  let chosenDistance = NICE_DISTANCES[0];
  let minDiff = Infinity;
  for (const dist of NICE_DISTANCES) {
    const px = dist / metersPerPixel;
    const diff = Math.abs(px - targetPx);
    if (diff < minDiff && px >= 80 && px <= 240) {
      minDiff = diff;
      chosenDistance = dist;
    }
  }

  // Exact DNB pixel count represented by this distance
  const totalDnbPixels = Math.round(chosenDistance / calibratedDnbMeters);
  const dnbLabel = totalDnbPixels >= 1 ? `${totalDnbPixels}` : (chosenDistance / calibratedDnbMeters).toFixed(1);

  // Human-readable metric labels
  let maxLabel: string;
  let midLabel: string;
  if (chosenDistance >= 1000) {
    const totalKm = chosenDistance / 1000;
    maxLabel = `${totalKm >= 10 ? Math.round(totalKm) : totalKm.toFixed(1)} km`;
    const midKm = totalKm / 2;
    midLabel = `${midKm >= 10 ? Math.round(midKm) : midKm.toFixed(1)} km`;
  } else {
    maxLabel = `${chosenDistance} m`;
    midLabel = `${Math.round(chosenDistance / 2)} m`;
  }

  return (
    <div className="absolute bottom-4 right-4 z-[500] w-[calc(100vw-32px)] max-w-[240px] sm:max-w-[300px] p-2 sm:p-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-md text-[10px] sm:text-xs animate-fade-in pointer-events-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 sm:pb-2 mb-1.5 sm:mb-2 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          <Ruler className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sky-500 dark:text-sky-400 shrink-0" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 truncate">
            500m VIIRS Scale
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleGrid?.();
            }}
            className={`px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-lg text-[9px] sm:text-xs font-bold transition-all cursor-pointer ${
              showGrid
                ? 'bg-sky-500 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {showGrid ? 'GRID ON' : 'GRID OFF'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsVisible(false);
              onClose?.();
            }}
            className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss scale ruler"
            aria-label="Dismiss scale ruler"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ruler Visual */}
      <div className="pt-0.5">
        <div className="flex justify-between items-end text-[9px] sm:text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 mb-1">
          <span>0</span>
          <span>{midLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <div className="flex w-full h-1.5 sm:h-2 rounded border border-slate-400 dark:border-slate-600 overflow-hidden bg-slate-200 dark:bg-slate-800">
          <div className="w-1/2 h-full bg-sky-500" />
          <div className="w-1/2 h-full bg-slate-400 dark:bg-slate-600" />
        </div>
        <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>1 DNB Pixel ≈ {Math.round(calibratedDnbMeters)}m</span>
          <span className="font-mono font-medium">{dnbLabel} DNB ({maxLabel})</span>
        </div>
      </div>
    </div>
  );
}

export { ViirsScaleRuler as VIIRSScaleRuler };
