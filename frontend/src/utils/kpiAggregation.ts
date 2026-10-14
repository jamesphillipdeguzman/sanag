import type { Municipality, DisasterEvent } from '@/types';
import { PANAY_PROVINCE_SET, isPanayProvince, resolveRegionFromCoordinates } from './regionLookup';
import { REGION_PROVINCE_MAP } from '../data/transmissionStations';

export interface KpiSummaryMetrics {
  totalMonitoredLgus: number;
  criticalLgus: Municipality[];
  criticalCount: number;
  criticalPopulation: number;
  criticalCohortPopulation: number;
  intermediateLgus: Municipality[];
  intermediateCount: number;
  intermediatePopulation: number;
  restoredLgus: Municipality[];
  restoredCount: number;
  restoredPopulation: number;
  unavailableCount: number;
  unavailableLgus: Municipality[];
  unavailablePopulation: number;
  totalScopedPopulation: number;
  affectedPopulation: number;
  validScoreCount: number;
  avgRecovery: number | null;
  isCritical: boolean;
  isSingleMunicipality: boolean;
}

/**
 * Normalizes R(t) recovery score to a 0..100 percentage scale.
 * Handles fractional ratios (0..1.0) and already scaled values (0..100).
 * Returns null if missing, null, undefined, or non-numeric (NEVER defaults to 100%).
 */
export function normalizeRecoveryScore(m: any): number | null {
  if (!m) return null;
  const val = m.recovery_score ?? m.recoveryScore ?? m.r_t;
  if (val == null || val === '') return null;
  const num = Number(val);
  if (isNaN(num) || num < 0) return null;
  if (num > 0 && num <= 1.0) {
    return Math.max(0, Math.min(100, Math.round(num * 100)));
  }
  return Math.min(100, Math.round(num));
}

/**
 * Categorizes a recovery score into canonical operational benchmarks:
 * - Critical: < 60%
 * - Intermediate / Active Restoration: 60% to below 90%
 * - Restored / Near-Full: >= 90%
 * - Unavailable: null / missing observation
 */
export function getRecoveryScoreTier(
  score: number | null | undefined
): 'critical' | 'intermediate' | 'restored' | 'unavailable' {
  if (score == null || isNaN(score)) return 'unavailable';
  if (score < 60) return 'critical';
  if (score < 90) return 'intermediate';
  return 'restored';
}

/**
 * Mapping of regions to known constituent province names (all lowercase).
 */
const REGION_TO_PROVINCES: Record<string, string[]> = {
  panay: ['iloilo', 'capiz', 'aklan', 'antique'],
  panay_guimaras: ['iloilo', 'capiz', 'aklan', 'antique', 'guimaras', 'negros occidental'],
  western_visayas: ['iloilo', 'capiz', 'aklan', 'antique', 'guimaras', 'negros occidental'],
  r6: ['iloilo', 'capiz', 'aklan', 'antique', 'guimaras', 'negros occidental'],
  nir: ['negros occidental', 'negros oriental', 'siquijor'],
  negros: ['negros occidental', 'negros oriental'],
  r6_negros: ['negros occidental'],
  central_visayas: ['cebu', 'bohol', 'negros oriental', 'siquijor'],
  cebu_bohol: ['cebu', 'bohol'],
  r7: ['cebu', 'bohol', 'negros oriental', 'siquijor'],
  eastern_visayas: ['leyte', 'southern leyte', 'samar', 'western samar', 'northern samar', 'eastern samar', 'biliran'],
  r8: ['leyte', 'southern leyte', 'samar', 'western samar', 'northern samar', 'eastern samar', 'biliran'],
  ncr: ['metro manila', 'ncr'],
  ncr_southern_tagalog: ['metro manila', 'batangas', 'cavite', 'laguna', 'quezon', 'rizal'],
  calabarzon: ['batangas', 'cavite', 'laguna', 'quezon', 'rizal'],
  r4a: ['batangas', 'cavite', 'laguna', 'quezon', 'rizal'],
  calabarzon_mimaropa: ['batangas', 'cavite', 'laguna', 'quezon', 'rizal', 'marinduque', 'occidental mindoro', 'oriental mindoro', 'palawan', 'romblon'],
  r4b: ['marinduque', 'occidental mindoro', 'oriental mindoro', 'palawan', 'romblon'],
  bicol: ['albay', 'camarines norte', 'camarines sur', 'catanduanes', 'masbate', 'sorsogon'],
  r5: ['albay', 'camarines norte', 'camarines sur', 'catanduanes', 'masbate', 'sorsogon'],
  central_luzon: ['aurora', 'bataan', 'bulacan', 'nueva ecija', 'pampanga', 'tarlac', 'zambales'],
  r3: ['aurora', 'bataan', 'bulacan', 'nueva ecija', 'pampanga', 'tarlac', 'zambales'],
  car: ['abra', 'apayao', 'benguet', 'ifugao', 'kalinga', 'mountain province'],
  ilocos_cagayan: ['ilocos norte', 'ilocos sur', 'la union', 'pangasinan', 'batanes', 'cagayan', 'isabela', 'nueva vizcaya', 'quirino'],
  r1: ['ilocos norte', 'ilocos sur', 'la union', 'pangasinan'],
  r2: ['batanes', 'cagayan', 'isabela', 'nueva vizcaya', 'quirino'],
  zamboanga_peninsula: ['zamboanga del norte', 'zamboanga del sur', 'zamboanga sibugay'],
  r9: ['zamboanga del norte', 'zamboanga del sur', 'zamboanga sibugay'],
  northern_mindanao_caraga: ['bukidnon', 'camiguin', 'lanao del norte', 'misamis occidental', 'misamis oriental', 'agusan del norte', 'agusan del sur', 'dinagat islands', 'surigao del norte', 'surigao del sur'],
  r10: ['bukidnon', 'camiguin', 'lanao del norte', 'misamis occidental', 'misamis oriental'],
  r13: ['agusan del norte', 'agusan del sur', 'dinagat islands', 'surigao del norte', 'surigao del sur'],
  mindanao_south: ['davao de oro', 'davao del norte', 'davao del sur', 'davao occidental', 'davao oriental', 'cotabato', 'sarangani', 'south cotabato', 'sultan kudarat'],
  r11: ['davao de oro', 'davao del norte', 'davao del sur', 'davao occidental', 'davao oriental'],
  r12: ['cotabato', 'sarangani', 'south cotabato', 'sultan kudarat'],
  barmm: ['basilan', 'lanao del sur', 'maguindanao del norte', 'maguindanao del sur', 'sulu', 'tawi-tawi'],
};

