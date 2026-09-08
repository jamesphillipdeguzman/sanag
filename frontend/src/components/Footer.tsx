import { Satellite, Heart, Globe } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative mt-16 border-t border-white/10 bg-ink-950">
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-emerald-500">
                <Satellite className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="text-base font-extrabold text-white">SANAG</span>
                <p className="text-[10px] text-ink-400">Satellite Analytics for Nightlight & Assessment Grid</p>
              </div>
            </div>
            <p className="text-sm text-ink-400 leading-relaxed max-w-sm">
              A free, open dashboard for exploring municipality boundaries and recovery indicators
              across Panay Island. Built for local leaders, students, and residents.
            </p>
          </div>

          {/* Data sources */}
          <div>
            <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-4">Data Sources</h4>
            <ul className="space-y-2 text-sm text-ink-400">
              <li>GeoJSON Municipal Boundaries</li>
              <li>Local demo recovery metrics</li>
              <li>NASA VIIRS (planned integration)</li>
            </ul>
          </div>

          {/* Coverage */}
          <div>
            <h4 className="text-xs font-semibold text-ink-300 uppercase tracking-wider mb-4">Coverage Area</h4>
            <ul className="space-y-2 text-sm text-ink-400">
              <li className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-ocean-400" /> Aklan Province</li>
              <li className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-ocean-400" /> Antique Province</li>
              <li className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-ocean-400" /> Capiz Province</li>
              <li className="flex items-center gap-2"><Globe className="h-3.5 w-3.5 text-ocean-400" /> Iloilo Province</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ink-500">
            CSE 499 Project · Panay Island, Philippines
          </p>
          <p className="text-xs text-ink-500 flex items-center gap-1.5">
            Built with <Heart className="h-3 w-3 text-rose-400" /> for Panay communities
          </p>
        </div>
      </div>
    </footer>
  );
}
