import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, RefreshCw, X, Server } from 'lucide-react';
import { useBackendStatus } from '@/hooks/useBackendStatus';
import {
  isBackendMarkedWoke,
  markBackendWoke,
  SESSION_STORAGE_WOKE_KEY,
} from '@/services/apiService';

export interface ServerStatusBannerProps {
  className?: string;
  autoHideReadyDelayMs?: number;
  hasActiveData?: boolean;
  isOfflineMode?: boolean;
  isFallbackLoaded?: boolean;
}

export const ServerStatusBanner: React.FC<ServerStatusBannerProps> = ({
  className = '',
  autoHideReadyDelayMs = 2800,
  hasActiveData,
  isOfflineMode,
  isFallbackLoaded,
}) => {
  // 1. Wrap the entire wakeup check in a sessionStorage check.
  // If it already exists or has run once this session, do not render or poll.
  const hasWokeInSession =
    typeof window !== 'undefined' &&
    window.sessionStorage.getItem(SESSION_STORAGE_WOKE_KEY) === 'true';

  // 2. Add an immediate short-circuit condition:
  // If local mock/fallback data is loaded or active, set sessionStorage.setItem('sanag_backend_woke', 'true')
  // instantly, clear any active retry intervals, and dismiss/hide the toast banner completely.
  const isMockOrFallbackActive = Boolean(
    hasActiveData ||
    isFallbackLoaded ||
    isOfflineMode
  );

  if (isMockOrFallbackActive && typeof window !== 'undefined') {
    try {
      window.sessionStorage.setItem(SESSION_STORAGE_WOKE_KEY, 'true');
    } catch {}
  }

  const {
    status,
    attempt,
    maxRetries,
    secondsRemaining,
    message,
    error,
    isSuppressed,
    isOperatingOnFallback,
    retry,
    dismiss,
    isDismissed,
  } = useBackendStatus({
    hasActiveData,
    isOfflineMode,
    isFallbackLoaded,
    autoStartPolling: false,
  });

  const [localDismissed, setLocalDismissed] = useState(false);
  const [isRetryingManually, setIsRetryingManually] = useState(false);

  // Auto-hide banner and permanently mark session woke shortly after server reports 'ready'
  useEffect(() => {
    if (status === 'ready') {
      markBackendWoke();
      const timer = setTimeout(() => {
        setLocalDismissed(true);
      }, autoHideReadyDelayMs);
      return () => clearTimeout(timer);
    }
  }, [status, autoHideReadyDelayMs]);

  // Reset local dismiss when waking state transitions only if not already woke in session
  useEffect(() => {
    if (status === 'waking' && !isBackendMarkedWoke() && !hasWokeInSession) {
      setLocalDismissed(false);
    }
  }, [status, hasWokeInSession]);

  const handleManualRetry = useCallback(async () => {
    setIsRetryingManually(true);
    try {
      const ok = await retry();
      if (ok) {
        markBackendWoke();
        window.location.reload();
      }
    } finally {
      setIsRetryingManually(false);
    }
  }, [retry]);

  // 1 & 2: Immediate short-circuit condition:
  // If session is already woke, mock data is active, or user dismissed, completely suppress rendering
  if (
    hasWokeInSession ||
    isBackendMarkedWoke() ||
    isMockOrFallbackActive ||
    isOperatingOnFallback ||
    isSuppressed ||
    localDismissed ||
    isDismissed ||
    status === 'idle'
  ) {
    return null;
  }

  // Gracefully suppress or dismiss error toast if app is operating on local mock data or offline mode
  if (status === 'error' && (isSuppressed || isOperatingOnFallback || isOfflineMode)) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-xl transition-all duration-300 pointer-events-auto ${className}`}
    >
      <div
        className={`relative overflow-hidden rounded-2xl p-4 sm:p-5 shadow-2xl backdrop-blur-xl border transition-all duration-300 ${
          status === 'waking'
            ? 'bg-slate-950/90 dark:bg-slate-950/95 border-amber-500/40 text-slate-100 shadow-[0_12px_40px_rgba(245,158,11,0.2)]'
            : status === 'ready'
            ? 'bg-slate-950/90 dark:bg-slate-950/95 border-emerald-500/50 text-slate-100 shadow-[0_12px_40px_rgba(16,185,129,0.25)]'
            : 'bg-slate-950/90 dark:bg-slate-950/95 border-rose-500/50 text-slate-100 shadow-[0_12px_40px_rgba(244,63,94,0.25)]'
        }`}
      >
        {/* Subtle background glow */}
        <div
          className={`absolute -top-12 -right-12 h-36 w-36 rounded-full blur-3xl opacity-20 pointer-events-none ${
            status === 'waking'
              ? 'bg-amber-400'
              : status === 'ready'
              ? 'bg-emerald-400'
              : 'bg-rose-400'
          }`}
        />

        <div className="relative flex items-start gap-3.5">
          {/* Status Icon */}
          <div className="shrink-0 mt-0.5">
            {status === 'waking' && (
              <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                </span>
              </div>
            )}
            {status === 'ready' && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
            {status === 'error' && (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-semibold tracking-tight text-white flex items-center gap-1.5">
                <Server className="h-3.5 w-3.5 text-slate-400" />
                {status === 'waking' && 'Backend Server Waking Up'}
                {status === 'ready' && 'Backend Server Online'}
                {status === 'error' && 'Backend Server Timed Out'}
              </h4>

              {status === 'waking' && attempt > 0 && !isMockOrFallbackActive && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Attempt {attempt} of {maxRetries}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {status === 'waking' &&
                (message ||
                  'The free-tier backend is spinning up from sleep mode. Please wait a moment while live assets and satellite feeds initialize...')}
              {status === 'ready' &&
                'Connection established! Your dashboard and satellite services are now actively syncing.'}
              {status === 'error' &&
                (error ||
                  'The backend server took longer than expected to spin up. You can retry the connection or check your network.')}
            </p>

            {/* 3. Multi-attempt countdown loop removed entirely when on mock/fallback states */}
            {status === 'waking' && !isMockOrFallbackActive && !isOperatingOnFallback && (
              <div className="mt-2.5 flex items-center gap-3">
                <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(15, (attempt / maxRetries) * 100))}%`,
                    }}
                  />
                </div>
                {secondsRemaining !== undefined && secondsRemaining > 0 && (
                  <span className="text-[11px] font-mono text-amber-300 shrink-0">
                    Next try in {secondsRemaining}s
                  </span>
                )}
              </div>
            )}

            {/* Actions on Error */}
            {status === 'error' && (
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualRetry}
                  disabled={isRetryingManually}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-medium text-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isRetryingManually ? 'animate-spin' : ''}`}
                  />
                  {isRetryingManually ? 'Pinging Server...' : 'Retry Connection'}
                </button>
              </div>
            )}
          </div>

          {/* Close / Dismiss Button */}
          <button
            type="button"
            onClick={() => {
              markBackendWoke();
              setLocalDismissed(true);
              dismiss();
            }}
            aria-label="Dismiss status notification"
            className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ServerStatusBanner;
