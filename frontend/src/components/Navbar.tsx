import React, { useState, useEffect } from 'react';
import { Activity, Menu, Moon, RefreshCw, Satellite, Sun, X, BookOpen, Compass, BarChart3, Calendar, Map as MapIcon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useServerHealth } from '@/context/ServerHealthContext';
import { PANAY_GRID_TRANSMISSION_NODES, PANAY_TOTAL_LGUS } from '@/hooks/useLiveCounter';
import packageInfo from '../../package.json';

export const APP_VERSION = packageInfo?.version || '1.2.0';

export type TabId = 'overview' | 'map' | 'recovery' | 'events' | 'guide';

export interface NavTabItem {
  id: TabId;
  label: string;
  href: string;
  icon?: React.ReactNode;
}

export const navLinks: NavTabItem[] = [
  { id: 'overview', label: 'Overview', href: '#overview' },
  { id: 'map', label: 'Map', href: '#map' },
  { id: 'recovery', label: 'Recovery', href: '#recovery' },
  { id: 'events', label: 'Events', href: '#events' },
  { id: 'guide', label: 'Guide & Glossary', href: '#guide' },
];

export interface NavbarProps {
  activeTab?: string;
  onSelectTab?: (tab: TabId) => void;
  reportingStationsCount?: number;
  totalLgus?: number;
}

