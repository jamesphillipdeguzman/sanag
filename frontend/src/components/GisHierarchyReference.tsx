import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Layers, X, Info, CheckCircle2 } from 'lucide-react';

export default function GisHierarchyReference() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const crosswalkData = [
    {
      unit: 'Country',
      example: 'Philippines',
      psa: 'Level 0 (ADM0)',
      gadm: 'Level 0 (GID_0)',
      isActive: false,
    },
    {
      unit: 'Region',
      example: 'Western Visayas, NCR, BARMM',
      psa: 'Level 1 (ADM1)',
      gadm: 'Skipped / Unassigned',
      isActive: false,
    },
    {
      unit: 'Province / District',
      example: 'Iloilo, Davao, Cebu',
      psa: 'Level 2 (ADM2)',
      gadm: 'Level 1 (GID_1)',
      isActive: false,
    },
    {
      unit: 'Municipality / City',
      example: 'Oton, Glan, Iloilo City',
      psa: 'Level 3 (ADM3)',
      gadm: 'Level 2 (GID_2)',
      isActive: true,
      note: 'SANAG Operational Polygon Tier',
    },
    {
      unit: 'Barangay',
      example: 'Poblacion, Brgy. San Jose',
      psa: 'Level 4 (ADM4)',
      gadm: 'Level 3 (GID_3)',
      isActive: false,
    },
  ];

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setIsOpen(false)}
    >
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gis-hierarchy-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden text-slate-100"
      >
        {/* Header (sticky at top) */}
        <div className="flex items-start justify-between gap-3 p-4 pb-3 border-b border-slate-800 shrink-0">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-cyan-400 shrink-0" />
              <h3 id="gis-hierarchy-title" className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                Administrative Tier Reference
              </h3>
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              PSA / UN OCHA vs. GADM Levels Crosswalk
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close reference dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 overscroll-contain">
          {/* Context Explainer */}
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-[11px] text-slate-300 leading-relaxed">
            <span className="font-semibold text-cyan-300">Key Difference: </span>
            Philippine national agencies (PSA/NAMRIA/OCHA) classify 17 Administrative Regions as{' '}
            <strong className="text-white">Level 1 (ADM1)</strong>. Global datasets (GADM) skip administrative regions, labeling Provinces directly as Level 1.
          </div>

          {/* Crosswalk Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-[11px] border-collapse min-w-[360px]">
              <thead>
                <tr className="bg-slate-800/80 text-slate-300 font-semibold border-b border-slate-700/80">
                  <th className="py-2 px-2.5">Administrative Unit</th>
                  <th className="py-2 px-2">PSA / OCHA</th>
                  <th className="py-2 px-2">GADM Hierarchy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {crosswalkData.map((row) => (
                  <tr
                    key={row.unit}
                    className={`transition-colors ${
                      row.isActive
                        ? 'bg-cyan-500/15 border-l-2 border-l-cyan-400 text-cyan-100 font-medium'
                        : 'text-slate-300 hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-2 px-2.5">
                      <div className="font-medium text-white flex items-center gap-1">
                        {row.isActive && (
                          <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                        )}
                        <span>{row.unit}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal truncate max-w-[140px]" title={row.example}>
                        {row.example}
                      </div>
                    </td>
                    <td className="py-2 px-2 font-mono text-[10px]">
                      <div>{row.psa}</div>
                      {row.isActive && (
                        <div className="text-[9px] font-sans font-bold uppercase tracking-wider text-cyan-300 mt-0.5">
                          SANAG Tier
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono text-[10px]">
                      <div>{row.gadm}</div>
                      {row.isActive && (
                        <div className="text-[9px] font-sans font-semibold text-slate-400 mt-0.5">
                          (Level 2 Mesh)
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Operational Footer Callout */}
          <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Project SANAG: Level 3 (ADM3) boundaries</span>
            </span>
            <span className="text-[10px] font-mono text-cyan-400/90 font-semibold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              1,647 LGUs
            </span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className="relative inline-block">
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        id="gis-hierarchy-reference-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer backdrop-blur-sm ${
          isOpen
            ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-500/30'
            : 'bg-slate-100 dark:bg-slate-900/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-slate-700/60 hover:bg-slate-200 dark:hover:bg-slate-800'
        }`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="View Philippine Administrative Hierarchy Crosswalk (PSA/UN OCHA vs GADM)"
      >
        <Layers className={`h-3.5 w-3.5 ${isOpen ? 'text-cyan-500 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'}`} />
        <span>ADM Hierarchy</span>
      </button>

      {/* Viewport-Centered Modal Backdrop rendered in Portal */}
      {typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent}
    </div>
  );
}
