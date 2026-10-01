/**
 * API Fetch Service with Automated Cold-Start Retry Mechanism
 * Specifically designed to handle 502 Bad Gateway and 503 Service Unavailable
 * errors caused by free-tier backend servers spinning up from sleep mode.
 */

export const SERVER_STATUS_EVENT = 'sanag:server-status';
export const SERVER_STATUS_EVENT_ALIAS = 'server-wake-status';
export const SESSION_STORAGE_WOKE_KEY = 'sanag_backend_woke';

export type ServerWakeStatus = 'idle' | 'waking' | 'ready' | 'error';

export interface ServerStatusDetail {
  status: ServerWakeStatus;
  attempt: number;
  maxRetries: number;
  delayMs: number;
  secondsRemaining?: number;
  message?: string;
  error?: string | null;
  url?: string;
  isFallbackActive?: boolean;
  suppressError?: boolean;
}

export interface ApiFetchOptions extends RequestInit {
  maxRetries?: number;
  retryDelayMs?: number;
  backoffMultiplier?: number;
  skipRetry?: boolean;
  isBackground?: boolean;
}

// Global wake-up state management
let activeWakingCount = 0;
let currentAttempt = 0;
let currentMaxRetries = 8;
let currentStatus: ServerWakeStatus = 'idle';
let currentDelayMs = 6000;
let lastError: string | null = null;
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
 * Permanently marks the backend as woke for this browser session.
 */
export function markBackendWoke(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_WOKE_KEY, 'true');
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
 * Notifies apiService that local fallback or mock dataset is successfully loaded and active.
 */
export function setHasLocalFallbackData(hasFallback: boolean): void {
  hasLocalFallbackData = hasFallback;
  if (hasFallback) {
    markBackendWoke();
  }
}

/**
 * Sets offline or demo mode flag to suppress backend timeout warnings.
 */
export function setIsOfflineOrDemoMode(offline: boolean): void {
  isOfflineOrDemoMode = offline;
  if (offline) {
    markBackendWoke();
  }
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
    hasLocalFallbackData: hasLocalFallbackData || isWoke,
    isOfflineOrDemoMode: offline,
    isOperatingSuccessfully: hasActiveApiResponse || hasLocalFallbackData || offline || isWoke,
    isWokeInSession: isWoke,
  };
}

/**
 * Dispatches server status events to window listeners.
 */
export function dispatchServerStatus(detail: ServerStatusDetail): void {
  // If backend is already marked woke in session and a waking event is attempted, ignore to prevent looping
  if (isBackendMarkedWoke() && detail.status === 'waking') {
    return;
  }

  currentStatus = detail.status;
  currentAttempt = detail.attempt;
  currentMaxRetries = detail.maxRetries;
  currentDelayMs = detail.delayMs;
  lastError = detail.error ?? null;

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
    isFallbackActive: readiness.isOperatingSuccessfully,
    suppressError: Boolean(readiness.isOperatingSuccessfully && currentStatus === 'error'),
  };
}

/**
 * Subscribes a listener to server status changes. Returns an cleanup unsubscribe function.
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
 * Determines whether a response or error corresponds to a server waking from sleep mode.
 */
