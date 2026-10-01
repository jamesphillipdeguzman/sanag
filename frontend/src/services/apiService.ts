/**
 * API Fetch Service with Automated Cold-Start Retry Mechanism
 * Specifically designed to gracefully handle 502 Bad Gateway, 503 Service Unavailable,
 * and 504 Gateway Timeout errors caused by backend spin-up / cold starts.
 */

export const SERVER_STATUS_EVENT = 'sanag:server-status';
export const SERVER_STATUS_EVENT_ALIAS = 'server-wake-status';
export const SESSION_STORAGE_WOKE_KEY = 'sanag_backend_woke';

export type ServerWakeStatus = 'idle' | 'waking' | 'ready' | 'error' | 'disconnected';

export interface ServerStatusDetail {
  status: ServerWakeStatus;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  secondsRemaining?: number;
  message?: string;
  error?: string | null;
  url?: string;
  statusCode?: number;
  isFallbackActive?: boolean;
  suppressError?: boolean;
}

export interface ApiFetchOptions extends RequestInit {
  maxRetries?: number;
  retryDelayMs?: number;
  backoffDelays?: number[];
  skipRetry?: boolean;
  isBackground?: boolean;
}

// Cold start status codes and exponential backoff intervals: 2s, 5s, 10s (up to 3 retries)
export const COLD_START_STATUS_CODES = [502, 503, 504];
export const DEFAULT_COLD_START_BACKOFF = [2000, 5000, 10000];

// Global wake-up state management
let activeWakingCount = 0;
let currentAttempt = 0;
let currentMaxRetries = 3;
let currentStatus: ServerWakeStatus = 'idle';
let currentDelayMs = 2000;
let lastError: string | null = null;
let lastStatusCode: number | undefined = undefined;
let readyTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Global dataset readiness and offline status tracking
let hasActiveApiResponse = false;
let hasLocalFallbackData = false;
let isOfflineOrDemoMode = false;

/**
 * Checks whether backend wake status has already succeeded or run this session.
 */
export function isBackendMarkedWoke(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(SESSION_STORAGE_WOKE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * Marks the backend as woke for this browser session.
 */
export function markBackendWoke(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_WOKE_KEY, 'true');
  } catch {}
}

/**
 * Clears the woke flag in sessionStorage (e.g. when connection error occurs).
 */
export function clearBackendWoke(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_WOKE_KEY);
  } catch {}
}

/**
 * Notifies apiService that an active API response has been successfully received.
 */
export function setHasActiveApiResponse(active: boolean): void {
  hasActiveApiResponse = active;
  if (active) {
    markBackendWoke();
  }
}

/**
 * Notifies apiService that local fallback or mock dataset is successfully loaded.
 */
export function setHasLocalFallbackData(hasFallback: boolean): void {
  hasLocalFallbackData = hasFallback;
}

/**
 * Sets offline or demo mode flag.
 */
export function setIsOfflineOrDemoMode(offline: boolean): void {
  isOfflineOrDemoMode = offline;
}

/**
 * Retrieves current dataset readiness status.
 */
export function getAppDataReadiness(): {
  hasActiveApiResponse: boolean;
  hasLocalFallbackData: boolean;
  isOfflineOrDemoMode: boolean;
  isOperatingSuccessfully: boolean;
  isWokeInSession: boolean;
} {
  const isLocalStorageOffline =
    typeof window !== 'undefined' &&
    (localStorage.getItem('sanag:offline_mode') === 'true' ||
      localStorage.getItem('sanag:demo_mode') === 'true');
  const isUrlDemo =
    typeof window !== 'undefined' &&
    (window.location.search.includes('demo=true') ||
      window.location.search.includes('offline=true'));
  const isWoke = isBackendMarkedWoke();
  const offline = isOfflineOrDemoMode || isLocalStorageOffline || isUrlDemo;

  return {
    hasActiveApiResponse: hasActiveApiResponse || isWoke,
    hasLocalFallbackData: hasLocalFallbackData,
    isOfflineOrDemoMode: offline,
    isOperatingSuccessfully: hasActiveApiResponse || hasLocalFallbackData || offline,
    isWokeInSession: isWoke,
  };
}

/**
 * Dispatches server status events to window listeners.
 */
export function dispatchServerStatus(detail: ServerStatusDetail): void {
  currentStatus = detail.status;
  currentAttempt = detail.attempt;
  currentMaxRetries = detail.maxRetries;
  currentDelayMs = detail.delayMs;
  lastError = detail.error ?? null;
  lastStatusCode = detail.statusCode;

  if (detail.status === 'ready') {
    markBackendWoke();
  } else if (detail.status === 'waking' || detail.status === 'error' || detail.status === 'disconnected') {
    clearBackendWoke();
  }

  if (typeof window !== 'undefined') {
    const payload = { detail };
    window.dispatchEvent(new CustomEvent(SERVER_STATUS_EVENT, payload));
    window.dispatchEvent(new CustomEvent(SERVER_STATUS_EVENT_ALIAS, payload));
  }
}

