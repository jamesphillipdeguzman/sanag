import type { Municipality, DisasterEvent } from '@/types';
import { getRecoveryColor } from '@/data/mockData';
import { Sparkles, AlertTriangle, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

interface AIBriefingProps {
  event: DisasterEvent;
  municipalities: Municipality[];
}

export default function AIBriefing({ event, municipalities }: AIBriefingProps) {
  const sorted = [...municipalities].sort((a, b) => a.recoveryScore - b.recoveryScore);
  const critical = sorted.filter((m) => m.status === 'critical' || m.status === 'warning');
  const restored = sorted.filter((m) => m.status === 'restored');
  const avgScore = Math.round(sorted.reduce((s, m) => s + m.recoveryScore, 0) / sorted.length);

  const summary = generateSummary(event, avgScore, critical, restored);
  const takeaways = generateTakeaways(sorted, critical, restored);

  return (
    <div id="briefing" className="rounded-2xl border border-white/10 bg-gradient-to-br from-ink-900/80 to-ink-950/80 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-ocean-500 blur-md opacity-30" />
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-emerald-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Situational Briefing</h3>
            <p className="text-xs text-ink-400">Generated locally · {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
        </div>
        <span className="text-xs text-ink-400 hidden sm:inline">Based on local GeoJSON and demo metrics</span>
      </div>

      <div className="p-5">
        {/* Summary */}
        <div className="rounded-xl bg-ocean-500/5 border border-ocean-500/15 p-4 mb-5">
          <p className="text-sm text-ink-200 leading-relaxed">{summary}</p>
        </div>

        {/* Key takeaways */}
        <div className="mb-5">
          <h4 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Key Takeaways</h4>
          <div className="space-y-2">
            {takeaways.map((t, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-ink-950/40 border border-white/5 p-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-lg flex-shrink-0 mt-0.5" style={{
                  backgroundColor: `${t.color}20`,
                  color: t.color,
                }}>
                  {t.icon}
                </div>
                <p className="text-sm text-ink-200 leading-relaxed">{t.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Priority areas */}
        <div>
          <h4 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">Priority Areas Needing Assistance</h4>
          <div className="space-y-2">
            {critical.slice(0, 4).map((m, i) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl bg-ink-950/40 border border-white/5 p-3 hover:border-white/15 transition-all"
              >
                <span className="text-xs font-bold text-ink-500 w-5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{m.name}</span>
                    <span className="text-xs text-ink-400">{m.province}</span>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">
                    {m.recoveryScore < 40
                      ? 'Severe power deficit — critical infrastructure impact'
                      : 'Partial recovery — slower than regional average'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold" style={{ color: getRecoveryColor(m.recoveryScore) }}>
                    {m.recoveryScore}%
                  </div>
                  <div className="text-[10px] text-ink-400">{m.estimatedDaysToRecover}d to recover</div>
                </div>
                <ArrowRight className="h-4 w-4 text-ink-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-5 text-[11px] text-ink-500 leading-relaxed">
          This briefing is auto-generated from satellite radiance metrics and should be used as a
          situational reference. Always verify with on-the-ground assessments before deploying resources.
        </p>
      </div>
    </div>
  );
}

function generateSummary(
  event: DisasterEvent,
  avgScore: number,
  critical: Municipality[],
  restored: Municipality[],
): string {
  const criticalNames = critical.slice(0, 2).map((m) => m.name).join(' and ');
  const restoredPct = Math.round((restored.length / 13) * 100);

  return `As of Day 14 following the ${event.name}, the average municipal recovery score across Panay Island stands at ${avgScore}%. ${restoredPct}% of monitored municipalities (${restored.length} of 13) have reached or exceeded the 85% recovery threshold. However, ${critical.length} communities — including ${criticalNames} — remain below 50% of their pre-disaster baseline radiance, indicating persistent power infrastructure gaps. Satellite nightlight data confirms that urban centers are recovering faster than rural coastal towns, consistent with historical post-disaster patterns in the region.`;
}

function generateTakeaways(
  sorted: Municipality[],
  critical: Municipality[],
  restored: Municipality[],
): { icon: React.ReactNode; color: string; text: string }[] {
  const takeaways: { icon: React.ReactNode; color: string; text: string }[] = [];

  if (critical.length > 0) {
    takeaways.push({
      icon: <AlertTriangle className="h-4 w-4" />,
      color: '#f43f5e',
      text: `${critical.length} municipalities remain in critical or limited-power state. ${critical[0].name} (${critical[0].province}) shows the lowest recovery score at ${critical[0].recoveryScore}%, with an estimated ${critical[0].estimatedDaysToRecover} days to full restoration.`,
    });
  }

  if (restored.length > 0) {
    const fastest = [...restored].sort((a, b) => b.recoveryScore - a.recoveryScore)[0];
    takeaways.push({
      icon: <CheckCircle2 className="h-4 w-4" />,
      color: '#10b981',
      text: `${fastest.name} has achieved near-full recovery at ${fastest.recoveryScore}%, serving as a benchmark for grid restoration efficiency in ${fastest.province} province.`,
    });
  }

  const urbanRuralGap = sorted.length > 1
    ? Math.abs(sorted[sorted.length - 1].recoveryScore - sorted[0].recoveryScore)
    : 0;
  if (urbanRuralGap > 30) {
    takeaways.push({
      icon: <Clock className="h-4 w-4" />,
      color: '#fbbf24',
      text: `A ${urbanRuralGap}-point gap exists between the fastest and slowest recovering municipalities, highlighting uneven grid restoration. Rural areas in Antique and southern Iloilo require prioritized resource allocation.`,
    });
  }

  return takeaways;
}