function isServerSleeping(status?: number, error?: unknown): boolean {
  // 502 Bad Gateway: Reverse proxy (Render/Cloudflare/Fly/Nginx) cannot reach container
  // 503 Service Unavailable: Container starting up or capacity limited
  // 504 Gateway Timeout: Edge proxy timed out waiting for spin-up
  if (status === 502 || status === 503 || status === 504) {
    return true;
  }

  // Network exceptions on cold start (connection refused, reset, CORS preflight failure during boot)
  if (error && typeof error === 'object') {
    const err = error as { name?: string; message?: string };
    if (err.name === 'AbortError') {
      return false; // User or component purposefully aborted the request
    }
    const msg = (err.message || '').toLowerCase();
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('connection refused') ||
      msg.includes('network error') ||
      msg.includes('load failed')
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
 * Enhanced fetch wrapper with automatic cold-start retry mechanism and status broadcasting.
 * Non-blocking retry interval extended to 6000ms to smoothly accommodate Render free tier spin-up.
 * Validates data readiness to suppress false alarm timeouts when operating on local mock data.
 *
 * @param input URL or Request object
 * @param init Request options including retry overrides
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: ApiFetchOptions
): Promise<Response> {
  const {
    maxRetries = 8,
    retryDelayMs = 6000,
    backoffMultiplier = 1.0,
    skipRetry = false,
    isBackground = false,
    ...fetchInit
  } = init || {};

  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // If user disabled retry or not an API call, use standard fetch
  if (skipRetry) {
    return fetch(input, fetchInit);
  }

  let attempt = 0;
  let delay = retryDelayMs;
  let causedWaking = false;

  while (attempt <= maxRetries) {
    try {
      const response = await fetch(input, fetchInit);

      if (response.ok) {
        setHasActiveApiResponse(true);
        markBackendWoke();
      }

      // Check if this response indicates a sleeping server
      if (isServerSleeping(response.status)) {
        const readiness = getAppDataReadiness();

        // 2 & 3. Immediate short-circuit condition:
        // If local mock/fallback data is loaded or active, or session already marked woke,
        // instantly set sanag_backend_woke, remove multi-attempt countdown loop entirely,
        // and dismiss/hide any toast banner.
        if (readiness.isOperatingSuccessfully || isBackendMarkedWoke()) {
          markBackendWoke();
          dispatchServerStatus({
            status: 'idle',
            attempt: 0,
            maxRetries: 0,
            delayMs: 0,
            message: '',
            suppressError: true,
            isFallbackActive: true,
          });
          return response;
        }

        if (attempt < maxRetries) {
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
            delayMs: delay,
            message: 'Backend server is waking up from sleep mode. Please wait a moment while live telemetry initializes...',
            isFallbackActive: readiness.isOperatingSuccessfully,
            url: urlStr,
          });

          // Countdown ticker during delay for smooth UI feedback
          const startTime = Date.now();
          const tickInterval = 500;
          while (Date.now() - startTime < delay) {
            const remainingSec = Math.max(1, Math.ceil((delay - (Date.now() - startTime)) / 1000));
            dispatchServerStatus({
              status: 'waking',
              attempt,
              maxRetries,
              delayMs: delay,
              secondsRemaining: remainingSec,
              message: 'Backend server is waking up from sleep mode. Please wait a moment while live telemetry initializes...',
              isFallbackActive: readiness.isOperatingSuccessfully,
              url: urlStr,
            });
            await sleep(Math.min(tickInterval, delay - (Date.now() - startTime)), fetchInit.signal);
          }

          delay = Math.round(delay * backoffMultiplier);
          continue; // Retry request
        }
      }

      // If we got here, server responded (or with non-cold-start client error like 400/404)
      if (causedWaking) {
        activeWakingCount = Math.max(0, activeWakingCount - 1);
        causedWaking = false;
      }

      // If all waking requests finished, mark ready
      if (activeWakingCount === 0 && currentStatus === 'waking') {
        markBackendWoke();
        dispatchServerStatus({
          status: 'ready',
          attempt,
          maxRetries,
          delayMs: 0,
          message: 'Backend server is online!',
          url: urlStr,
        });

        // Auto-reset to idle after 2.8 seconds
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
        }, 2800);
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

      const readiness = getAppDataReadiness();

      // Immediate short-circuit condition on network errors:
      // If local mock/fallback data is loaded or active, or session already marked woke,
      // instantly set sanag_backend_woke, remove multi-attempt countdown loop entirely,
      // and dismiss/hide any toast banner.
      if (readiness.isOperatingSuccessfully || isBackendMarkedWoke()) {
        markBackendWoke();
        dispatchServerStatus({
          status: 'idle',
          attempt: 0,
          maxRetries: 0,
          delayMs: 0,
          message: '',
          suppressError: true,
          isFallbackActive: true,
        });
        throw err;
      }

      // Network error during cold start
      if (isServerSleeping(undefined, err)) {
        if (attempt < maxRetries) {
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
            delayMs: delay,
            message: 'Backend server is waking up from sleep mode. Please wait a moment while live telemetry initializes...',
            isFallbackActive: readiness.isOperatingSuccessfully,
            url: urlStr,
          });

          const startTime = Date.now();
          const tickInterval = 500;
          while (Date.now() - startTime < delay) {
            const remainingSec = Math.max(1, Math.ceil((delay - (Date.now() - startTime)) / 1000));
            dispatchServerStatus({
              status: 'waking',
              attempt,
              maxRetries,
              delayMs: delay,
              secondsRemaining: remainingSec,
              message: 'Backend server is waking up from sleep mode. Please wait a moment while live telemetry initializes...',
              isFallbackActive: readiness.isOperatingSuccessfully,
              url: urlStr,
            });
            await sleep(Math.min(tickInterval, delay - (Date.now() - startTime)), fetchInit.signal);
          }

          delay = Math.round(delay * backoffMultiplier);
          continue; // Retry
        }
      }

      // If retries exhausted or other error
      if (causedWaking) {
        activeWakingCount = Math.max(0, activeWakingCount - 1);
        causedWaking = false;
      }

      const shouldSuppress = readiness.isOperatingSuccessfully;
      const errorMessage =
        attempt >= maxRetries
          ? `Backend server failed to respond after ${maxRetries} retry attempts.`
          : (err as Error)?.message || 'Network request failed';

      // 2. Gracefully dismiss or suppress timeout error when operating on local mock/fallback data
      dispatchServerStatus({
        status: shouldSuppress ? 'idle' : 'error',
        attempt: shouldSuppress ? 0 : attempt,
        maxRetries,
        delayMs: 0,
        message: shouldSuppress
          ? 'Application operating on local fallback dataset while backend initializes.'
          : 'Backend server took too long to wake up. Please check your connection or retry.',
        error: shouldSuppress ? null : errorMessage,
        suppressError: shouldSuppress,
        isFallbackActive: readiness.isOperatingSuccessfully,
        url: urlStr,
      });

      throw new Error(errorMessage);
    }
  }

  // Fallback exhausted error if loop terminated on 502/503
  if (causedWaking) {
    activeWakingCount = Math.max(0, activeWakingCount - 1);
  }

  const readiness = getAppDataReadiness();
  const shouldSuppress = readiness.isOperatingSuccessfully;
  const exhaustedMsg = `Server unreachable: cold start retries exhausted (${maxRetries} attempts).`;

  dispatchServerStatus({
    status: shouldSuppress ? 'idle' : 'error',
    attempt: shouldSuppress ? 0 : maxRetries,
    maxRetries,
    delayMs: 0,
    message: shouldSuppress
      ? 'Application operating on local fallback dataset while backend initializes.'
      : 'Backend server took too long to wake up. Please retry.',
    error: shouldSuppress ? null : exhaustedMsg,
    suppressError: shouldSuppress,
    isFallbackActive: readiness.isOperatingSuccessfully,
    url: urlStr,
  });

  throw new Error(exhaustedMsg);
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
 * Sends a lightweight, non-blocking ping to the backend health endpoint.
 * Increased retry interval (6000ms) prevents disruptive false alarms during Render spin-up.
 */
export async function pingBackend(options?: {
  silent?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}): Promise<boolean> {
  const { silent = true, maxRetries = 6, retryDelayMs = 6000 } = options || {};
  try {
    const res = await apiFetch('/api/v1/health', {
      maxRetries,
      retryDelayMs,
      skipRetry: false,
      isBackground: silent,
    });
    if (res.ok) {
      setHasActiveApiResponse(true);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export default apiFetch;
