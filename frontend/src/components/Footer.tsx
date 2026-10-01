import React from 'react';
import { Satellite, Globe, ExternalLink, MapPin, Compass, ArrowUpRight } from 'lucide-react';
import { APP_VERSION } from './Navbar';

export interface FooterProps {
  onSelectRegion?: (regionKey: string) => void;
  selectedRegionKey?: string;
}

interface ProvinceItem {
  key: string;
  name: string;
  lgus: string;
  description: string;
}

const PROVINCES: ProvinceItem[] = [
  { key: 'aklan', name: 'Aklan Province', lgus: '17 LGUs', description: 'Kalibo, Malay, Boracay corridor' },
  { key: 'antique', name: 'Antique Province', lgus: '18 LGUs', description: 'San Jose, Culasi, Western seaboard' },
  { key: 'capiz', name: 'Capiz Province', lgus: '17 LGUs', description: 'Roxas City, Panay heartland' },
  { key: 'iloilo', name: 'Iloilo Province', lgus: '43 LGUs', description: 'Iloilo City, Southern & Central grid' },
];

export default function Footer({ onSelectRegion, selectedRegionKey }: FooterProps) {
  const handleProvinceClick = (e: React.MouseEvent, regionKey: string) => {
    e.preventDefault();

    // Trigger region change callback if passed
    if (onSelectRegion) {
      onSelectRegion(regionKey);
    }

    // Broadcast custom event so PanayMap can flyTo and render region boundaries
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('sanag:focus-province', {
          detail: { provinceKey: regionKey, regionKey },
        })
      );
      window.dispatchEvent(
        new CustomEvent('sanag:select-region', {
          detail: { regionKey },
        })
      );
    }

    // Smoothly scroll to the interactive map section
    const mapElement = document.getElementById('map');
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.location.hash = '#map';
    }
  };

  return (
    <footer className="relative border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-ink-950 transition-colors">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-emerald-500 shadow-md shadow-ocean-500/20">
                <Satellite className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-extrabold text-slate-900 dark:text-white">SANAG</span>
                <p className="text-[10px] text-slate-500 dark:text-ink-400">Satellite Analytics for Nightlight & Assessment Grid</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-ink-400 leading-relaxed max-w-sm">
              A free, open dashboard for exploring municipality boundaries and recovery indicators
              across Panay Island. Built for local leaders, students, and residents.
            </p>
          </div>

          {/* Data sources */}
          <div>
            <h4 className="text-xs font-semibold text-slate-800 dark:text-ink-300 uppercase tracking-wider mb-4">Data Sources</h4>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-ink-400">
              <li>
                <a
                  href="https://github.com/jamesphillipdeguzman/sanag/blob/main/frontend/public/panay_municipalities.geojson"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>GeoJSON Municipal Boundaries</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/jamesphillipdeguzman/sanag/blob/main/frontend/src/data/mockData.ts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>Local demo recovery metrics</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://developers.google.com/earth-engine/datasets/catalog/NASA_VIIRS_002_VNP46A2"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>NASA VIIRS Daily Radiance (VNP46A2)</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://developers.google.com/earth-engine/datasets/catalog/NOAA_VIIRS_DNB_MONTHLY_V1_VCMSLCFG"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors"
                >
                  <span>NOAA Monthly Baselines (VCMSLCFG)</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-400 transition-colors" />
                </a>
              </li>
              <li>
                <a
                  href="https://sanag.onrender.com/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 hover:text-ocean-600 dark:hover:text-ocean-400 transition-colors font-medium text-ocean-600 dark:text-ocean-400"
                >
                  <span>FastAPI Interactive API Docs</span>
                  <ExternalLink className="h-3 w-3 text-ocean-500 dark:text-ocean-400 group-hover:text-ocean-600 transition-colors" />
                </a>
              </li>
            </ul>
          </div>

          {/* Coverage Area with Interactive Map Focus Links */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-ink-300 uppercase tracking-wider">
                Coverage Area
              </h4>
              <button
                type="button"
                onClick={(e) => handleProvinceClick(e, 'panay')}
                className="text-[11px] font-medium text-ocean-600 dark:text-ocean-400 hover:underline inline-flex items-center gap-1 cursor-pointer transition-colors"
                title="View full Panay Island overview on interactive map"
              >
                <Compass className="h-3 w-3" />
                <span>All Panay (93 LGUs)</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-ink-400 mb-3">
              Click a province below to center the interactive map and focus its municipal boundaries:
            </p>

            <ul className="space-y-2">
              {PROVINCES.map((prov) => {
                const isSelected = selectedRegionKey === prov.key;
                return (
                  <li key={prov.key}>
                    <a
                      href="#map"
                      onClick={(e) => handleProvinceClick(e, prov.key)}
                      className={`group flex items-center justify-between p-2 rounded-xl border transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'bg-ocean-50/90 dark:bg-ocean-500/15 border-ocean-400/60 dark:border-ocean-500/40 text-ocean-700 dark:text-ocean-200 shadow-sm'
                          : 'bg-white/60 dark:bg-white/5 border-slate-200/80 dark:border-white/10 hover:border-ocean-300 dark:hover:border-ocean-500/30 hover:bg-ocean-50/50 dark:hover:bg-ocean-500/10 text-slate-700 dark:text-ink-300'
                      }`}
                      title={`Focus map on ${prov.name} (${prov.lgus})`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isSelected
                              ? 'bg-ocean-500 text-white'
                              : 'bg-slate-100 dark:bg-white/10 text-ocean-600 dark:text-ocean-400 group-hover:bg-ocean-500 group-hover:text-white'
                          }`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-xs font-semibold block truncate group-hover:text-ocean-600 dark:group-hover:text-ocean-300 transition-colors">
                            {prov.name}
                          </span>
                          <span className="text-[10px] text-slate-400 dark:text-ink-500 block truncate">
                            {prov.description}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-ink-400 group-hover:text-ocean-600 dark:group-hover:text-ocean-300 transition-colors">
                          {prov.lgus}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-ocean-600 dark:text-ink-500 dark:group-hover:text-ocean-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <p className="text-xs text-slate-500 dark:text-ink-500">
              CSE 499 Project · Panay Island, Philippines
            </p>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-200/50 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-700/40">
              v{APP_VERSION}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-ink-500">
            <a
              href="https://sanag.onrender.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-ocean-600 dark:hover:text-ocean-400 font-medium transition-colors"
            >
              <span>API Docs</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <span>·</span>
            <span>Built for Panay communities</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

