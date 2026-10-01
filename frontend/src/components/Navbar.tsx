import React, { useState, useEffect } from 'react';
import { Activity, Menu, Moon, RefreshCw, Satellite, Sun, X } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useServerHealth } from '@/context/ServerHealthContext';

const navLinks = [
  { label: 'Overview', href: '#overview' },
  { label: 'Map', href: '#map' },
  { label: 'Recovery', href: '#recovery' },
  { label: 'Events', href: '#events' },
  { label: 'AI Briefing', href: '#briefing' },
];

export default function Navbar() {
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If the app is currently displaying a connection error, clicking the logo
    // navigates to the home view and triggers the refetch handler.
    if (hasConnectionError || isOffline || isWaking) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      refetchAll();
    }
  };

  const handleLiveStatusClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    await refetchAll();
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
            href="#top"
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

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
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

          <div className="flex md:hidden items-center gap-2">
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
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-ink-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  {link.label}
                </a>
              ))}

              <div className="pt-2 mt-2 border-t border-slate-200 dark:border-white/10">
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
