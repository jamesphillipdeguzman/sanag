import React, { useEffect, useState, useMemo } from 'react';
import type { Municipality, DisasterEvent } from '@/types';
import { apiFetch } from '@/services/apiService';
import { getRecoveryColor } from '@/data/mockData';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  FileText,
  LayoutGrid,
  ShieldAlert,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface AiBriefingCardProps {
  event: DisasterEvent;
  municipalities: Municipality[];
}

interface ParsedBriefing {
  rawMarkdown: string;
  summary: string;
  criticalAlerts: string[];
  benchmarks: string[];
  recommendations: string[];
  otherSections: { title: string; content: string }[];
  source: 'gemini' | 'fallback';
}

export default function AiBriefingCard({ event, municipalities }: AiBriefingCardProps) {
  const [briefingData, setBriefingData] = useState<ParsedBriefing | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'structured' | 'markdown'>('structured');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Derived telemetry metrics
  const sorted = useMemo(
    () => [...municipalities].sort((a, b) => a.recoveryScore - b.recoveryScore),
    [municipalities]
  );
  const critical = useMemo(
    () => sorted.filter((m) => m.status === 'critical' || m.status === 'warning' || m.recoveryScore < 60),
    [sorted]
  );
  // Strict threshold filtering: only select municipalities where recovery score actually meets or exceeds 90%
  const restored = useMemo(
    () => [...municipalities].filter((m) => m.recoveryScore >= 90).sort((a, b) => b.recoveryScore - a.recoveryScore),
    [municipalities]
  );
  // Accurately sorted descending for highest-performing tiers
  const topPerforming = useMemo(
    () => [...municipalities].sort((a, b) => b.recoveryScore - a.recoveryScore),
    [municipalities]
  );
  const totalCount = municipalities.length || 1;
  const avgScore = useMemo(
    () => Math.round(sorted.reduce((s, m) => s + m.recoveryScore, 0) / totalCount),
    [sorted, totalCount]
  );

  // Priority LGUs: Populate a robust list of multiple critical municipalities (top 4-5 severely affected LGUs)
  // Ensures the priority areas widget and context string always reflect multiple LGUs rather than being truncated.
  const priorityLGUs = useMemo(() => {
    if (critical.length >= 5) {
      return critical.slice(0, 5);
    }
    const combined = [...critical];
    const seen = new Set(critical.map((m) => m.id));
    for (const m of sorted) {
      if (!seen.has(m.id)) {
        combined.push(m);
        seen.add(m.id);
        if (combined.length >= 5) break;
      }
    }
    return combined;
  }, [critical, sorted]);

  const fetchBriefing = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    const hasRestored = restored.length > 0;
    const benchmarkHeader = hasRestored
      ? 'Top Benchmark Restored LGUs (>= 90%)'
      : 'Top Performing Hubs (Sub-90% Leading Tiers)';
    const benchmarkLGUs = hasRestored ? restored.slice(0, 3) : topPerforming.slice(0, 3);
    const benchmarkString = benchmarkLGUs
      .map((m) => `${m.name} (${m.province}): ${m.recoveryScore}% score`)
      .join('; ');

    const contextString = `
Disaster Incident: ${event.name} (${event.date})
Incident Severity: ${event.severity} | Category: ${event.type}
Total Municipalities Monitored: ${municipalities.length}
Island-wide Average Recovery Score: ${avgScore}%
Municipalities >= 90% Restored: ${restored.length}
Municipalities in Critical/Warning State (<60%): ${critical.length}
Top Critical Outage LGUs: ${priorityLGUs
        .slice(0, 5)
        .map(
          (m) =>
            `${m.name} (${m.province}): ${m.recoveryScore}% score, est ${m.estimatedDaysToRecover} days to recover`
        )
        .join('; ')}
${benchmarkHeader}: ${benchmarkString}
`.trim();

    try {
      // Send both via body and query param to guarantee compatibility with FastAPI
      const url = `/api/generate-briefing?event_context=${encodeURIComponent(contextString)}`;
      const response = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_context: contextString }),
      });

      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }

      const payload = await response.json();
      const parsed = parseBriefingResponse(payload, event, avgScore, critical, restored, municipalities.length, topPerforming);
      setBriefingData(parsed);
    } catch (err: any) {
      console.warn('FastAPI Gemini briefing fetch issue, using local telemetry synthesis fallback:', err?.message);
      setErrorMsg(err?.message || 'Connection error');
      const fallback = createFallbackBriefing(event, avgScore, critical, restored, municipalities.length, topPerforming);
      setBriefingData(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (event?.name && municipalities.length > 0) {
      fetchBriefing();
    }
  }, [event?.id, municipalities.length]);

  return (
    <div id="briefing" className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-ink-900/60 backdrop-blur-sm overflow-hidden shadow-lg dark:shadow-2xl transition-colors">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-ink-950/40">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-emerald-500 shadow-md shadow-ocean-500/20">
            <Sparkles className={`h-5 w-5 text-white ${isLoading ? 'animate-spin' : ''}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Situational Briefing</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-ocean-50 text-ocean-700 border border-ocean-200 dark:bg-ocean-500/10 dark:text-ocean-300 dark:border-ocean-500/25">
                {isLoading ? 'Synthesizing...' : briefingData?.source === 'gemini' ? 'Gemini 2.0 Flash' : 'Satellite Telemetry'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-ink-400 mt-0.5">
              Incident: <span className="text-slate-900 dark:text-white font-medium">{event.name}</span> · VIIRS Radiance Metrics ·{' '}
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* View toggles & actions */}
        <div className="flex items-center gap-2">
          {!isLoading && briefingData && (
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-ink-950/60 p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('structured')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${activeTab === 'structured'
                  ? 'bg-white text-ocean-700 shadow-sm border border-slate-200 dark:bg-ocean-500/20 dark:text-ocean-200 dark:border-ocean-500/30'
                  : 'text-slate-600 hover:text-slate-900 dark:text-ink-400 dark:hover:text-white'
                  }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Structured View</span>
                <span className="sm:hidden">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('markdown')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${activeTab === 'markdown'
                  ? 'bg-white text-ocean-700 shadow-sm border border-slate-200 dark:bg-ocean-500/20 dark:text-ocean-200 dark:border-ocean-500/30'
                  : 'text-slate-600 hover:text-slate-900 dark:text-ink-400 dark:hover:text-white'
                  }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Full Markdown</span>
                <span className="sm:hidden">Doc</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={fetchBriefing}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-semibold dark:text-ink-300 dark:hover:text-white transition-all cursor-pointer disabled:opacity-50"
            title="Refresh AI briefing"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Regenerate</span>
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {isLoading ? (
          /* Loading Skeleton State */
          <div className="animate-pulse space-y-5">
            <div className="rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 space-y-2.5">
              <div className="h-4 w-36 rounded bg-slate-200 dark:bg-white/20" />
              <div className="h-3 w-full rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-white/10" />
              <div className="h-3 w-4/6 rounded bg-slate-200 dark:bg-white/10" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded bg-slate-200 dark:bg-white/20" />
                    <div className="h-3 w-24 rounded bg-slate-200 dark:bg-white/20" />
                  </div>
                  <div className="h-2.5 w-full rounded bg-slate-200 dark:bg-white/10" />
                  <div className="h-2.5 w-4/5 rounded bg-slate-200 dark:bg-white/10" />
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 p-4 space-y-3">
              <div className="h-3 w-48 rounded bg-slate-200 dark:bg-white/20" />
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 rounded-lg bg-slate-200 dark:bg-white/5" />
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'markdown' ? (
          /* Full Raw Markdown Document View */
          <div className="rounded-xl bg-slate-50 dark:bg-ink-950/50 border border-slate-200 dark:border-white/10 p-5 sm:p-6 transition-colors">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-ink-400">
              <span className="font-semibold text-ocean-600 dark:text-ocean-300 uppercase tracking-wider">
                Full AI Document Response
              </span>
              <span>Markdown Render Mode</span>
            </div>
            <MarkdownContent content={briefingData?.rawMarkdown || ''} />
          </div>
        ) : (
          /* Structured Cards View */
          <div className="space-y-6">
            {/* 1. Executive Summary Card */}
            {briefingData?.summary && (
              <div className="rounded-xl bg-ocean-50/80 border border-ocean-200 dark:bg-gradient-to-r dark:from-ocean-500/10 dark:via-ink-900/60 dark:to-ink-900/80 dark:border-ocean-500/25 p-4 sm:p-5 shadow-sm dark:shadow-lg transition-colors">
                <div className="flex items-center gap-2 mb-2.5">
                  <Sparkles className="h-4 w-4 text-ocean-500 dark:text-ocean-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ocean-700 dark:text-ocean-300">
                    Executive Situation Summary
                  </h4>
                </div>
                <MarkdownContent content={briefingData.summary} />
              </div>
            )}

            {/* 2. Structured Key Takeaways Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* Critical Alerts Card */}
              <div className="rounded-xl bg-rose-50/70 border border-rose-200 dark:bg-rose-500/5 dark:border-rose-500/20 p-4 flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                        <ShieldAlert className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                        Critical Alerts
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30">
                      {briefingData?.criticalAlerts.length || critical.length} Flags
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700 dark:text-ink-200">
                    {(briefingData?.criticalAlerts && briefingData.criticalAlerts.length > 0
                      ? briefingData.criticalAlerts
                      : [
                        `${critical.length} municipalities remain below baseline radiance, with southern Antique and inland highlands experiencing extended restoration lags.`,
                        `Critical infrastructure in ${critical[0]?.name || 'impacted LGUs'} operating on emergency secondary power.`,
                      ]
                    ).map((alert, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 dark:bg-rose-400 mt-1.5 shrink-0" />
                        <span className="flex-1">{renderInlineFormatting(alert)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Restoration Benchmarks Card */}
              <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-500/5 dark:border-emerald-500/20 p-4 flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                        {restored.length > 0 ? 'Restoration Benchmarks' : 'Top Performing Hubs'}
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30">
                      {restored.length} Restored
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700 dark:text-ink-200">
                    {(briefingData?.benchmarks && briefingData.benchmarks.length > 0
                      ? briefingData.benchmarks
                      : (restored.length > 0
                        ? [
                          `Near-full recovery thresholds (>= 90%) confirmed in ${restored.length} municipalities: ${restored.slice(0, 3).map((m) => `${m.name} (${m.recoveryScore}%)`).join(', ')}.`,
                          `Island-wide recovery velocity reached ${avgScore}% baseline radiance across ${municipalities.length} LGUs.`,
                        ]
                        : [
                          `No municipalities have crossed the >= 90% restoration threshold yet. Highest-performing hubs: ${topPerforming.slice(0, 3).map((m) => `${m.name} (${m.recoveryScore}%)`).join(', ')}.`,
                          `Island-wide recovery average currently tracks at ${avgScore}% baseline radiance across ${municipalities.length} LGUs.`,
                        ]
                      )
                    ).map((benchmark, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 mt-1.5 shrink-0" />
                        <span className="flex-1">{renderInlineFormatting(benchmark)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Priority Recommendations Card */}
              <div className="rounded-xl bg-ocean-50/70 border border-ocean-200 dark:bg-ocean-500/5 dark:border-ocean-500/20 p-4 flex flex-col justify-between transition-colors">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ocean-100 text-ocean-700 dark:bg-ocean-500/20 dark:text-ocean-400">
                        <Zap className="h-4 w-4" />
                      </div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-ocean-700 dark:text-ocean-300">
                        Response Actions
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-ocean-100 text-ocean-700 border border-ocean-200 dark:bg-ocean-500/15 dark:text-ocean-300 dark:border-ocean-500/30">
                      Targeted Next Steps
                    </span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700 dark:text-ink-200">
                    {(briefingData?.recommendations && briefingData.recommendations.length > 0
                      ? briefingData.recommendations
                      : [
                        'Deploy mobile generators to unpowered municipal water pumping and district hospital stations.',
                        'Coordinate Task Force Kapatid lineman crews from ILECO I & II to reinforce ANTECO distribution lines.',
                        'Utilize daily VIIRS nightlight radiance passes to verify feeder re-energization reports.',
                      ]
                    ).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 leading-relaxed">
                        <span className="h-1.5 w-1.5 rounded-full bg-ocean-500 dark:bg-ocean-400 mt-1.5 shrink-0" />
                        <span className="flex-1">{renderInlineFormatting(rec)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* 3. Additional Markdown Sections (Preserving all details without clipping) */}
            {briefingData?.otherSections && briefingData.otherSections.length > 0 && (
              <div className="space-y-3">
                {briefingData.otherSections.map((sec, idx) => (
                  <div key={idx} className="rounded-xl bg-slate-50 dark:bg-ink-950/40 border border-slate-200 dark:border-white/5 p-4 transition-colors">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-ink-300 mb-2">
                      {sec.title}
                    </h5>
                    <MarkdownContent content={sec.content} />
                  </div>
                ))}
              </div>
            )}

            {/* 4. Priority Areas Table Needing Immediate Assistance */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-slate-600 dark:text-ink-400 uppercase tracking-wider">
                  Top Priority Areas Needing Immediate Assistance
                </h4>
                <span className="text-xs text-slate-500 dark:text-ink-400">Ranked by lowest recovery score</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {priorityLGUs.slice(0, 4).map((m, i) => (
                  <div
                    key={m.id}
                    className="flex flex-col justify-between rounded-xl bg-slate-50 dark:bg-ink-950/50 border border-slate-200 dark:border-white/10 p-3.5 hover:border-ocean-300 dark:hover:border-ocean-500/30 transition-all shadow-sm dark:shadow-md"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-slate-500 dark:text-ink-400">#{i + 1} LGU</span>
                        <span
                          className="text-xs font-bold px-2 py-0.5 rounded-full"
                          style={{
                            color: getRecoveryColor(m.recoveryScore),
                            backgroundColor: `${getRecoveryColor(m.recoveryScore)}18`,
                          }}
                        >
                          {m.recoveryScore}%
                        </span>
                      </div>
                      <h5 className="text-sm font-bold text-slate-900 dark:text-white truncate">{m.name}</h5>
                      <span className="text-xs text-slate-500 dark:text-ink-400">{m.province} Province</span>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-ink-400">
                      <span>Est. Days:</span>
                      <span className="font-semibold text-slate-800 dark:text-ink-200">
                        {m.estimatedDaysToRecover === 0 ? 'Restored' : `${m.estimatedDaysToRecover} days`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Disclaimer / Telemetry Citation */}
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-ink-500">
          <p>
            AI situational briefings are computed using NASA VIIRS satellite day-night band observations. Always
            verify with local utility command centers (ILECO, ANTECO, CAPELCO, AKELCO).
          </p>
          <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-ink-400">
            Engine: {briefingData?.source === 'gemini' ? 'Gemini 2.0 Flash API' : 'SANAG Telemetry Synthesis'}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- Markdown Rendering Components ---

function renderInlineFormatting(text: string): React.ReactNode {
  if (!text) return '';
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={match.index} className="font-semibold text-slate-900 dark:text-white">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={match.index} className="italic text-slate-700 dark:text-ink-200">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code key={match.index} className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-white/10 text-ocean-700 dark:text-ocean-300 font-mono text-xs">
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function MarkdownContent({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const pText = paragraphBuffer.join(' ').trim();
      if (pText) {
        elements.push(
          <p key={`p-${elements.length}`} className="text-sm text-slate-700 dark:text-ink-200 leading-relaxed mb-3">
            {renderInlineFormatting(pText)}
          </p>
        );
      }
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      if (currentList.type === 'ul') {
        elements.push(
          <ul key={`ul-${elements.length}`} className="space-y-2 mb-3.5 pl-1">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-ink-200 leading-relaxed">
                <span className="h-1.5 w-1.5 rounded-full bg-ocean-500 dark:bg-ocean-400 mt-2 shrink-0" />
                <span className="flex-1">{renderInlineFormatting(item)}</span>
              </li>
            ))}
          </ul>
        );
      } else {
        elements.push(
          <ol key={`ol-${elements.length}`} className="space-y-2 mb-3.5 list-decimal list-inside text-sm text-slate-700 dark:text-ink-200 leading-relaxed">
            {currentList.items.map((item, idx) => (
              <li key={idx} className="pl-1">
                <span>{renderInlineFormatting(item)}</span>
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('#### ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h5 key={`h5-${elements.length}`} className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-ink-300 mt-3.5 mb-1.5">
          {renderInlineFormatting(line.slice(5))}
        </h5>
      );
    } else if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h4 key={`h4-${elements.length}`} className="text-sm font-bold text-slate-900 dark:text-white mt-4 mb-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ocean-500 dark:bg-ocean-400" />
          {renderInlineFormatting(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h3 key={`h3-${elements.length}`} className="text-base font-extrabold text-slate-900 dark:text-white mt-4 mb-2">
          {renderInlineFormatting(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      elements.push(
        <h2 key={`h2-${elements.length}`} className="text-lg font-black text-slate-900 dark:text-white mt-4 mb-2">
          {renderInlineFormatting(line.slice(2))}
        </h2>
      );
    } else if (/^[-*+•]\s+/.test(line)) {
      flushParagraph();
      const itemText = line.replace(/^[-*+•]\s+/, '');
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
    } else if (/^\d+\.\s+/.test(line)) {
      flushParagraph();
      const itemText = line.replace(/^\d+\.\s+/, '');
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
    } else if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      elements.push(
        <blockquote key={`quote-${elements.length}`} className="border-l-2 border-ocean-500/60 pl-3.5 py-1 text-sm italic text-ocean-800 dark:text-ocean-200/90 my-2.5 bg-ocean-50 dark:bg-ocean-500/5 rounded-r-lg">
          {renderInlineFormatting(line.slice(2))}
        </blockquote>
      );
    } else {
      paragraphBuffer.push(line);
    }
  }

  flushParagraph();
  flushList();

  return <div className="space-y-1">{elements}</div>;
}

// --- Response Parser & Fallback Helpers ---

function parseBriefingResponse(
  payload: any,
  event: DisasterEvent,
  avgScore: number,
  critical: Municipality[],
  restored: Municipality[],
  totalMunicipalities: number,
  topPerforming: Municipality[] = []
): ParsedBriefing {
  let rawText = '';
  let summary = '';
  let criticalAlerts: string[] = [];
  let benchmarks: string[] = [];
  let recommendations: string[] = [];
  const otherSections: { title: string; content: string }[] = [];

  // 1. Extract raw text or JSON object
  if (typeof payload === 'string') {
    rawText = payload;
  } else if (payload?.briefing && typeof payload.briefing === 'string') {
    rawText = payload.briefing;
  } else if (payload?.briefing && typeof payload.briefing === 'object') {
    return extractStructuredObject(payload.briefing, 'gemini');
  } else if (payload && typeof payload === 'object' && (payload.summary || payload.critical_alerts)) {
    return extractStructuredObject(payload, 'gemini');
  }

  // Check if rawText is a JSON string (e.g. from ```json ... ```)
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const potentialJson = jsonMatch ? jsonMatch[1] : rawText.trim();
  if (potentialJson.startsWith('{') && potentialJson.endsWith('}')) {
    try {
      const parsedObj = JSON.parse(potentialJson);
      return extractStructuredObject(parsedObj, 'gemini');
    } catch {
      // Continue to markdown parsing
    }
  }

  // 2. Parse Markdown Sections
  const sections = rawText.split(/(?=^#{2,4}\s+)/m);
  let hasParsedSections = false;

  for (const sec of sections) {
    const trimmed = sec.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^#{2,4}\s+(.+)$/m);
    const heading = headingMatch ? headingMatch[1].trim() : '';
    const body = headingMatch ? trimmed.slice(headingMatch[0].length).trim() : trimmed;
    const lowerHeading = heading.toLowerCase();

    if (lowerHeading.includes('summary') || lowerHeading.includes('overview') || lowerHeading.includes('situation')) {
      summary = body;
      hasParsedSections = true;
    } else if (lowerHeading.includes('critical') || lowerHeading.includes('alert') || lowerHeading.includes('outage') || lowerHeading.includes('vulnerab')) {
      criticalAlerts = extractBullets(body);
      hasParsedSections = true;
    } else if (lowerHeading.includes('benchmark') || lowerHeading.includes('milestone') || lowerHeading.includes('restor') || lowerHeading.includes('performing') || lowerHeading.includes('hub')) {
      benchmarks = extractBullets(body);
      hasParsedSections = true;
    } else if (lowerHeading.includes('recommend') || lowerHeading.includes('action') || lowerHeading.includes('next step') || lowerHeading.includes('takeaway')) {
      recommendations = extractBullets(body);
      hasParsedSections = true;
    } else if (heading) {
      otherSections.push({ title: heading, content: body });
    } else if (!summary) {
      summary = body;
    }
  }

  // If no sections were identified, use rawText as summary
  if (!hasParsedSections && !summary) {
    summary = rawText;
  }

  return {
    rawMarkdown: rawText,
    summary,
    criticalAlerts,
    benchmarks,
    recommendations,
    otherSections,
    source: 'gemini',
  };
}

function extractBullets(text: string): string[] {
  const lines = text.split('\n');
  const items: string[] = [];
  let current = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*+•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      if (current) items.push(current);
      current = trimmed.replace(/^[-*+•\d.]\s+/, '').trim();
    } else if (trimmed) {
      if (current) current += ' ' + trimmed;
      else current = trimmed;
    }
  }
  if (current) items.push(current);
  return items.length > 0 ? items : [text.trim()];
}

function extractStructuredObject(obj: any, source: 'gemini' | 'fallback'): ParsedBriefing {
  const summary = obj.summary || obj.executive_summary || obj.overview || '';
  const criticalAlerts = normalizeArray(obj.critical_alerts || obj['critical alerts'] || obj.criticalAlerts || obj.alerts || []);
  const benchmarks = normalizeArray(obj.benchmarks || obj.restoration_benchmarks || obj.milestones || []);
  const recommendations = normalizeArray(obj.recommendations || obj.priority_recommendations || obj.takeaways || []);

  const rawMarkdown = `### Executive Summary\n${summary}\n\n### Critical Alerts\n${criticalAlerts.map((a: string) => `* ${a}`).join('\n')}\n\n### Restoration Benchmarks\n${benchmarks.map((b: string) => `* ${b}`).join('\n')}\n\n### Priority Recommendations\n${recommendations.map((r: string) => `* ${r}`).join('\n')}`;

  return {
    rawMarkdown,
    summary,
    criticalAlerts,
    benchmarks,
    recommendations,
    otherSections: [],
    source,
  };
}

function normalizeArray(val: any): string[] {
  if (Array.isArray(val)) return val.map((item) => (typeof item === 'string' ? item : JSON.stringify(item)));
  if (typeof val === 'string') return extractBullets(val);
  return [];
}

function createFallbackBriefing(
  event: DisasterEvent,
  avgScore: number,
  critical: Municipality[],
  restored: Municipality[],
  totalCount: number,
  topPerforming: Municipality[] = []
): ParsedBriefing {
  const criticalNames = critical.slice(0, 3).map((m) => `${m.name} (${m.province})`).join(', ');

  const hasRestored = restored.length > 0;
  const summaryStatus = hasRestored
    ? `Satellite nightlight observations confirm that ${restored.length} of ${totalCount} municipalities have achieved near-full recovery (>= 90%), led by ${restored[0].name} (${restored[0].recoveryScore}%).`
    : `Satellite nightlight observations indicate that 0 of ${totalCount} municipalities have crossed the >= 90% near-full recovery threshold, with leading hubs paced by ${topPerforming[0]?.name || 'commercial centers'} (${topPerforming[0]?.recoveryScore ?? 0}%).`;

  const summary = `Following the ${event.name}, the island-wide municipal recovery average stands at ${avgScore}%. ${summaryStatus} However, ${critical.length} municipalities remain in limited-power states (<60%), exhibiting persistent distribution deficits across rural coastal and highland corridors.`;

  const criticalAlerts = [
    `${critical.length} municipalities register critical power deficits (< 60% baseline radiance), with the heaviest outages concentrated in ${criticalNames || 'southwest Antique'}.`,
    `Distribution line reconductoring and transformer replacement are required before full energization can be restored to low-lying communities.`,
    `Vulnerable coastal healthcare facilities and water pumping stations require dedicated fuel priority for emergency gensets.`,
  ];

  const benchmarks = hasRestored
    ? [
      `Near-full recovery thresholds (>= 90%) confirmed in ${restored.length} municipalities: ${restored.slice(0, 3).map((m) => `${m.name} (${m.recoveryScore}%)`).join(', ')}.`,
      `High-voltage 138kV transmission corridors across Panay remain fully energized, stabilizing regional commercial hubs at >= 90% capacity.`,
    ]
    : [
      `No municipalities have crossed the >= 90% near-full recovery threshold yet. Top-performing hubs currently leading recovery: ${topPerforming.slice(0, 3).map((m) => `${m.name} (${m.recoveryScore}%)`).join(', ')}.`,
      `High-voltage 138kV transmission corridors across Panay remain energized, while feeder-level restoration works to elevate municipal load centers toward the 90% benchmark.`,
    ];

  const recommendations = [
    `Coordinate mutual aid linemen deployments from restored cooperatives (ILECO) to assist ANTECO and CAPELCO.`,
    `Prioritize mobile substation deployment to southwest Antique to relieve overburdened rural feeders.`,
    `Perform consecutive nightly VIIRS-DNB radiance verification to audit utility-reported power restoration figures.`,
  ];

  const rawMarkdown = `### Executive Summary\n${summary}\n\n### Critical Alerts\n${criticalAlerts.map((a) => `* ${a}`).join('\n')}\n\n### Restoration Benchmarks\n${benchmarks.map((b) => `* ${b}`).join('\n')}\n\n### Priority Recommendations\n${recommendations.map((r) => `* ${r}`).join('\n')}`;

  return {
    rawMarkdown,
    summary,
    criticalAlerts,
    benchmarks,
    recommendations,
    otherSections: [],
    source: 'fallback',
  };
}
