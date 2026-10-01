/**
 * API Fetch Service with Automated Cold-Start Retry Mechanism
 * Specifically designed to handle 502 Bad Gateway and 503 Service Unavailable
 * errors caused by free-tier backend servers spinning up from sleep mode.
 */

export const SERVER_STATUS_EVENT = 'sanag:server-status';
export const SERVER_STATUS_EVENT_ALIAS = 'server-wake-status';

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
}

export interface ApiFetchOptions extends RequestInit {
  maxRetries?: number;
  retryDelayMs?: number;
  backoffMultiplier?: number;
  skipRetry?: boolean;
}

// Global wake-up state management
let activeWakingCount = 0;
let currentAttempt = 0;
let currentMaxRetries = 6;
let currentStatus: ServerWakeStatus = 'idle';
let currentDelayMs = 3500;
let lastError: string | null = null;
let readyTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Dispatches server status events to window listeners.
 */
export function dispatchServerStatus(detail: ServerStatusDetail): void {
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
  return {
    status: currentStatus,
    attempt: currentAttempt,
    maxRetries: currentMaxRetries,
    delayMs: currentDelayMs,
    error: lastError,
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
 *
 * @param input URL or Request object
 * @param init Request options including retry overrides
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: ApiFetchOptions
): Promise<Response> {
  const {
    maxRetries = 6,
    retryDelayMs = 3500,
    backoffMultiplier = 1.0,
    skipRetry = false,
    ...fetchInit
  } = init || {};

  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const isInternalApi = urlStr.startsWith('/api') || urlStr.includes('/api/v1');

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

      // Check if this response indicates a sleeping server
      if (isServerSleeping(response.status)) {
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
            message: 'Backend server is waking up from sleep mode. Please wait a moment while assets load...',
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
              message: 'Backend server is waking up from sleep mode. Please wait a moment while assets load...',
              url: urlStr,
            });
            await sleep(Math.min(tickInterval, delay - (Date.now() - startTime)), fetchInit.signal);
          }

          delay = Math.round(delay * backoffMultiplier);
          continue; // Retry request
        }
      }

      // If we got here, server responded successfully (or with non-cold-start client error like 400/404)
      if (causedWaking) {
        activeWakingCount = Math.max(0, activeWakingCount - 1);
        causedWaking = false;
      }

      // If all waking requests finished, mark ready
      if (activeWakingCount === 0 && currentStatus === 'waking') {
        dispatchServerStatus({
          status: 'ready',
          attempt,
          maxRetries,
          delayMs: 0,
          message: 'Backend server is online!',
          url: urlStr,
        });

        // Auto-reset to idle after 3 seconds
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
        }, 3000);
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

      // Network error during cold start
      if (isServerSleeping(undefined, err) && attempt < maxRetries) {
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
          message: 'Backend server is waking up from sleep mode. Please wait a moment while assets load...',
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
            message: 'Backend server is waking up from sleep mode. Please wait a moment while assets load...',
            url: urlStr,
          });
          await sleep(Math.min(tickInterval, delay - (Date.now() - startTime)), fetchInit.signal);
        }

        delay = Math.round(delay * backoffMultiplier);
        continue; // Retry
      }

      // If retries exhausted or other error
      if (causedWaking) {
        activeWakingCount = Math.max(0, activeWakingCount - 1);
        causedWaking = false;
      }

      const errorMessage =
        attempt >= maxRetries
          ? `Backend server failed to respond after ${maxRetries} retry attempts.`
          : (err as Error)?.message || 'Network request failed';

      dispatchServerStatus({
        status: 'error',
        attempt,
        maxRetries,
        delayMs: 0,
        message: 'Backend server took too long to wake up. Please check your connection or retry.',
        error: errorMessage,
        url: urlStr,
      });

      throw new Error(errorMessage);
    }
  }

  // Fallback exhausted error if loop terminated on 502/503
  if (causedWaking) {
    activeWakingCount = Math.max(0, activeWakingCount - 1);
  }

  const exhaustedMsg = `Server unreachable: 502/503 cold start retries exhausted (${maxRetries} attempts).`;
  dispatchServerStatus({
    status: 'error',
    attempt: maxRetries,
    maxRetries,
    delayMs: 0,
    message: 'Backend server took too long to wake up. Please retry.',
    error: exhaustedMsg,
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
 * Sends a lightweight ping to the backend health endpoint to manually awaken or check server.
 */
export async function pingBackend(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/v1/health', { maxRetries: 4, retryDelayMs: 3000 });
    return res.ok;
  } catch {
    return false;
  }
}

export default apiFetch;