/**
 * Filter municipalities according to geographic scope.
 * Derives monitored count strictly from the active validated scope:
 * - 'nationwide', 'all', 'philippines': all LGUs in active dataset
 * - 'panay': constituent provinces of Panay (Iloilo, Antique, Aklan, Capiz)
 * - Specific region (e.g. 'central_visayas', 'eastern_visayas', 'ncr', 'nir', etc.)
 * - Specific province (e.g. 'capiz', 'iloilo', 'cebu', 'batangas', etc.)
 * NEVER silently falls back to Panay when another scope is selected.
 */
/**
 * Filter municipalities according to geographic scope.
 * Derives monitored count strictly from the active validated scope:
 * 1. Single municipality (if selectedMunicipality is specified)
 * 2. Single province (if selectedProvinceKey is specified and not 'all')
 * 3. Single province (if selectedRegionKey matches a known single province)
 * 4. Macro-region (e.g. 'panay', 'eastern_visayas', 'central_visayas')
 * - 'nationwide', 'all', 'philippines': all LGUs in active dataset
 * - 'panay': constituent provinces of Panay (Iloilo, Antique, Aklan, Capiz)
 * NEVER silently falls back to Panay when another scope is selected.
 */
export function computeScopedMunicipalities(
  municipalities: Municipality[],
  selectedRegionKey?: string | null,
  selectedProvinceKey?: string | null,
  selectedMunicipality?: Municipality | null
): Municipality[] {
  if (!municipalities || municipalities.length === 0) return [];

  // 1. Single municipality
  if (selectedMunicipality) {
    return [selectedMunicipality];
  }

  // Helper to extract province name cleanly
  const getProvince = (m: any): string => {
    return (m?.properties?.province || m?.properties?.ADM2_EN || m?.province || '').toLowerCase().trim();
  };

  // 2. Single province selected (e.g., 'iloilo', 'capiz', 'batangas', 'leyte')
  if (selectedProvinceKey && selectedProvinceKey !== 'all') {
    const provKey = selectedProvinceKey.toLowerCase().replace(/\s+province$/i, '').trim();
    return municipalities.filter((m) => {
      const p = getProvince(m);
      return p === provKey || p.includes(provKey) || provKey.includes(p);
    });
  }

  const rawRegKey = (selectedRegionKey || 'panay').toLowerCase().trim();
  const regKey = rawRegKey.replace(/\s+province$/i, '').trim();

  // 3. Nationwide or All
  if (regKey === 'all' || regKey === 'philippines' || regKey === 'nationwide') {
    return municipalities;
  }

  // 4. Single province selected as selectedRegionKey (e.g. 'iloilo', 'capiz', 'aklan', 'antique', 'batangas', 'leyte', 'cebu')
  if (
    (REGION_PROVINCE_MAP[regKey] && REGION_PROVINCE_MAP[regKey].length === 1) ||
    PANAY_PROVINCE_SET.has(regKey)
  ) {
    const targetProv = (REGION_PROVINCE_MAP[regKey]?.[0] || regKey).toLowerCase().replace(/\s+province$/i, '').trim();
    return municipalities.filter((m) => {
      const p = getProvince(m);
      return p === targetProv || p.includes(targetProv) || targetProv.includes(p);
    });
  }

  // 5. Panay Island scope: constituent provinces (exactly 95 LGUs)
  if (regKey === 'panay') {
    const panayMatches = municipalities.filter((m) => isPanayProvince(getProvince(m)));
    return panayMatches;
  }

  // 6. Panay & Guimaras
  if (regKey === 'panay_guimaras') {
    const pgMatches = municipalities.filter(
      (m) => isPanayProvince(getProvince(m)) || getProvince(m) === 'guimaras'
    );
    if (pgMatches.length > 0) return pgMatches;
  }

  // 7. Macro-Region match using known province mapping
  const mappedProvs = REGION_PROVINCE_MAP[regKey] || REGION_TO_PROVINCES[regKey];
  if (mappedProvs && mappedProvs.length > 1) {
    const allowed = new Set(mappedProvs.map((p) => p.toLowerCase()));
    const matches = municipalities.filter((m) => {
      const prov = getProvince(m);
      const reg = (m.properties?.region || m.region || '').toLowerCase().trim();
      return allowed.has(prov) || reg.includes(regKey);
    });
    if (matches.length > 0) return matches;
  }

  // 8. Single Province fallback match on regKey
  const provMatches = municipalities.filter((m) => {
    const prov = getProvince(m);
    return prov === regKey || prov.includes(regKey) || regKey.includes(prov);
  });
  if (provMatches.length > 0) return provMatches;

  // 9. Direct Region string match on municipality metadata
  const regionMatches = municipalities.filter((m) => {
    const reg = (m.properties?.region || m.region || '').toLowerCase().trim();
    return reg === regKey || reg.includes(regKey);
  });
  if (regionMatches.length > 0) return regionMatches;

  // If no explicit selection was made (undefined/empty), return Panay matches if present, otherwise municipalities
  if (!selectedRegionKey) {
    const panayMatches = municipalities.filter((m) => isPanayProvince(getProvince(m)));
    return panayMatches.length > 0 ? panayMatches : municipalities;
  }

  // When a specific non-Panay scope was requested but yielded no matches, return empty array
  // rather than silently falling back to Panay
  return [];
}

