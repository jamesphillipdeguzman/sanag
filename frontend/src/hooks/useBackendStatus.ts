import { useState, useEffect, useCallback, useRef } from 'react';
import {
  subscribeServerStatus,
  getServerStatus,
  pingBackend,
  getAppDataReadiness,
  setHasLocalFallbackData,
  setIsOfflineOrDemoMode,
  isBackendMarkedWoke,
  markBackendWoke,
  SESSION_STORAGE_WOKE_KEY,
  type ServerStatusDetail,
  type ServerWakeStatus,
} from '@/services/apiService';

export interface UseBackendStatusOptions {
  pollingIntervalMs?: number;
  maxRetries?: number;
  autoStartPolling?: boolean;
  hasActiveData?: boolean;
  isOfflineMode?: boolean;
  isFallbackLoaded?: boolean;
}

export interface UseBackendStatusReturn {
  status: ServerWakeStatus;
  isWaking: boolean;
  isReady: boolean;
  isError: boolean;
  isOperatingOnFallback: boolean;
  isSuppressed: boolean;
  attempt: number;
  maxRetries: number;
  secondsRemaining?: number;
  message?: string;
  error?: string | null;
  retry: () => Promise<boolean>;
  ping: () => Promise<boolean>;
  dismiss: () => void;
  isDismissed: boolean;
}

/**
 * Custom React hook for monitoring backend health and cold-start wake status.
 * Enforces strict sessionStorage check (sanag_backend_woke) to permanently prevent loops or re-triggers.
 * Immediately short-circuits, cancels retry intervals, and dismisses when local mock/fallback data is loaded.
 */
export function useBackendStatus(options: UseBackendStatusOptions = {}): UseBackendStatusReturn {
  const {
    pollingIntervalMs = 8000,
    maxRetries = 8,
    autoStartPolling = false,
    hasActiveData = false,
    isOfflineMode = false,
    isFallbackLoaded = false,
  } = options;

  const wokeInSession = isBackendMarkedWoke();

  const [statusInfo, setStatusInfo] = useState<ServerStatusDetail>(() => {
    const s = getServerStatus();
    if (wokeInSession) {
      return { ...s, status: 'ready', isFallbackActive: true, suppressError: true };
    }
    return s;
  });

  const [isDismissed, setIsDismissed] = useState<boolean>(() => wokeInSession);
  const consecutiveFailuresRef = useRef<number>(0);
  const isPollingRef = useRef<boolean>(false);

  // Sync props to global data readiness registry and immediately short-circuit if mock/fallback loaded
  useEffect(() => {
    if (hasActiveData || isFallbackLoaded) {
      setHasLocalFallbackData(true);
      markBackendWoke();
      setIsDismissed(true);
    }
  }, [hasActiveData, isFallbackLoaded]);

  useEffect(() => {
    if (isOfflineMode !== undefined) {
      setIsOfflineOrDemoMode(isOfflineMode);
      if (isOfflineMode) {
        markBackendWoke();
        setIsDismissed(true);
      }
    }
  }, [isOfflineMode]);

  // Subscribe to global status changes dispatched by apiService
  useEffect(() => {
    if (isBackendMarkedWoke()) {
      setIsDismissed(true);
      return;
    }

    const unsubscribe = subscribeServerStatus((detail) => {
      if (isBackendMarkedWoke() && detail.status === 'waking') {
        setIsDismissed(true);
        return;
      }
      setStatusInfo(detail);
      if (detail.status === 'ready') {
        markBackendWoke();
      }
      if (detail.status === 'waking' && !isBackendMarkedWoke()) {
        setIsDismissed(false);
      }
    });
    return unsubscribe;
  }, []);

  const readiness = getAppDataReadiness();
  const isOperatingOnFallback = Boolean(
    hasActiveData ||
    isFallbackLoaded ||
    readiness.hasLocalFallbackData ||
    readiness.isOfflineOrDemoMode ||
    isOfflineMode ||
    wokeInSession ||
    isBackendMarkedWoke()
  );

  // Immediate short-circuit condition:
  // If local mock/fallback data is loaded or active, set sanag_backend_woke instantly
  useEffect(() => {
    if (isOperatingOnFallback || readiness.isOperatingSuccessfully) {
      markBackendWoke();
      setIsDismissed(true);
    }
  }, [isOperatingOnFallback, readiness.isOperatingSuccessfully]);

  // Suppress error toast if backend times out while app is successfully operating on local mock data
  const isSuppressed = Boolean(
    wokeInSession ||
    isBackendMarkedWoke() ||
    statusInfo.status === 'error' &&
    (isOperatingOnFallback || statusInfo.suppressError || readiness.isOperatingSuccessfully)
  );

  const dismiss = useCallback(() => {
    markBackendWoke();
    setIsDismissed(true);
  }, []);

  const ping = useCallback(async (): Promise<boolean> => {
    return pingBackend({ silent: true, maxRetries: 4, retryDelayMs: 5000 });
  }, []);

  const retry = useCallback(async (): Promise<boolean> => {
    consecutiveFailuresRef.current = 0;
    setIsDismissed(false);
    return pingBackend({ silent: false, maxRetries: 6, retryDelayMs: 6000 });
  }, []);

  // Optional non-blocking background health check polling
  // Strictly disabled if sanag_backend_woke is set or operating on local fallback
  useEffect(() => {
    if (!autoStartPolling) return;
    if (isBackendMarkedWoke() || isOfflineMode || readiness.isOfflineOrDemoMode || isOperatingOnFallback) {
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const runHealthCheck = async () => {
      if (cancelled || isPollingRef.current || isBackendMarkedWoke()) return;
      isPollingRef.current = true;

      try {
        const ok = await ping();
        if (ok) {
          consecutiveFailuresRef.current = 0;
          markBackendWoke();
        } else {
          const currentReadiness = getAppDataReadiness();
          if (!currentReadiness.isOperatingSuccessfully && !isBackendMarkedWoke()) {
            consecutiveFailuresRef.current += 1;
          }
        }
      } catch {
        const currentReadiness = getAppDataReadiness();
        if (!currentReadiness.isOperatingSuccessfully && !isBackendMarkedWoke()) {
          consecutiveFailuresRef.current += 1;
        }
      } finally {
        isPollingRef.current = false;
        if (!cancelled && !isBackendMarkedWoke()) {
          timerId = setTimeout(runHealthCheck, pollingIntervalMs);
        }
      }
    };

    timerId = setTimeout(runHealthCheck, 2000);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [autoStartPolling, isOfflineMode, readiness.isOfflineOrDemoMode, isOperatingOnFallback, pollingIntervalMs, ping]);

  const effectiveStatus: ServerWakeStatus =
    isBackendMarkedWoke() && statusInfo.status === 'waking'
      ? 'idle'
      : statusInfo.status;

  return {
    status: effectiveStatus,
    isWaking: !isBackendMarkedWoke() && effectiveStatus === 'waking',
    isReady: effectiveStatus === 'ready',
    isError: !isBackendMarkedWoke() && effectiveStatus === 'error',
    isOperatingOnFallback,
    isSuppressed,
    attempt: statusInfo.attempt,
    maxRetries: statusInfo.maxRetries || maxRetries,
    secondsRemaining: statusInfo.secondsRemaining,
    message: statusInfo.message,
    error: isBackendMarkedWoke() ? null : statusInfo.error,
    retry,
    ping,
    dismiss,
    isDismissed: isDismissed || isBackendMarkedWoke(),
  };
}

export default useBackendStatus;
