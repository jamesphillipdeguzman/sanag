import { useMemo } from 'react';
import type { Municipality } from '@/types';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RecoveryChartProps {
  municipalities: Municipality[];
  selectedId: string | null;
  records: RecoveryRecord[];
  eventDate?: string;
}

interface RecoveryRecord {
  pcode: string;
  date: string;
  r_t: number | null;
}

export default function RecoveryChart({ municipalities, selectedId, records, eventDate }: RecoveryChartProps) {
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
    const recordsByPcode = new Map<string, RecoveryRecord[]>();
    const validRecords = records.filter((record) => record.r_t !== null && record.r_t !== undefined);
    const windowStart = eventDate ? new Date(`${eventDate}T00:00:00Z`) : null;
    if (windowStart) windowStart.setUTCDate(windowStart.getUTCDate() - 3); // Include pre-event baseline/onset observations
    const windowEnd = eventDate ? new Date(`${eventDate}T00:00:00Z`) : null;
    if (windowEnd) windowEnd.setUTCDate(windowEnd.getUTCDate() + 30);

    for (const record of validRecords) {
      const recordDate = new Date(`${record.date}T00:00:00Z`);
      if (windowStart && windowEnd && (recordDate < windowStart || recordDate > windowEnd)) continue;
      const municipalityRecords = recordsByPcode.get(record.pcode) ?? [];
      municipalityRecords.push(record);
      recordsByPcode.set(record.pcode, municipalityRecords);
    }

    return featured.map((m) => ({
      municipality: m,
      data: (recordsByPcode.get(m.id) ?? [])
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((record) => {
          const ratio = record.r_t;
          return {
            date: record.date,
            recoveryScore: Math.max(0, Math.min(100, Math.round((ratio ?? 0) * 100))),
          };
        }),
    })).filter((seriesItem) => seriesItem.data.length > 0);
  }, [eventDate, featured, records]);

  // Chart dimensions
  const W = 760;
  const H = 320;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  // Collect all unique observation dates across series to build a unified timeline
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    series.forEach((s) => s.data.forEach((d) => dateSet.add(d.date)));
    return Array.from(dateSet).sort();
  }, [series]);

  const pointCount = allDates.length;
  const xScale = (i: number) => margin.left + (pointCount > 1 ? (i / (pointCount - 1)) * innerW : innerW / 2);
  const yScale = (score: number) => margin.top + innerH - (score / 100) * innerH;

  const formatDate = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: '2-digit',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const dateRange = allDates.length > 1
    ? `${formatDate(allDates[0])} - ${formatDate(allDates[allDates.length - 1])}`
    : allDates[0]
      ? formatDate(allDates[0])
      : eventDate
        ? formatDate(eventDate)
        : 'No valid observations';

  const eventMarkerIndex = allDates.findIndex((d) => d >= (eventDate ?? ''));
  const markerX = eventMarkerIndex >= 0 ? xScale(eventMarkerIndex) : xScale(0);

  const lineColors = ['#599ffd', '#10b981', '#fbbf24', '#f43f5e'];

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Comparative Recovery Curves</h3>
          <p className="text-xs text-ink-400 mt-0.5">
              {selectedId
              ? `Day-by-day recovery for ${featured[0]?.name}`
              : 'Largest municipality per province · API observations'}
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Timeline window · {dateRange}</span>
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

        {series.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-ink-950/50 px-4 py-8 text-center text-sm text-ink-400">
            No valid VIIRS recovery observations are available during this event window.
          </div>
        ) : (
        /* Chart */
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
            {allDates.map((dateStr, index) => {
              if (allDates.length > 7 && ![0, Math.floor((allDates.length - 1) / 2), allDates.length - 1].includes(index)) return null;
              return (
                <text
                  key={dateStr}
                  x={xScale(index)}
                  y={H - 12}
                  textAnchor="middle"
                  className="fill-ink-500"
                  style={{ fontSize: '9px' }}
                >
                  {formatDate(dateStr)}
                </text>
              );
            })}

            {/* Event marker line */}
            <line
              x1={markerX}
              y1={margin.top}
              x2={markerX}
              y2={margin.top + innerH}
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
            />
            <text
              x={markerX + 4}
              y={margin.top + 12}
              className="fill-rose-400"
              style={{ fontSize: '9px', fontWeight: 600 }}
            >
              Event Onset
            </text>

            {/* Recovery curves */}
            {series.map((s, i) => {
              const color = lineColors[i % lineColors.length];
              const isSingle = s.data.length === 1;
              const firstPt = s.data[0];
              const lastPt = s.data[s.data.length - 1];
              const firstX = xScale(allDates.indexOf(firstPt.date));
              const lastX = xScale(allDates.indexOf(lastPt.date));

              const pathData = isSingle
                ? `M ${firstX - 15} ${yScale(firstPt.recoveryScore)} L ${firstX + 15} ${yScale(firstPt.recoveryScore)}`
                : s.data
                    .map((pt, j) => {
                      const x = xScale(allDates.indexOf(pt.date));
                      const y = yScale(pt.recoveryScore);
                      return `${j === 0 ? 'M' : 'L'} ${x} ${y}`;
                    })
                    .join(' ');

              const areaPath = !isSingle
                ? `M ${firstX} ${yScale(firstPt.recoveryScore)} ` +
                  s.data.map((pt) => `L ${xScale(allDates.indexOf(pt.date))} ${yScale(pt.recoveryScore)}`).join(' ') +
                  ` L ${lastX} ${margin.top + innerH} L ${firstX} ${margin.top + innerH} Z`
                : '';

              return (
                <g key={s.municipality.id}>
                  <defs>
                    <linearGradient id={`grad-${s.municipality.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {series.length === 1 && !isSingle && <path d={areaPath} fill={`url(#grad-${s.municipality.id})`} />}
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
                    cx={lastX}
                    cy={yScale(lastPt.recoveryScore)}
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
        )}

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {series.map((s, i) => {
            const start = s.data[0].recoveryScore;
            const end = s.data[s.data.length - 1].recoveryScore;
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