/**
 * Computes deterministic KPI metrics for Regional / Island or Single Municipality scopes:
 * - Separates monitored LGUs, total footprint population, critical LGUs, critical-cohort population,
 *   restored LGUs, average recovery, and unavailable-score counts.
 * - Ensures strictly non-overlapping cohorts:
 *   totalMonitoredLgus = criticalCount + intermediateCount + restoredCount + unavailableCount.
 * - Restored cohort requires score >= 90%.
 * - Critical cohort requires score < 60%.
 * - Missing/unobserved scores are counted in unavailableCount, NEVER defaulted to 100%.
 * - Never labels total population as affected when criticalCount === 0.
 */
export function computeKpiMetrics(
  scopedMunicipalities: Municipality[],
  selectedMunicipality?: Municipality | any | null
): KpiSummaryMetrics {
  const isSingleMunicipality = !!selectedMunicipality;

  if (selectedMunicipality) {
    const score = normalizeRecoveryScore(selectedMunicipality);
    const tier = getRecoveryScoreTier(score);
    const pop = Number(selectedMunicipality.population) || 0;

    const isCrit = tier === 'critical';
    const isRestored = tier === 'restored';
    const isUnavailable = tier === 'unavailable';
    const isIntermediate = tier === 'intermediate';

    const criticalLgus = isCrit ? [selectedMunicipality] : [];
    const restoredLgus = isRestored ? [selectedMunicipality] : [];
    const unavailableLgus = isUnavailable ? [selectedMunicipality] : [];

    const criticalPop = isCrit ? pop : 0;
    const intermediatePop = isIntermediate ? pop : 0;
    const restoredPop = isRestored ? pop : 0;
    const unavailablePop = isUnavailable ? pop : 0;

    return {
      totalMonitoredLgus: 1,
      criticalLgus,
      criticalCount: isCrit ? 1 : 0,
      criticalPopulation: criticalPop,
      criticalCohortPopulation: criticalPop,
      intermediateLgus: isIntermediate ? [selectedMunicipality] : [],
      intermediateCount: isIntermediate ? 1 : 0,
      intermediatePopulation: intermediatePop,
      restoredLgus,
      restoredCount: isRestored ? 1 : 0,
      restoredPopulation: restoredPop,
      unavailableCount: isUnavailable ? 1 : 0,
      unavailableLgus,
      unavailablePopulation: unavailablePop,
      totalScopedPopulation: pop,
      affectedPopulation: criticalPop,
      validScoreCount: isUnavailable ? 0 : 1,
      avgRecovery: score != null ? Math.round(score) : null,
      isCritical: isCrit,
      isSingleMunicipality: true,
    };
  }

  const totalMonitoredLgus = scopedMunicipalities.length;
  const totalScopedPopulation = scopedMunicipalities.reduce(
    (acc, m) => acc + (Number(m.population) || 0),
    0
  );

  const criticalLgus: Municipality[] = [];
  const intermediateLgus: Municipality[] = [];
  const restoredLgus: Municipality[] = [];
  const unavailableLgus: Municipality[] = [];
  let validScoresSum = 0;
  let validScoresCount = 0;

  for (const m of scopedMunicipalities) {
    const score = normalizeRecoveryScore(m);
    const tier = getRecoveryScoreTier(score);

    if (tier === 'critical') {
      criticalLgus.push(m);
      validScoresSum += score!;
      validScoresCount++;
    } else if (tier === 'restored') {
      restoredLgus.push(m);
      validScoresSum += score!;
      validScoresCount++;
    } else if (tier === 'intermediate') {
      intermediateLgus.push(m);
      validScoresSum += score!;
      validScoresCount++;
    } else {
      unavailableLgus.push(m);
    }
  }

  const criticalPopulation = criticalLgus.reduce(
    (acc, m) => acc + (Number(m.population) || 0),
    0
  );
  const intermediatePopulation = intermediateLgus.reduce(
    (acc, m) => acc + (Number(m.population) || 0),
    0
  );
  const restoredPopulation = restoredLgus.reduce(
    (acc, m) => acc + (Number(m.population) || 0),
    0
  );
  const unavailablePopulation = unavailableLgus.reduce(
    (acc, m) => acc + (Number(m.population) || 0),
    0
  );

  const avgRecovery =
    validScoresCount > 0 ? Math.round(validScoresSum / validScoresCount) : null;

  return {
    totalMonitoredLgus,
    criticalLgus,
    criticalCount: criticalLgus.length,
    criticalPopulation,
    criticalCohortPopulation: criticalPopulation,
    intermediateLgus,
    intermediateCount: intermediateLgus.length,
    intermediatePopulation,
    restoredLgus,
    restoredCount: restoredLgus.length,
    restoredPopulation,
    unavailableCount: unavailableLgus.length,
    unavailableLgus,
    unavailablePopulation,
    totalScopedPopulation,
    affectedPopulation: criticalPopulation,
    validScoreCount: validScoresCount,
    avgRecovery,
    isCritical: criticalLgus.length > 0,
    isSingleMunicipality: false,
  };
}

/**
 * Resolves active geographic scope when an incident is selected.
 * If current scope is unset, 'all', or 'nationwide', resolves to the incident's
 * specific geographic region without falling back unconditionally to 'panay'.
 */
export function resolveIncidentScope(
  currentRegionKey: string | null | undefined,
  activeEvent?: DisasterEvent | any | null
): string {
  const current = (currentRegionKey || '').toLowerCase().trim();

  // If filter is unset or explicitly nationwide/all, resolve to incident region
  if (!current || current === 'all' || current === 'nationwide' || current === 'philippines') {
    if (activeEvent?.regionKey) {
      return String(activeEvent.regionKey).toLowerCase().trim();
    }
    if (activeEvent?.latitude != null && activeEvent?.longitude != null) {
      // Dynamic coordinate resolution
      const lat = Number(activeEvent.latitude);
      const lng = Number(activeEvent.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        const res = resolveRegionFromCoordinates(lat, lng);
        if (res && res !== 'nationwide') return res;
      }
    }
    if (activeEvent?.epicenterProvince) {
      return String(activeEvent.epicenterProvince).toLowerCase().trim();
    }
    return 'nationwide';
  }

  // Preserve user's explicitly selected regional scope
  return currentRegionKey!;
}