/**
 * Returns current snapshot of server wake status.
 */
export function getServerStatus(): ServerStatusDetail {
  const readiness = getAppDataReadiness();
  return {
    status: currentStatus,
    attempt: currentAttempt,
    maxRetries: currentMaxRetries,
    delayMs: currentDelayMs,
    error: lastError,
    statusCode: lastStatusCode,
    isFallbackActive: readiness.isOperatingSuccessfully,
    suppressError: false,
  };
}

/**
 * Subscribes a listener to server status changes. Returns a cleanup unsubscribe function.
 */
export function subscribeServerStatus(
  callback: (detail: ServerStatusDetail) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<ServerStatusDetail>;
    if (customEvent.detail) {
      callback(customEvent.detail);
    }
  };

  window.addEventListener(SERVER_STATUS_EVENT, handler);
  return () => {
    window.removeEventListener(SERVER_STATUS_EVENT, handler);
  };
}

/**
 * Determines whether a response or error corresponds to a cold-start sleeping server.
 */
export function isColdStartError(status?: number, error?: unknown): boolean {
  if (status && COLD_START_STATUS_CODES.includes(status)) {
    return true;
  }

  if (error && typeof error === 'object') {
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      return false; // User purposefully aborted
    }
    const msg = (err.message || '').toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('connection refused') ||
      msg.includes('network error') ||
      msg.includes('load failed') ||
      msg.includes('net::err_connection')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Helper to pause execution with abort signal listener support.
 */
function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'));
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort);
  });
}

/**
 * Enhanced fetch wrapper with automatic retry specifically configured for 502, 503, and 504 cold-start errors.
 * Retries up to 3 times with exponential backoff: 2s, 5s, 10s before surfacing an error.
 *
 * @param input URL or Request object
 * @param init Request options including retry overrides
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: ApiFetchOptions
): Promise<Response> {
  const {
    maxRetries = 3,
    backoffDelays = DEFAULT_COLD_START_BACKOFF,
    skipRetry = false,
    isBackground = false,
    ...fetchInit
  } = init || {};

  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // If user disabled retry, pass directly to standard fetch
  if (skipRetry) {
    return fetch(input, fetchInit);
  }

  let attempt = 0;
  let causedWaking = false;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(input, fetchInit);

      // Check if this response is a 502, 503, or 504 cold-start status
      if (isColdStartError(response.status)) {
        if (attempt < maxRetries) {
          const delayMs = backoffDelays[attempt] ?? backoffDelays[backoffDelays.length - 1] ?? 5000;
          attempt += 1;
          if (!causedWaking) {
            activeWakingCount += 1;
            causedWaking = true;
          }

          if (readyTimeoutId) {
            clearTimeout(readyTimeoutId);
            readyTimeoutId = null;
          }

          dispatchServerStatus({
            status: 'waking',
            attempt,
            maxRetries,
            delayMs,
            secondsRemaining: Math.ceil(delayMs / 1000),
            statusCode: response.status,
            message: 'Server is waking up (cold start)...',
            url: urlStr,
          });

          // Countdown ticker during delay for smooth user feedback
          const startTime = Date.now();
          const tickInterval = 500;
          while (Date.now() - startTime < delayMs) {
            const remainingSec = Math.max(1, Math.ceil((delayMs - (Date.now() - startTime)) / 1000));
            dispatchServerStatus({
              status: 'waking',
              attempt,
              maxRetries,
              delayMs,
              secondsRemaining: remainingSec,
              statusCode: response.status,
              message: 'Server is waking up (cold start)...',
              url: urlStr,
            });
            await sleep(Math.min(tickInterval, delayMs - (Date.now() - startTime)), fetchInit.signal);
          }

          continue; // Retry request with backoff
        }

        // All 3 retries exhausted for 502/503/504
        if (causedWaking) {
          activeWakingCount = Math.max(0, activeWakingCount - 1);
          causedWaking = false;
        }

        dispatchServerStatus({
          status: 'disconnected',
          attempt: maxRetries,
          maxRetries,
          delayMs: 0,
          statusCode: response.status,
          message: `Server returned HTTP ${response.status} during cold start after ${maxRetries} retry attempts.`,
          error: `HTTP ${response.status}`,
          url: urlStr,
        });

        return response;
      }

      // Successful or standard non-cold-start response
      if (response.ok) {
        setHasActiveApiResponse(true);
        markBackendWoke();
      }

      if (causedWaking) {
        activeWakingCount = Math.max(0, activeWakingCount - 1);
        causedWaking = false;
      }

      // If waking completed successfully, broadcast ready status
      if (activeWakingCount === 0 && (currentStatus === 'waking' || currentStatus === 'disconnected')) {
        dispatchServerStatus({
          status: 'ready',
          attempt: 0,
          maxRetries,
          delayMs: 0,
          statusCode: response.status,
          message: 'Backend server is online!',
          url: urlStr,
        });

        readyTimeoutId = setTimeout(() => {
          if (activeWakingCount === 0) {
            dispatchServerStatus({
              status: 'idle',
              attempt: 0,
              maxRetries,
              delayMs: 0,
              message: '',
            });
          }
        }, 2500);
      }

      return response;
    } catch (err: unknown) {
      const isAbort = (err as { name?: string })?.name === 'AbortError';
      if (isAbort) {
        if (causedWaking) {
          activeWakingCount = Math.max(0, activeWakingCount - 1);
          causedWaking = false;
        }
        throw err;
      }

      // Check if network error indicates cold start
      if (isColdStartError(undefined, err)) {
        if (attempt < maxRetries) {
          const delayMs = backoffDelays[attempt] ?? backoffDelays[backoffDelays.length - 1] ?? 5000;
          attempt += 1;
          if (!causedWaking) {
            activeWakingCount += 1;
            causedWaking = true;
          }

          if (readyTimeoutId) {
            clearTimeout(readyTimeoutId);
            readyTimeoutId = null;
          }

          dispatchServerStatus({
            status: 'waking',
            attempt,
            maxRetries,
            delayMs,
            secondsRemaining: Math.ceil(delayMs / 1000),
            statusCode: 504,
            message: 'Server is waking up (cold start)...',
            url: urlStr,
          });

          const startTime = Date.now();
          const tickInterval = 500;
          while (Date.now() - startTime < delayMs) {
            const remainingSec = Math.max(1, Math.ceil((delayMs - (Date.now() - startTime)) / 1000));
            dispatchServerStatus({
              status: 'waking',
              attempt,
              maxRetries,
              delayMs,
              secondsRemaining: remainingSec,
              statusCode: 504,
              message: 'Server is waking up (cold start)...',
              url: urlStr,
            });
            await sleep(Math.min(tickInterval, delayMs - (Date.now() - startTime)), fetchInit.signal);
          }

          continue; // Retry
        }
      }

      // Retries exhausted or non-retryable error
      if (causedWaking) {
        activeWakingCount = Math.max(0, activeWakingCount - 1);
        causedWaking = false;
      }

      const errorMessage =
        attempt >= maxRetries
          ? `Backend server failed to respond after ${maxRetries} retry attempts.`
          : (err as Error)?.message || 'Network request failed';

      dispatchServerStatus({
        status: 'disconnected',
        attempt: maxRetries,
        maxRetries,
        delayMs: 0,
        statusCode: 504,
        message: 'Server is waking up (cold start)...',
        error: errorMessage,
        url: urlStr,
      });

      throw new Error(errorMessage);
    }
  }

  throw new Error(`Cold start retries exhausted (${maxRetries} attempts).`);
}

/**
 * Helper to fetch and parse JSON with automatic cold-start retry and error checking.
 */