export default function Navbar({
  activeTab = 'overview',
  onSelectTab,
  reportingStationsCount,
  totalLgus,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const {
    isOnline,
    isWaking,
    isOffline,
    isReconnecting,
    isRefetching,
    hasConnectionError,
    refetchAll,
  } = useServerHealth();

  const stationsCount = reportingStationsCount ?? PANAY_GRID_TRANSMISSION_NODES;
  const lgusCount = totalLgus ?? PANAY_TOTAL_LGUS;

  // Determine grounded telemetry status based on genuine API status probe
  const isServerWakingState = isWaking || (isReconnecting && !isOffline);
  const isServerOfflineState = isOffline && !isWaking;

  let badgeBorderBg = 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  let badgeLabel = `${stationsCount} Active Stations · ${lgusCount} LGUs`;
  let badgeMobileLabel = `${stationsCount} Active Stations`;
  let badgeTooltip = `Panay Grid Telemetry: ${stationsCount} Active Monitoring Stations · ${lgusCount} LGUs Monitored (API Status: Online)`;
  let hasPingDot = true;
  let dotPingClass = 'bg-emerald-400 opacity-75';
  let dotSolidClass = 'bg-emerald-500';

  if (isServerWakingState) {
    badgeBorderBg = 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    badgeLabel = `Waking Server · ${lgusCount} LGUs`;
    badgeMobileLabel = 'Waking Server';
    badgeTooltip = `Backend cold-start in progress. Monitoring ${lgusCount} LGUs via local cache.`;
    hasPingDot = true;
    dotPingClass = 'bg-amber-400 opacity-75';
    dotSolidClass = 'bg-amber-500';
  } else if (isServerOfflineState) {
    badgeBorderBg = 'border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-ink-300';
    badgeLabel = `Local Cache · ${lgusCount} LGUs`;
    badgeMobileLabel = 'Local Cache';
    badgeTooltip = `Backend currently unreachable. Operating on cached local baseline data across ${lgusCount} LGUs.`;
    hasPingDot = false;
    dotSolidClass = 'bg-slate-400 dark:bg-slate-500';
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    onSelectTab?.('overview');
    if (typeof window !== 'undefined' && window.location.hash !== '#overview') {
      window.history.replaceState(null, '', '#overview');
    }
    if (hasConnectionError || isOffline || isWaking) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      refetchAll();
    }
  };

  const handleLiveStatusClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await refetchAll();
  };

  const handleTabClick = (e: React.MouseEvent, link: NavTabItem) => {
    e.preventDefault();
    onSelectTab?.(link.id);
    if (typeof window !== 'undefined' && window.location.hash !== link.href) {
      window.history.replaceState(null, '', link.href);
    }
    setMobileOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || mobileOpen
          ? 'bg-white/90 dark:bg-slate-950/85 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_30px_rgba(2,6,23,0.45)]'
          : 'bg-transparent'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <a
            href="#overview"
            onClick={handleLogoClick}
            className="flex items-center gap-2.5 group cursor-pointer"
            title={hasConnectionError || isOffline || isWaking ? 'Server disconnected - Click to reconnect' : 'SANAG - Nightlight Analytics'}
          >
            <div className="relative">
              <div className={`absolute inset-0 blur-lg transition-opacity ${
                hasConnectionError || isOffline
                  ? 'bg-rose-500 opacity-60 group-hover:opacity-80'
                  : isWaking
                  ? 'bg-amber-500 opacity-60 group-hover:opacity-80'
                  : 'bg-ocean-500 opacity-40 group-hover:opacity-60'
              }`} />
              <div className={`relative flex h-9 w-9 items-center justify-center rounded-lg shadow-lg transition-all ${
                hasConnectionError || isOffline
                  ? 'bg-gradient-to-br from-rose-600 to-amber-600 shadow-rose-500/30'
                  : isWaking
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30'
                  : 'bg-gradient-to-br from-ocean-500 to-emerald-500 shadow-ocean-500/30'
              }`}>
                <Satellite className="h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white transition-colors">
                SANAG
              </span>
              <span className="text-[10px] font-medium text-slate-500 dark:text-ink-400 transition-colors">
                Nightlight Analytics
              </span>
            </div>
          </a>

          {/* Desktop Navigation Tabs */}
          <div className="hidden md:flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/5 backdrop-blur-md">
            {navLinks.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleTabClick(e, link)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-white dark:bg-slate-800 text-ocean-600 dark:text-ocean-300 font-bold border border-slate-200/80 dark:border-white/10 shadow-sm shadow-ocean-500/10'
                      : 'text-slate-600 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {isActive && (
                    <span className="h-1.5 w-1.5 rounded-full bg-ocean-500 animate-pulse" />
                  )}
                  <span>{link.label}</span>
                </a>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            {/* Live Monitoring Activity Counter Pill */}
            <div
              className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold shadow-xs transition-colors ${badgeBorderBg}`}
              title={badgeTooltip}
            >
              <span className="relative flex h-2 w-2">
                {hasPingDot && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotPingClass}`} />
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${dotSolidClass}`} />
              </span>
              <span className="whitespace-nowrap font-medium text-[11px] lg:text-xs">
                {badgeLabel}
              </span>
            </div>

            {/* Version Badge */}
            <span
              className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 select-none"
              title="Current SANAG build version"
            >
              v{APP_VERSION}
            </span>

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-white/5 text-slate-700 dark:text-ink-200 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-ocean-500/40"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
              ) : (
                <Moon className="h-4 w-4 text-ocean-600 transition-transform duration-300 hover:-rotate-12" />
              )}
            </button>

            {/* Live Status Button with dynamic state styling & pulsing indicator */}
            <button
              type="button"
              onClick={handleLiveStatusClick}
              disabled={isRefetching}
              title="Click to check connection and refresh active telemetry data"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all cursor-pointer ${
                isWaking || (isReconnecting && !isOffline)
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-600 dark:text-amber-300 shadow-md shadow-amber-500/10'
                  : isOffline
                  ? 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-600 dark:text-rose-300 shadow-md shadow-rose-500/10'
                  : 'bg-gradient-to-r from-ocean-600 to-ocean-500 text-white shadow-lg shadow-ocean-500/20 hover:shadow-ocean-500/40 hover:scale-[1.02]'
              }`}
            >
              {isWaking || (isReconnecting && !isOffline) ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                  </span>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Reconnecting...</span>
                </>
              ) : isOffline ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                  </span>
                  <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
                  <span>Offline - Retry ↻</span>
                </>
              ) : (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                  </span>
                  <Activity className="h-4 w-4" />
                  <span>Live Status</span>
                </>
              )}
            </button>
          </div>

          <div className="flex md:hidden items-center gap-1.5 sm:gap-2">
            {/* Mobile Live Activity Pill */}
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold select-none transition-colors ${badgeBorderBg}`}
              title={badgeTooltip}
            >
              <span className="relative flex h-1.5 w-1.5">
                {hasPingDot && (
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotPingClass}`} />
                )}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotSolidClass}`} />
              </span>
              <span>
                {isServerWakingState ? 'Waking' : isServerOfflineState ? 'Offline' : `${stationsCount} Stations`}
              </span>
            </div>

            {/* Mobile Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100/90 dark:bg-white/5 text-slate-700 dark:text-ink-200 hover:bg-slate-200 dark:hover:bg-white/10"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-ocean-600" />
              )}
            </button>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-700 dark:text-ink-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-slate-200 dark:border-white/10 py-4 animate-fade-in bg-white/95 dark:bg-slate-950/95 rounded-b-xl px-2">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = activeTab === link.id;
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleTabClick(e, link)}
                    className={`px-3 py-2.5 text-sm font-semibold rounded-lg flex items-center justify-between ${
                      isActive
                        ? 'bg-ocean-500/15 text-ocean-600 dark:text-ocean-300 border border-ocean-500/30'
                        : 'text-slate-700 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span>{link.label}</span>
                    {isActive && (
                      <span className="h-2 w-2 rounded-full bg-ocean-500" />
                    )}
                  </a>
                );
              })}

              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-white/10 space-y-2">
                {/* Mobile Active Node & Version Summary */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-600 dark:text-ink-300">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      {hasPingDot && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotPingClass}`} />
                      )}
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${dotSolidClass}`} />
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">{badgeMobileLabel}</span>
                    <span className="text-slate-400 hidden xs:inline">· {lgusCount} LGUs</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded bg-slate-200/60 dark:bg-slate-800/80 border border-slate-300/60 dark:border-slate-700/50">
                    v{APP_VERSION}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={async (e) => {
                    await handleLiveStatusClick(e);
                    setMobileOpen(false);
                  }}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                    isWaking || (isReconnecting && !isOffline)
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40'
                      : isOffline
                      ? 'bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/40'
                      : 'bg-ocean-600 text-white'
                  }`}
                >
                  {isWaking || (isReconnecting && !isOffline) ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Reconnecting...</span>
                    </>
                  ) : isOffline ? (
                    <>
                      <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
                      <span>Offline - Retry ↻</span>
                    </>
                  ) : (
                    <>
                      <Activity className="h-4 w-4" />
                      <span>Live Status</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
