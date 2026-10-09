/**
 * LGU Spatial Quick Lookup Index for Project SANAG
 * Provides sub-millisecond in-memory spatial resolution (bounding box, geographic center,
 * and canonical regional chunk key) for all 1,784+ Philippine Local Government Units (LGUs).
 */

import lguQuickLookupData from '@/data/lgu_quick_lookup.json';

export interface LguLookupEntry {
  bbox: [[number, number], [number, number]]; // [[minLat, minLng], [maxLat, maxLng]]
  region_code: string;
  center: [number, number]; // [lat, lng]
  name: string;
  province: string;
  pcode: string;
}

const lookupIndex: Record<string, LguLookupEntry> = lguQuickLookupData as any;

/**
 * Rapidly resolves an LGU by ID, PCODE, PSGC, or common name.
 */
export function findLguQuickLookup(idOrName: string | null | undefined): LguLookupEntry | null {
  if (!idOrName) return null;
  const raw = String(idOrName).trim();
  if (!raw) return null;

  // Direct exact match
  if (lookupIndex[raw]) return lookupIndex[raw];

  // Case-insensitive match
  const lower = raw.toLowerCase();
  if (lookupIndex[lower]) return lookupIndex[lower];

  const upper = raw.toUpperCase();
  if (lookupIndex[upper]) return lookupIndex[upper];

  // Normalized alphanumeric match (removes punctuation, parenthesis, and spacing)
  const norm = lower.replace(/\s*\(.*?\)\s*/g, '').replace(/[^a-z0-9]/g, '');
  if (lookupIndex[norm]) return lookupIndex[norm];

  // Match without trailing "City" suffix
  if (lower.endsWith(' city')) {
    const stripped = lower.replace(/\s+city$/, '').trim();
    if (lookupIndex[stripped]) return lookupIndex[stripped];
    const strippedNorm = stripped.replace(/[^a-z0-9]/g, '');
    if (lookupIndex[strippedNorm]) return lookupIndex[strippedNorm];
  }

  // Match without leading "City of" prefix
  if (lower.startsWith('city of ')) {
    const stripped = lower.replace(/^city\s+of\s+/, '').trim();
    if (lookupIndex[stripped]) return lookupIndex[stripped];
    const strippedNorm = stripped.replace(/[^a-z0-9]/g, '');
    if (lookupIndex[strippedNorm]) return lookupIndex[strippedNorm];
  }

  return null;
}

/**
 * Returns all indexed LGU entries.
 */
export function getAllIndexedLgus(): LguLookupEntry[] {
  const seen = new Set<string>();
  const list: LguLookupEntry[] = [];
  for (const entry of Object.values(lookupIndex)) {
    const key = entry.pcode || entry.name;
    if (!seen.has(key)) {
      seen.add(key);
      list.push(entry);
    }
  }
  return list;
}

export default findLguQuickLookup;