export async function apiFetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: ApiFetchOptions
): Promise<T> {
  const response = await apiFetch(input, init);
  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson === 'object' && 'detail' in errJson) {
        errorDetail = String(errJson.detail);
      }
    } catch {
      // Non-json error body
    }
    throw new Error(errorDetail);
  }
  return response.json() as Promise<T>;
}

/**
 * Performs a health check against GET /api/health (with fallbacks to /api/v1/health and /health).
 * Resets status to ready when online, or updates status to disconnected/waking on error.
 */
export async function checkServerHealth(): Promise<boolean> {
  const endpoints = ['/api/health', '/api/v1/health', '/health'];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        setHasActiveApiResponse(true);
        markBackendWoke();
        dispatchServerStatus({
          status: 'ready',
          attempt: 0,
          maxRetries: 3,
          delayMs: 0,
          statusCode: res.status,
          message: 'Backend server is online!',
        });

        setTimeout(() => {
          if (currentStatus === 'ready') {
            dispatchServerStatus({
              status: 'idle',
              attempt: 0,
              maxRetries: 3,
              delayMs: 0,
              message: '',
            });
          }
        }, 2500);

        return true;
      }
    } catch {
      // Continue to next fallback
    }
  }

  // All health endpoints failed
  dispatchServerStatus({
    status: 'disconnected',
    attempt: 3,
    maxRetries: 3,
    delayMs: 0,
    statusCode: 504,
    message: 'Server is waking up (cold start)...',
    error: 'Backend health check failed',
  });

  return false;
}

/**
 * Sends a lightweight, non-blocking ping to the backend health endpoint.
 */
export async function pingBackend(): Promise<boolean> {
  return checkServerHealth();
}

export default apiFetch;
