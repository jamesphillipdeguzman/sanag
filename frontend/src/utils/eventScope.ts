import type { DisasterEvent } from '@/types';

export const PANAY_REGION_KEYS = new Set(['panay', 'iloilo', 'capiz', 'aklan', 'antique']);

/**
 * Checks if a given regionKey represents Panay Island or one of its 4 provinces.
 */
export function isPanayRegion(regionKey?: string | null): boolean {
  if (!regionKey) return true; // Default scope is Panay
  return PANAY_REGION_KEYS.has(regionKey.toLowerCase().trim());
}

/**
 * Checks if a given regionKey represents nationwide overview.
 */
export function isNationwideRegion(regionKey?: string | null): boolean {
  return regionKey?.toLowerCase().trim() === 'philippines';
}

/**
 * Checks if an event is strictly localized/exclusive to Panay Island
 * (e.g., Panay Island Grid Collapse).
 */
export function isPanayExclusiveEvent(event: DisasterEvent): boolean {
  const id = (event.id || '').toLowerCase().trim();
  const name = (event.name || '').toLowerCase().trim();
  const desc = (event.description || '').toLowerCase().trim();

  // Explicit known Panay-exclusive IDs
  if (
    id === 'panay-blackout-2024' ||
    id.startsWith('panay-')
  ) {
    return true;
  }

  // Panay Grid Collapse, Panay Blackout
  if (
    name.includes('panay island grid collapse') ||
    name.includes('panay blackout')
  ) {
    return true;
  }

  // Check if title specifically targets Panay and is not a multi-regional typhoon/monsoon
  if (name.includes('panay') && !name.includes('philippines') && !id.includes('haiyan') && !id.includes('rai') && !id.includes('odette')) {
    return true;
  }

  // Check if description specifies island-wide blackout across Panay
  if (desc.includes('blackout across panay') || desc.includes('grid collapse across panay')) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether an event is geographically compatible with the currently selected region.
 * If region is a non-Panay region (such as Region IV-A / CALABARZON, NCR, Region VII, etc.),
 * Panay-exclusive events will return false so they can be filtered or disabled to prevent geographic mismatches.
 */
export function isEventCompatibleWithRegion(event: DisasterEvent, regionKey?: string | null): boolean {
  // If region is Panay or Nationwide, all events are compatible
  if (!regionKey || isPanayRegion(regionKey) || isNationwideRegion(regionKey)) {
    return true;
  }

  // If region is non-Panay (e.g. 'r4a', 'ncr', 'r3', 'r7', 'r11', etc.)
  // Panay-exclusive events are NOT compatible
  if (isPanayExclusiveEvent(event)) {
    return false;
  }

  return true;
}

/**
 * Human-readable mapping of region keys to formal geographic names.
 */
export const REGION_NAMES: Record<string, string> = {
  panay: 'Panay Island',
  iloilo: 'Iloilo Province',
  capiz: 'Capiz Province',
  aklan: 'Aklan Province',
  antique: 'Antique Province',
  philippines: 'Nationwide (Philippines)',
  ncr: 'NCR (Metro Manila)',
  r3: 'Region III (Central Luzon)',
  r4a: 'Region IV-A (CALABARZON)',
  r5: 'Region V (Bicol Region)',
  r1: 'Region I (Ilocos Region)',
  r2: 'Region II (Cagayan Valley)',
  car: 'CAR (Cordillera)',
  r4b: 'MIMAROPA (Region IV-B)',
  r7: 'Region VII (Central Visayas / Cebu)',
  r8: 'Region VIII (Eastern Visayas / Leyte)',
  r6_negros: 'Region VI (Negros Occidental)',
  r11: 'Region XI (Davao Region)',
  r10: 'Region X (Northern Mindanao)',
  r9: 'Region IX (Zamboanga Peninsula)',
  r12: 'Region XII (SOCCSKSARGEN)',
  r13: 'Region XIII (Caraga)',
  barmm: 'BARMM (Bangsamoro)',
};

/**
 * Returns formatted region display name.
 */
export function getRegionDisplayName(regionKey?: string | null): string {
  if (!regionKey) return 'Panay Island';
  return REGION_NAMES[regionKey] || regionKey.toUpperCase();
}
