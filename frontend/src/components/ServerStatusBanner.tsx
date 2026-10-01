import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useServerHealth } from '@/context/ServerHealthContext';

export interface ServerStatusBannerProps {
  className?: string;
  hasActiveData?: boolean;
  isOfflineMode?: boolean;
  isFallbackLoaded?: boolean;
}

export const ServerStatusBanner: React.FC<ServerStatusBannerProps> = ({
  className = '',
}) => {
  const {
    status,
    isWaking,
    isOffline,
    hasConnectionError,
    attempt,
    maxRetries,
    secondsRemaining,
    statusCode,
    refetchAll,
    isRefetching,
    dismissBanner,
    isBannerDismissed,
  } = useServerHealth();

  // Render when a 502/504 is detected or the server is disconnected / cold starting
  const shouldShow =
    !isBannerDismissed &&
    (hasConnectionError ||
      isWaking ||
      isOffline ||
      status === 'disconnected' ||
      status === 'error' ||
      (statusCode !== undefined && [502, 503, 504].includes(statusCode)));

  if (!shouldShow) {
    return null;
  }

  return (
    <aside
      role="alert"
      aria-live="assertive"
      className={`fixed top-16 left-0 right-0 z-40 bg-gradient-to-r from-amber-600/95 via-amber-700/95 to-amber-800/95 dark:from-amber-950/95 dark:via-amber-900/95 dark:to-slate-950/95 border-b border-amber-400/40 dark:border-amber-500/30 backdrop-blur-xl shadow-lg shadow-amber-500/10 text-white transition-all duration-300 animate-slide-down ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-300" />
          </span>

          <div className="flex items-center gap-2 truncate">
            <span className="text-xs sm:text-sm font-semibold tracking-tight">
              Server is waking up (cold start)...
            </span>
            {secondsRemaining !== undefined && secondsRemaining > 0 && isWaking && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono bg-black/25 text-amber-100 border border-white/10">
                Retry in {secondsRemaining}s (attempt {attempt}/{maxRetries})
              </span>
            )}
            {statusCode && (
              <span className="hidden md:inline-flex text-[11px] font-mono text-amber-200/80">
                [HTTP {statusCode}]
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => refetchAll()}
            disabled={isRefetching}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 active:scale-95 border border-white/30 text-xs font-semibold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Refresh / Retry Connection"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Refresh / Retry Connection ↻</span>
          </button>

          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss banner"
            className="text-white/80 hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};

export default ServerStatusBanner;

