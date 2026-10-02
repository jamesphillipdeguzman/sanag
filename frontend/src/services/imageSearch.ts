import { apiFetch } from './apiService';

export interface GroundImageResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageUrl?: string;
  sourceUrl: string;
  domain: string;
}

// In-memory cache to make repeated searches and re-opened modals instant
const imageSearchCache = new Map<string, GroundImageResult[]>();

/**
 * Extracts clean search terms and aliases from event names.
 * e.g. "Typhoon Phanfone (Ursula)" -> { base: "Typhoon Phanfone", local: "Ursula", terms: [...] }
 */
export function parseEventNames(rawName: string): { base: string; local: string; terms: string[] } {
  const clean = rawName.trim();
  const match = clean.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    const base = match[1].trim();
    const local = match[2].trim();
    return {
      base,
      local,
      terms: [base, local, `${base} ${local}`.trim()],
    };
  }
  return {
    base: clean,
    local: '',
    terms: [clean],
  };
}

/**
 * Direct client-side Wikimedia Commons Action API query.
 * Strictly adheres to Wikimedia guidelines:
 * - Uses `origin=*` for CORS support in browsers
 * - Passes `Api-User-Agent` header to prevent throttling or silent 403s
 * - Filters for genuine image MIME types (excludes SVGs, audio, and pdfs)
 * - Supports request cancellation via AbortSignal
 */
export async function searchWikimediaCommons(
  searchTerm: string,
  signal?: AbortSignal,
  limit: number = 16
): Promise<GroundImageResult[]> {
  const cleanTerm = searchTerm.replace(/\(.*?\)/g, '').trim();
  if (!cleanTerm || cleanTerm.length < 2) return [];

  // Generate structured candidate queries: exact quoted phrase, incident damage, disaster aftermath
  const queriesToTry = [
    `"${cleanTerm}"`,
    `${cleanTerm} damage`,
    `${cleanTerm} flood aftermath`,
    `${cleanTerm} Philippines`,
  ];

  for (const q of queriesToTry) {
    if (signal?.aborted) return [];

    try {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: q,
        gsrnamespace: '6', // Namespace 6 = File:
        gsrlimit: String(limit),
        prop: 'imageinfo',
        iiprop: 'url|mime',
        iiurlwidth: '600',
        format: 'json',
        origin: '*', // Required for browser CORS
      });

      const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Api-User-Agent': 'SanagDisasterMonitor/1.0 (https://sanag.org; contact@sanag.org)',
        },
        signal,
      });

      if (!res.ok) continue;

      const data = await res.json();
      const pages = data?.query?.pages;
      if (!pages || typeof pages !== 'object') continue;

      const results: GroundImageResult[] = [];
      for (const [pid, p] of Object.entries<any>(pages)) {
        const info = p?.imageinfo?.[0];
        if (!info) continue;

        const mime = info.mime || '';
        if (!mime.startsWith('image/') || mime.includes('svg')) continue;

        const thumb = info.thumburl || info.url;
        const img = info.url || thumb;
        const sourceUrl = info.descriptionurl || img;
        const title = (p.title || '').replace(/^File:/i, '').replace(/\.[^/.]+$/, '').trim();

        if (thumb && img) {
          results.push({
            id: `wikimedia-${pid}`,
            title: title || cleanTerm,
            thumbnailUrl: thumb,
            imageUrl: img,
            sourceUrl: sourceUrl || `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.title || '')}`,
            domain: 'commons.wikimedia.org',
          });
        }
      }

      if (results.length > 0) {
        return results;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      // Continue to next query pattern if one attempt fails
    }
  }

  return [];
}

/**
 * Resilient photojournalism ground imagery search pipeline:
 * 1. Checks fast in-memory query cache.
 * 2. Attempts backend API /api/search-event-images with short timeout (3.5s).
 * 3. Falls back immediately to direct client-side Wikimedia Commons query.
 * 4. Resolves local PAGASA typhoon aliases (e.g. "Ursula", "Yolanda") if primary query is empty.
 * 5. Caches successful results for instant subsequent lookups.
 */
export async function searchGroundImages(
  eventName: string,
  customQuery?: string,
  signal?: AbortSignal
): Promise<GroundImageResult[]> {
  const query = (customQuery || eventName).trim();
  const cleanKey = query.toLowerCase().replace(/\s+/g, ' ');

  if (!cleanKey || cleanKey.length < 2) return [];

  if (imageSearchCache.has(cleanKey)) {
    return imageSearchCache.get(cleanKey)!;
  }

  let results: GroundImageResult[] = [];

  // Step 1: Attempt Backend search proxy first (if server is awake and reachable)
  try {
    const cleanEventName = query.replace(/\(.*?\)/g, '').trim();
    const timeoutController = new AbortController();
    const abortHandler = () => timeoutController.abort();
    if (signal) signal.addEventListener('abort', abortHandler);

    const timeoutId = setTimeout(() => timeoutController.abort(), 3500);

    try {
      const res = await apiFetch(`/api/search-event-images?q=${encodeURIComponent(cleanEventName)}`, {
        signal: timeoutController.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          results = data;
        }
      }
    } catch {
      clearTimeout(timeoutId);
      // Backend timed out or failed; seamlessly proceed to direct Wikimedia fallback
    } finally {
      if (signal) signal.removeEventListener('abort', abortHandler);
    }
  } catch (err: any) {
    if (err.name === 'AbortError' && signal?.aborted) throw err;
  }

  // Step 2: Direct client-side Wikimedia Commons fallback
  if (results.length === 0 && !signal?.aborted) {
    try {
      results = await searchWikimediaCommons(query, signal);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
    }
  }

  // Step 3: Check local PAGASA storm alias if applicable (e.g. "Typhoon Ursula")
  if (results.length === 0 && !signal?.aborted) {
    const parsed = parseEventNames(eventName);
    if (parsed.local && parsed.local.toLowerCase() !== query.toLowerCase()) {
      try {
        results = await searchWikimediaCommons(`Typhoon ${parsed.local}`, signal);
      } catch (err: any) {
        if (err.name === 'AbortError') throw err;
      }
    }
  }

  if (results.length > 0) {
    imageSearchCache.set(cleanKey, results);
  }

  return results;
}
