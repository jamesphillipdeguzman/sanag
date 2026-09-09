import { useMemo } from 'react';
import type { Municipality } from '@/types';
import { generateRecoveryCurve } from '@/data/mockData';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RecoveryChartProps {
  municipalities: Municipality[];
  selectedId: string | null;
}

export default function RecoveryChart({ municipalities, selectedId }: RecoveryChartProps) {
  // Determine which municipalities to show
  const featured = useMemo(() => {
    if (selectedId) {
      const sel = municipalities.find((m) => m.id === selectedId);
      if (sel) return [sel];
    }
    // Show a representative set: one from each province, sorted by score
    const byProvince = new Map<string, Municipality>();
    for (const m of municipalities) {
      if (!byProvince.has(m.province) || m.population > byProvince.get(m.province)!.population) {
        byProvince.set(m.province, m);
      }
    }
    return Array.from(byProvince.values()).sort((a, b) => b.recoveryScore - a.recoveryScore);
  }, [municipalities, selectedId]);

  const series = useMemo(() => {
    return featured.map((m) => ({
      municipality: m,
      data: generateRecoveryCurve(m.baselineRadiance, 5, 30, 0.10 + (m.recoveryScore / 1000)),
    }));
  }, [featured]);

  // Chart dimensions
  const W = 760;
  const H = 320;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  const xScale = (i: number) => margin.left + (i / 29) * innerW;
  const yScale = (score: number) => margin.top + innerH - (score / 100) * innerH;

  const lineColors = ['#599ffd', '#10b981', '#fbbf24', '#f43f5e'];

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Comparative Recovery Curves</h3>
          <p className="text-xs text-ink-400 mt-0.5">
            {selectedId
              ? `Day-by-day recovery for ${featured[0]?.name}`
              : 'Largest municipality per province'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>30-day window</span>
        </div>
      </div>

      <div className="p-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-3">
          {series.map((s, i) => (
            <div key={s.municipality.id} className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lineColors[i % lineColors.length] }} />
              <span className="text-xs text-ink-300 font-medium">{s.municipality.name}</span>
              <span className="text-xs text-ink-500">{s.municipality.province}</span>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="relative w-full overflow-x-auto scrollbar-thin">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: '600px' }}>
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((tick) => (
              <g key={tick}>
                <line
                  x1={margin.left}
                  y1={yScale(tick)}
                  x2={W - margin.right}
                  y2={yScale(tick)}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 8}
                  y={yScale(tick) + 4}
                  textAnchor="end"
                  className="fill-ink-500"
                  style={{ fontSize: '10px' }}
                >
                  {tick}
                </text>
              </g>
            ))}

            {/* Y axis label */}
            <text
              x={14}
              y={margin.top + innerH / 2}
              textAnchor="middle"
              className="fill-ink-500"
              style={{ fontSize: '10px', fontWeight: 600, transform: 'rotate(-90deg)', transformOrigin: '14px 170px' }}
            >
              Recovery Score (%)
            </text>

            {/* X axis labels */}
            {[0, 5, 10, 15, 20, 25, 29].map((day) => {
              const date = new Date('2024-01-01');
              date.setDate(date.getDate() + day);
              return (
                <text
                  key={day}
                  x={xScale(day)}
                  y={H - 12}
                  textAnchor="middle"
                  className="fill-ink-500"
                  style={{ fontSize: '9px' }}
                >
                  {date.toISOString().split('T')[0].slice(5)}
                </text>
              );
            })}

            {/* Event marker line */}
            <line
              x1={xScale(5)}
              y1={margin.top}
              x2={xScale(5)}
              y2={margin.top + innerH}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            <text
              x={xScale(5) + 4}
              y={margin.top + 12}
              className="fill-rose-400"
              style={{ fontSize: '9px', fontWeight: 600 }}
            >
              Event Onset
            </text>

            {/* Recovery curves */}
            {series.map((s, i) => {
              const color = lineColors[i % lineColors.length];
              const pathData = s.data
                .map((pt, j) => `${j === 0 ? 'M' : 'L'} ${xScale(j)} ${yScale(pt.recoveryScore)}`)
                .join(' ');

              const areaPath =
                `M ${xScale(0)} ${yScale(s.data[0].recoveryScore)} ` +
                s.data.map((pt, j) => `L ${xScale(j)} ${yScale(pt.recoveryScore)}`).join(' ') +
                ` L ${xScale(29)} ${margin.top + innerH} L ${xScale(0)} ${margin.top + innerH} Z`;

              return (
                <g key={s.municipality.id}>
                  <defs>
                    <linearGradient id={`grad-${s.municipality.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {series.length === 1 && <path d={areaPath} fill={`url(#grad-${s.municipality.id})`} />}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-draw-line"
                    style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
                  />
                  {/* End point dot */}
                  <circle
                    cx={xScale(29)}
                    cy={yScale(s.data[29].recoveryScore)}
                    r="4"
                    fill={color}
                    stroke="#0d1117"
                    strokeWidth="2"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {series.map((s, i) => {
            const start = s.data[5].recoveryScore;
            const end = s.data[29].recoveryScore;
            const delta = end - start;
            return (
              <div key={s.municipality.id} className="rounded-xl bg-ink-950/50 border border-white/5 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: lineColors[i % lineColors.length] }} />
                  <span className="text-xs font-medium text-ink-300 truncate">{s.municipality.name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-white">{end}%</span>
                  <span className={`text-xs flex items-center gap-0.5 ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {delta > 0 ? '+' : ''}{delta}pt
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
