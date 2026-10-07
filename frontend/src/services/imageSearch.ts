import { apiFetch } from './apiService';

export interface GroundImageResult {
  id: string;
  title: string;
  thumbnailUrl: string;
  imageUrl?: string;
  sourceUrl: string;
  domain: string;
  isFallback?: boolean;
  queryUsed?: string;
}

export interface SearchGroundImagesOptions {
  forceRefresh?: boolean;
  eventType?: string;
  limit?: number;
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
 * Typhoon name cross-mappings (PAGASA <-> International Joint Typhoon Warning / WMO names).
 * Allows bidirectional discovery when media is archived under either designation.
 */
const TYPHOON_CROSS_MAP: Record<string, string> = {
  gaemi: 'Carina',
  carina: 'Gaemi',
  trami: 'Kristine',
  kristine: 'Trami',
  nalgae: 'Paeng',
  paeng: 'Nalgae',
  megi: 'Agaton',
  agaton: 'Megi',
  rai: 'Odette',
  odette: 'Rai',
  molave: 'Quinta',
  quinta: 'Molave',
  phanfone: 'Ursula',
  ursula: 'Phanfone',
  hagupit: 'Ruby',
  ruby: 'Hagupit',
  haiyan: 'Yolanda',
  yolanda: 'Haiyan',
  fengshen: 'Frank',
  frank: 'Fengshen',
  kalmaegi: 'Tino',
  tino: 'Kalmaegi',
  ketsana: 'Ondoy',
  ondoy: 'Ketsana',
  vamco: 'Ulysses',
  ulysses: 'Vamco',
  goni: 'Rolly',
  rolly: 'Goni',
};

/**
 * Generates an intelligent, prioritized list of search queries for Wikimedia Commons.
 * Unlike rigid news wires that return 0 results for regional disasters (e.g. "Western Visayas Monsoon Flooding"),
 * this generates the unquoted event name followed by target regional keywords (e.g. "Iloilo flood", "Western Visayas typhoon").
 */
export function generateWikimediaQueries(rawName: string, eventType?: string): string[] {
  const clean = rawName.replace(/"/g, '').trim();
  const parsed = parseEventNames(clean);
  const base = parsed.base || clean;
  const local = parsed.local;

  const lower = clean.toLowerCase();
  const baseLower = base.toLowerCase();
  const typeLower = (eventType || '').toLowerCase();

  // Disaster classification
  const isFlood =
    typeLower.includes('flood') ||
    typeLower.includes('monsoon') ||
    typeLower.includes('habagat') ||
    typeLower.includes('fl') ||
    lower.includes('flood') ||
    lower.includes('monsoon') ||
    lower.includes('habagat') ||
    lower.includes('rain') ||
    lower.includes('inundation');

  const isTyphoon =
    typeLower.includes('typhoon') ||
    typeLower.includes('storm') ||
    typeLower.includes('cyclone') ||
    typeLower.includes('tc') ||
    lower.includes('typhoon') ||
    lower.includes('storm') ||
    lower.includes('cyclone') ||
    lower.includes('bagyo');

  const isQuake =
    typeLower.includes('quake') ||
    typeLower.includes('earthquake') ||
    typeLower.includes('seismic') ||
    typeLower.includes('eq') ||
    lower.includes('quake') ||
    lower.includes('earthquake') ||
    lower.includes('seismic') ||
    lower.includes('tremor');

  const isGrid =
    typeLower.includes('grid') ||
    typeLower.includes('blackout') ||
    typeLower.includes('power') ||
    lower.includes('grid') ||
    lower.includes('blackout') ||
    lower.includes('power outage') ||
    lower.includes('electricity') ||
    lower.includes('collapse');

  const isOilSpill =
    typeLower.includes('oil') ||
    typeLower.includes('spill') ||
    lower.includes('oil spill') ||
    lower.includes('spill');

  // Geographic region detection
  const isWesternVisayas =
    lower.includes('western visayas') ||
    lower.includes('panay') ||
    lower.includes('iloilo') ||
    lower.includes('capiz') ||
    lower.includes('antique') ||
    lower.includes('aklan') ||
    lower.includes('guimaras') ||
    lower.includes('negros occidental') ||
    lower.includes('bacolod') ||
    lower.includes('roxas') ||
    lower.includes('kalibo');

  const isCentralVisayas =
    lower.includes('central visayas') ||
    lower.includes('cebu') ||
    lower.includes('bohol') ||
    lower.includes('negros oriental') ||
    lower.includes('dumaguete');

  const isEasternVisayas =
    lower.includes('eastern visayas') ||
    lower.includes('leyte') ||
    lower.includes('samar') ||
    lower.includes('tacloban') ||
    lower.includes('ormoc');

  const isBicol =
    lower.includes('bicol') ||
    lower.includes('albay') ||
    lower.includes('camarines') ||
    lower.includes('legazpi') ||
    lower.includes('naga');

  const isNcrCalabarzon =
    lower.includes('manila') ||
    lower.includes('marikina') ||
    lower.includes('batangas') ||
    lower.includes('cavite') ||
    lower.includes('laguna') ||
    lower.includes('rizal') ||
    lower.includes('quezon') ||
    lower.includes('calabarzon');

  const isNorthernLuzon =
    lower.includes('cagayan') ||
    lower.includes('isabela') ||
    lower.includes('ilocos') ||
    lower.includes('benguet') ||
    lower.includes('baguio') ||
    lower.includes('cordillera');

  const isMindanao =
    lower.includes('mindanao') ||
    lower.includes('davao') ||
    lower.includes('agusan') ||
    lower.includes('surigao') ||
    lower.includes('cotabato');

  const queries: string[] = [];

  // 1. Direct unquoted event name
  if (base) {
    queries.push(base);
  }
  if (local && local.toLowerCase() !== baseLower) {
    queries.push(`Typhoon ${local}`);
    queries.push(`${base} ${local}`);
  }

  // Cross-mapped typhoon aliases (e.g. Ursula <-> Phanfone, Yolanda <-> Haiyan)
  for (const [key, mapped] of Object.entries(TYPHOON_CROSS_MAP)) {
    if (lower.includes(key)) {
      queries.push(`Typhoon ${mapped}`);
      queries.push(`Typhoon ${mapped} flood`);
      queries.push(`Typhoon ${mapped} damage`);
    }
  }

  // 2. Regional and hazard keywords
  const hasOtherRegion =
    isCentralVisayas ||
    isEasternVisayas ||
    isBicol ||
    isNcrCalabarzon ||
    isNorthernLuzon ||
    isMindanao;

  if (isWesternVisayas || !hasOtherRegion) {
    // Western Visayas (Sanag primary focus)
    if (isFlood) {
      if (lower.includes('antique')) {
        queries.push('Antique flood', 'Antique Philippines flood');
      }
      if (lower.includes('iloilo')) {
        queries.push('Iloilo flood', 'Iloilo City flood');
      }
      if (lower.includes('capiz')) {
        queries.push('Capiz flood', 'Roxas City flood');
      }
      queries.push(
        'Western Visayas flood',
        'Iloilo flood',
        'Panay flood',
        'Western Visayas typhoon',
        'Western Visayas monsoon',
        'Antique flood',
        'Capiz flood',
        'Visayas flood'
      );
    } else if (isTyphoon) {
      queries.push(
        'Western Visayas typhoon',
        'Panay typhoon',
        'Iloilo typhoon',
        'Visayas typhoon damage',
        'Typhoon Frank Iloilo'
      );
    } else if (isGrid) {
      queries.push(
        'Panay blackout',
        'Panay power outage',
        'Panay grid',
        'Iloilo blackout',
        'Visayas power grid'
      );
    } else if (isQuake) {
      queries.push(
        'Panay earthquake',
        'Western Visayas earthquake',
        'Iloilo earthquake'
      );
    } else if (isOilSpill) {
      queries.push(
        'Guimaras oil spill',
        'Iloilo oil spill',
        'Western Visayas oil spill'
      );
    } else {
      queries.push(
        'Western Visayas disaster',
        'Iloilo flood',
        'Panay flood',
        'Western Visayas typhoon'
      );
    }
  }

  if (isCentralVisayas) {
    if (isQuake) {
      queries.push('Bohol earthquake', 'Cebu earthquake', 'Central Visayas earthquake');
    } else if (isFlood) {
      queries.push('Cebu flood', 'Central Visayas flood');
    } else {
      queries.push('Cebu typhoon', 'Typhoon Odette Cebu', 'Central Visayas disaster');
    }
  }
  if (isEasternVisayas) {
    if (isFlood) {
      queries.push('Leyte flood', 'Samar flood', 'Tacloban flood');
    } else if (isQuake) {
      queries.push('Leyte earthquake', 'Samar earthquake');
    } else {
      queries.push('Tacloban typhoon', 'Typhoon Haiyan Leyte', 'Eastern Visayas typhoon');
    }
  }
  if (isBicol) {
    if (isFlood) {
      queries.push('Bicol flood', 'Legazpi flood', 'Albay flood');
    } else {
      queries.push('Albay typhoon', 'Bicol typhoon damage', 'Legazpi flood');
    }
  }
  if (isNcrCalabarzon) {
    if (isFlood) {
      queries.push('Marikina flood', 'Metro Manila flood', 'Manila flood');
    } else {
      queries.push('Metro Manila typhoon', 'Manila flood typhoon', 'Batangas volcano');
    }
  }
  if (isNorthernLuzon) {
    if (isFlood) {
      queries.push('Cagayan flood', 'Ilocos flood', 'Isabela flood');
    } else {
      queries.push('Cagayan typhoon', 'Isabela typhoon', 'Baguio landslide');
    }
  }
  if (isMindanao) {
    if (isQuake) {
      queries.push('Davao earthquake', 'Mindanao earthquake', 'Cotabato earthquake');
    } else if (isFlood) {
      queries.push('Davao flood', 'Agusan flood', 'Mindanao flood');
    } else {
      queries.push('Mindanao typhoon', 'Davao typhoon damage');
    }
  }

  // 3. National context fallbacks
  if (isFlood) {
    queries.push('Philippines flood disaster', 'Philippines flood aftermath');
  } else if (isTyphoon) {
    queries.push('Philippines typhoon damage', 'Philippines typhoon disaster');
  } else if (isQuake) {
    queries.push('Philippines earthquake damage');
  } else if (isGrid) {
    queries.push('Philippines blackout');
  }

  // Deduplicate while preserving priority order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const q of queries) {
    const trimmed = q.trim();
    const norm = trimmed.toLowerCase();
    if (trimmed && !seen.has(norm)) {
      seen.add(norm);
      deduped.push(trimmed);
    }
  }

  return deduped;
}

/**
 * Direct client-side Wikimedia Commons Action API query.
 * Strictly adheres to Wikimedia guidelines:
 * - Uses `origin=*` for CORS support in browsers
 * - Passes `Api-User-Agent` header to prevent throttling or silent 403s
 * - Uses `action=query&generator=search` with `gsrnamespace=6` (File:)
 * - Extracts valid images, thumbnail URLs, and full resolution image URLs
 * - Steps through event-specific and broader regional keywords automatically
 */
export async function searchWikimediaCommons(
  searchTerm: string,
  signal?: AbortSignal,
  limit: number = 16,
  eventType?: string
): Promise<GroundImageResult[]> {
  const cleanTerm = searchTerm.replace(/"/g, '').trim();
  if (!cleanTerm || cleanTerm.length < 2) return [];

  const queries = generateWikimediaQueries(cleanTerm, eventType);
  const collected: GroundImageResult[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const q of queries) {
    if (signal?.aborted) return [];

    try {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: q,
        gsrnamespace: '6', // Namespace 6 = File:
        gsrlimit: String(Math.min(limit, 20)),
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

      let addedFromThisQuery = 0;
      for (const [pid, p] of Object.entries<any>(pages)) {
        const info = p?.imageinfo?.[0];
        if (!info) continue;

        const mime = (info.mime || '').toLowerCase();
        // Strictly filter for browser-compatible image formats, excluding SVG/PDF/audio/video/tiff
        if (!mime.startsWith('image/') || mime.includes('svg') || mime.includes('tiff') || mime.includes('djvu')) {
          continue;
        }

        const thumb = info.thumburl || info.url;
        const img = info.url || thumb;
        if (!thumb || !img) continue;

        const itemId = `wikimedia-${pid}`;
        if (seenIds.has(itemId) || seenUrls.has(img)) continue;

        const rawTitle = p.title || '';
        const cleanTitle = rawTitle
          .replace(/^File:\s*/i, '')
          .replace(/\.[a-zA-Z0-9]+$/, '')
          .replace(/_/g, ' ')
          .trim();

        const sourceUrl =
          info.descriptionurl ||
          `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(rawTitle.replace(/^File:/i, ''))}`;

        collected.push({
          id: itemId,
          title: cleanTitle || cleanTerm,
          thumbnailUrl: thumb,
          imageUrl: img,
          sourceUrl,
          domain: 'commons.wikimedia.org',
          isFallback: q.toLowerCase() !== cleanTerm.toLowerCase(),
          queryUsed: q,
        });

        seenIds.add(itemId);
        seenUrls.add(img);
        addedFromThisQuery++;
      }

      // If we've collected enough relevant images across queries, return early
      if (collected.length >= limit) {
        break;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      // Continue to next regional query pattern if one attempt encounters network issue
    }
  }

  return collected.slice(0, limit);
}

/**
 * Resilient photojournalism ground imagery search pipeline:
 * 1. Checks fast in-memory query cache (bypassed if forceRefresh is true).
 * 2. Attempts backend API /api/search-event-images with 3.5s timeout.
 * 3. If backend returns 0 results or fails (common for regional disasters on news wires),
 *    automatically queries Wikimedia Commons API with event name and broader regional keywords.
 * 4. Ensures relevant imagery is displayed instead of the empty state.
 * 5. Caches successful results for instant subsequent lookups.
 */
export async function searchGroundImages(
  eventName: string,
  customQuery?: string,
  signal?: AbortSignal,
  options?: SearchGroundImagesOptions
): Promise<GroundImageResult[]> {
  const query = (customQuery || eventName).trim();
  const cleanKey = query.toLowerCase().replace(/\s+/g, ' ');

  if (!cleanKey || cleanKey.length < 2) return [];

  // When forceRefresh is true, bust the cache for this query
  if (options?.forceRefresh) {
    imageSearchCache.delete(cleanKey);
  } else if (imageSearchCache.has(cleanKey)) {
    return imageSearchCache.get(cleanKey)!;
  }

  let results: GroundImageResult[] = [];

  // Step 1: Attempt Backend search proxy first (if server is reachable)
  try {
    const cleanEventName = query.replace(/\(.*?\)/g, '').trim();
    const timeoutController = new AbortController();
    const abortHandler = () => timeoutController.abort();
    if (signal) signal.addEventListener('abort', abortHandler);

    const timeoutId = setTimeout(() => timeoutController.abort(), 3500);

    try {
      const refreshParam = options?.forceRefresh ? '&refresh=true' : '';
      const eventTypeParam = options?.eventType ? `&event_type=${encodeURIComponent(options.eventType)}` : '';
      const res = await apiFetch(
        `/api/search-event-images?q=${encodeURIComponent(cleanEventName)}${refreshParam}${eventTypeParam}`,
        {
          signal: timeoutController.signal,
        }
      );
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

  // Step 2: If news wire / backend returned 0 items, automatically query Wikimedia Commons
  // with event name and broader regional keywords (e.g. "Iloilo flood", "Western Visayas typhoon")
  if (results.length === 0 && !signal?.aborted) {
    try {
      results = await searchWikimediaCommons(query, signal, options?.limit || 16, options?.eventType);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
    }
  }

  // Step 3: If still empty and eventName differs from customQuery, try the eventName
  if (results.length === 0 && !signal?.aborted && eventName && eventName !== query) {
    try {
      results = await searchWikimediaCommons(eventName, signal, options?.limit || 16, options?.eventType);
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
    }
  }

  if (results.length > 0) {
    imageSearchCache.set(cleanKey, results);
  }

  return results;
}
