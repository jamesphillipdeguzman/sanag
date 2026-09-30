import { useState, useMemo } from 'react';
import type { Municipality, DisasterEvent } from '@/types';
import { CalendarDays, TrendingUp, TrendingDown, Building2, AlertTriangle, X, ChevronDown, Layers } from 'lucide-react';
import { events as defaultMockEvents } from '@/data/mockData';

export type ViewMode = 'hubs' | 'critical';

interface RecoveryChartProps {
  municipalities: Municipality[];
  selectedId: string | null;
  records: RecoveryRecord[];
  events?: DisasterEvent[];
  activeEventId?: string | null;
  onEventChange?: (eventId: string) => void;
  eventDate?: string;
  startDate?: string;
  endDate?: string;
  onDateRangeChange?: (startDate: string, endDate: string) => void;
  onSelect?: (id: string | null) => void;
}

interface RecoveryRecord {
  pcode: string;
  date: string;
  r_t: number | null;
}

export default function RecoveryChart({
  municipalities,
  selectedId,
  records,
  events: propEvents,
  activeEventId,
  onEventChange,
  eventDate,
  startDate = '',
  endDate = '',
  onDateRangeChange,
  onSelect,
}: RecoveryChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('hubs');

  // Comprehensive events list ensuring default fixtures (1990 Earthquake, Typhoon Tino, etc.) are available
  const allEvents = useMemo(() => {
    const list = propEvents && propEvents.length > 0 ? propEvents : defaultMockEvents;
    const existingIds = new Set(list.map((e) => String(e.id)));
    const missingDefaults = defaultMockEvents.filter((d) => !existingIds.has(String(d.id)));
    return [...list, ...missingDefaults];
  }, [propEvents]);

  // Determine active event ID matching selected event, start date, or eventDate
  const currentEventId = useMemo(() => {
    if (activeEventId && allEvents.some((e) => String(e.id) === String(activeEventId))) {
      return String(activeEventId);
    }
    const matchByDate = allEvents.find((e) => e.date === startDate || e.date === eventDate);
    if (matchByDate) return String(matchByDate.id);
    return allEvents[0]?.id ? String(allEvents[0].id) : '';
  }, [activeEventId, allEvents, eventDate, startDate]);

  // Handle disaster event dropdown selection with automatic start & end date binding
  const handleEventSelect = (selectedId: string) => {
    if (!selectedId) return;
    if (onEventChange) {
      onEventChange(selectedId);
    }
    const chosen = allEvents.find((e) => String(e.id) === String(selectedId));
    if (chosen && onDateRangeChange) {
      const sDate = chosen.date
        ? chosen.date.length >= 10 && !isNaN(new Date(chosen.date).getTime())
          ? chosen.date.slice(0, 10)
          : chosen.date
        : '';
      let eDate = '';
      if (chosen.endDate && chosen.endDate.length >= 10 && !isNaN(new Date(chosen.endDate).getTime())) {
        eDate = chosen.endDate.slice(0, 10);
      } else if (sDate) {
        const d = new Date(`${sDate}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + 31);
        eDate = d.toISOString().slice(0, 10);
      }
      if (sDate && eDate) {
        onDateRangeChange(sDate, eDate);
      }
    }
  };

  // Pre-index valid records by municipality PCODE for the active event window
  const recordsByPcode = useMemo(() => {
    const map = new Map<string, RecoveryRecord[]>();
    const validRecords = records.filter((record) => record.r_t !== null && record.r_t !== undefined);

    for (const record of validRecords) {
      if ((startDate && record.date < startDate) || (endDate && record.date > endDate)) continue;
      const municipalityRecords = map.get(record.pcode) ?? [];
      municipalityRecords.push(record);
      map.set(record.pcode, municipalityRecords);
    }
    return map;
  }, [endDate, records, startDate]);

  // Determine which municipalities to display based on viewMode or selectedId
  const featured = useMemo(() => {
    if (selectedId) {
      const sel = municipalities.find((m) => m.id === selectedId);
      if (sel) return [sel];
    }

    if (viewMode === 'critical') {
      // Top 4 municipalities with the lowest Day-0 recovery scores across the active event,
      // directly aligned with the sorting and data shown in the Municipal Resilience Index table
      return [...municipalities]
        .filter((m) => records.length === 0 || (recordsByPcode.get(m.id)?.length ?? 0) > 0)
        .sort((a, b) => a.recoveryScore - b.recoveryScore || a.name.localeCompare(b.name))
        .slice(0, 4);
    }

    // Default viewMode === 'hubs': Largest municipality per province, sorted by score
    const byProvince = new Map<string, Municipality>();
    for (const m of municipalities) {
      if (!byProvince.has(m.province) || m.population > byProvince.get(m.province)!.population) {
        byProvince.set(m.province, m);
      }
    }
    return Array.from(byProvince.values()).sort((a, b) => b.recoveryScore - a.recoveryScore);
  }, [municipalities, selectedId, viewMode, records.length, recordsByPcode]);

  const series = useMemo(() => {
    return featured
      .map((m) => ({
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
      }))
      .filter((seriesItem) => seriesItem.data.length > 0);
  }, [featured, recordsByPcode]);

  // Handle switching view mode tabs
  const handleModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (selectedId && onSelect) {
      onSelect(null);
    }
  };

  // Chart dimensions
  const W = 760;
  const H = 320;
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };
  const innerW = W - margin.left - margin.right;
  const innerH = H - margin.top - margin.bottom;

  // Build a complete day-by-day spine covering the full selected date window.
  // This ensures the X-axis always spans [startDate, endDate] even when observations
  // are sparse or only cover a subset of the selected range.
  const fullTimeline = useMemo(() => {
    const buildRange = (from: string, to: string): string[] => {
      const dates: string[] = [];
      const cur = new Date(`${from}T00:00:00Z`);
      const end = new Date(`${to}T00:00:00Z`);
      while (cur <= end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
      return dates;
    };

    // Collect all unique observation dates to determine actual data bounds
    const obsDates = new Set<string>();
    series.forEach((s) => s.data.forEach((d) => obsDates.add(d.date)));
    const sortedObs = Array.from(obsDates).sort();

    const rangeStart = startDate || sortedObs[0];
    const rangeEnd = endDate || sortedObs[sortedObs.length - 1];

    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      // Fall back to just the observation dates if range is undefined
      return sortedObs;
    }
    return buildRange(rangeStart, rangeEnd);
  }, [endDate, series, startDate]);

  const pointCount = fullTimeline.length;
  // Map a date string to its exact pixel X position within the full timeline
  const dateToX = (dateStr: string): number => {
    const idx = fullTimeline.indexOf(dateStr);
    if (idx < 0) return margin.left; // date not in range — shouldn't occur normally
    return margin.left + (pointCount > 1 ? (idx / (pointCount - 1)) * innerW : innerW / 2);
  };
  const xScale = (i: number) => margin.left + (pointCount > 1 ? (i / (pointCount - 1)) * innerW : innerW / 2);
  const yScale = (score: number) => margin.top + innerH - (score / 100) * innerH;

  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
      month: '2-digit',
      day: 'numeric',
      timeZone: 'UTC',
    });

  const dateRange =
    fullTimeline.length > 1
      ? `${formatDate(fullTimeline[0])} - ${formatDate(fullTimeline[fullTimeline.length - 1])}`
      : fullTimeline[0]
        ? formatDate(fullTimeline[0])
        : eventDate
          ? formatDate(eventDate)
          : 'No valid observations';

  const eventMarkerIndex = fullTimeline.findIndex((d) => d >= (eventDate ?? ''));
  const markerX = eventMarkerIndex >= 0 ? xScale(eventMarkerIndex) : xScale(0);

  // Dynamic palette reflecting whether tracking provincial hubs or critical vulnerability targets
  const lineColors = useMemo(() => {
    if (viewMode === 'critical') {
      return ['#f43f5e', '#fb923c', '#fbbf24', '#c084fc'];
    }
    return ['#38bdf8', '#34d399', '#fbbf24', '#f43f5e'];
  }, [viewMode]);

  // Dynamic subtitle reflecting active display mode
  const subtitle = useMemo(() => {
    if (selectedId) {
      return `Day-by-day recovery curve for ${featured[0]?.name ?? 'selected municipality'} (${featured[0]?.province ?? 'Panay'}) · ${
        viewMode === 'critical' ? 'Critical vulnerability target' : 'Regional provincial hub'
      }`;
    }
    if (viewMode === 'critical') {
      return 'Top 4 hardest-hit municipalities with lowest Day-0 recovery scores across active event · Critical vulnerability targets';
    }
    return 'Major regional capitals and provincial hubs · Continuous API observations';
  }, [featured, selectedId, viewMode]);

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-900/60 backdrop-blur-sm overflow-hidden shadow-xl">
      {/* Header with Title and View-Mode Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">Comparative Recovery Curves</h3>
            <span
              className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-md border ${
                viewMode === 'critical'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  : 'bg-ocean-500/10 text-ocean-300 border-ocean-500/20'
              }`}
            >
              {viewMode === 'critical' ? 'Critical Targets' : 'Regional Hubs'}
            </span>
          </div>
          <p className="text-xs text-ink-400 mt-1">{subtitle}</p>
        </div>

        {/* View Mode Toggle Controls */}
        <div className="flex items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-ink-950/80 border border-white/10 shadow-inner">
            <button
              type="button"
              onClick={() => handleModeChange('hubs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'hubs' && !selectedId
                  ? 'bg-ocean-500/20 text-ocean-300 border border-ocean-500/30 shadow-sm'
                  : 'text-ink-400 hover:text-ink-200 hover:bg-white/5 border border-transparent'
              }`}
              title="Track major regional capitals and economic hubs across Panay"
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>Largest Hubs per Province</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('critical')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'critical' && !selectedId
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-sm'
                  : 'text-ink-400 hover:text-ink-200 hover:bg-white/5 border border-transparent'
              }`}
              title="Inspect top 4 municipalities with lowest Day-0 scores"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Most Critical / Hardest-Hit</span>
            </button>
          </div>
        </div>
      </div>

      {/* Single selection focus notice */}
      {selectedId && (
        <div className="px-5 py-2.5 bg-ocean-500/10 border-b border-ocean-500/20 flex items-center justify-between text-xs">
          <span className="text-ocean-200">
            Focused on <strong>{featured[0]?.name}</strong> ({featured[0]?.province})
          </span>
          <button
            type="button"
            onClick={() => onSelect?.(null)}
            className="flex items-center gap-1 text-ink-300 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Show all {viewMode === 'critical' ? 'critical targets' : 'provincial hubs'}</span>
          </button>
        </div>
      )}

      <div className="p-5">
        {/* Event & Date Range Filter Toolbar */}
        <div className="mb-4 flex flex-wrap items-end gap-3 pb-4 border-b border-white/5">
          {/* Select Event Dropdown */}
          <div className="min-w-[260px] flex-1 sm:flex-initial">
            <label htmlFor="recovery-event-select" className="mb-1 flex items-center gap-1.5 text-xs font-medium text-ink-300">
              <Layers className="h-3.5 w-3.5 text-ocean-400" />
              <span>Select Event</span>
            </label>
            <div className="relative">
              <select
                id="recovery-event-select"
                name="event"
                value={currentEventId}
                onChange={(event) => handleEventSelect(event.target.value)}
                className="w-full rounded-md border border-white/10 bg-ink-950 py-2 pl-3 pr-8 text-sm font-medium text-white shadow-sm transition-colors [color-scheme:dark] hover:border-white/20 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
              >
                {allEvents.map((evt) => (
                  <option key={evt.id} value={evt.id} className="bg-ink-950 text-white py-1">
                    {evt.name} ({evt.date ? evt.date.slice(0, 10) : 'N/A'})
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            </div>
          </div>

          {/* Date Range Pickers */}
          {onDateRangeChange && (
            <div className="flex items-end gap-2.5 flex-wrap">
              <div>
                <label htmlFor="recovery-start-date" className="mb-1 block text-xs font-medium text-ink-400">Start date</label>
                <div className="relative">
                  <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="recovery-start-date"
                    name="start"
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(event) => onDateRangeChange(event.target.value, endDate)}
                    className="rounded-md border border-white/10 bg-ink-950 py-2 pl-9 pr-3 text-sm text-white shadow-sm [color-scheme:dark] focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
              <span className="pb-2 text-sm text-ink-400">to</span>
              <div>
                <label htmlFor="recovery-end-date" className="mb-1 block text-xs font-medium text-ink-400">End date</label>
                <div className="relative">
                  <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    id="recovery-end-date"
                    name="end"
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => onDateRangeChange(startDate, event.target.value)}
                    className="rounded-md border border-white/10 bg-ink-950 py-2 pl-9 pr-3 text-sm text-white shadow-sm [color-scheme:dark] focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Legend and Timeline Window Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            {viewMode === 'critical' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5" />
                Critical Vulnerability Targets (Hardest-Hit)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ocean-400 uppercase tracking-wider">
                <Building2 className="h-3.5 w-3.5" />
                Provincial Regional Hubs
              </span>
            )}
            <span className="text-xs text-ink-500">
              · {series.length} {series.length === 1 ? 'curve' : 'curves'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg w-fit">
            <TrendingUp className="h-3.5 w-3.5" />
            <span>Timeline window · {dateRange}</span>
          </div>
        </div>

        {/* Legend Chips */}
        <div className="flex flex-wrap gap-2.5 mb-4">
          {series.map((s, i) => (
            <div
              key={s.municipality.id}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                viewMode === 'critical'
                  ? 'bg-rose-500/5 border-rose-500/20 shadow-sm'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div
                className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: lineColors[i % lineColors.length] }}
              />
              <span className="text-xs text-white font-medium">{s.municipality.name}</span>
              {viewMode === 'critical' ? (
                <span className="text-[10px] font-semibold text-rose-300 bg-rose-500/20 px-1.5 py-0.5 rounded border border-rose-500/30">
                  #{i + 1} Lowest ({s.municipality.recoveryScore}%)
                </span>
              ) : (
                <span className="text-[10px] text-ink-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                  {s.municipality.province} Hub
                </span>
              )}
            </div>
          ))}
        </div>

        {series.length === 0 ? (
          <div className="rounded-xl border border-white/5 bg-ink-950/50 px-4 py-8 text-center text-sm text-ink-400">
            No valid VIIRS recovery observations are available during this date range.
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
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  transform: 'rotate(-90deg)',
                  transformOrigin: '14px 170px',
                }}
              >
                Recovery Score (%)
              </text>

              {/* X axis labels — sampled from the full timeline for readability */}
              {fullTimeline.map((dateStr, index) => {
                if (
                  fullTimeline.length > 7 &&
                  ![0, Math.floor((fullTimeline.length - 1) / 2), fullTimeline.length - 1].includes(index)
                ) {
                  return null;
                }
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
                // Map each observed data point to its exact X position within the full timeline
                const isSingle = s.data.length === 1;
                const firstPt = s.data[0];
                const lastPt = s.data[s.data.length - 1];
                const firstX = dateToX(firstPt.date);
                const lastX = dateToX(lastPt.date);

                const pathData = isSingle
                  ? `M ${firstX - 15} ${yScale(firstPt.recoveryScore)} L ${firstX + 15} ${yScale(firstPt.recoveryScore)}`
                  : s.data
                      .map((pt, j) => {
                        const x = dateToX(pt.date);
                        const y = yScale(pt.recoveryScore);
                        return `${j === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ');

                const areaPath = !isSingle
                  ? `M ${firstX} ${yScale(firstPt.recoveryScore)} ` +
                    s.data.map((pt) => `L ${dateToX(pt.date)} ${yScale(pt.recoveryScore)}`).join(' ') +
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
              <div
                key={s.municipality.id}
                className={`rounded-xl bg-ink-950/50 border p-3 transition-colors ${
                  viewMode === 'critical' ? 'border-rose-500/15' : 'border-white/5'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="h-2 w-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: lineColors[i % lineColors.length] }}
                    />
                    <span className="text-xs font-medium text-ink-200 truncate">{s.municipality.name}</span>
                  </div>
                  {viewMode === 'critical' ? (
                    <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                      #{i + 1}
                    </span>
                  ) : (
                    <span className="text-[10px] text-ink-400 flex-shrink-0">{s.municipality.province}</span>
                  )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-white">{end}%</span>
                  <span
                    className={`text-xs flex items-center gap-0.5 ${
                      delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-ink-400'
                    }`}
                  >
                    {delta > 0 ? <TrendingUp className="h-3 w-3" /> : delta < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                    {delta > 0 ? '+' : ''}
                    {delta}pt
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-ink-500">
                  <span>Day-0: {start}%</span>
                  <span className="capitalize">{s.municipality.status}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
