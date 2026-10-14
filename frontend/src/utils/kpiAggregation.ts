import type { Municipality, DisasterEvent } from '@/types';
import { PANAY_PROVINCE_SET, isPanayProvince } from './regionLookup';

export interface KpiSummaryMetrics {
  totalMonitoredLgus: number;
  criticalLgus: Municipality[];
  criticalCount: number;
  totalScopedPopulation: number;
  criticalPopulation: number;
  affectedPopulation: number;
  avgRecovery: number;
  restoredCount: number;
  isSingleMunicipality: boolean;
}

/**
 * Normalizes R(t) score to a 0..100 percentage scale.
 * Handles fractional ratios (0..1.0) and already scaled values (0..100).
 */
export function normalizeRecoveryScore(m: any): number {
  if (!m) return 100;
  const val = m.recovery_score ?? m.recoveryScore ?? m.r_t;
  if (val == null) return 100;
  const num = Number(val);
  if (isNaN(num)) return 100;
  if (num > 0 && num <= 1.0) return num * 100;
  return num;
}

/**
 * Filter municipalities according to geographic scope.
 * When 'panay' is selected (or default), returns all 95 municipalities
 * across the 4 constituent provinces (Iloilo, Antique, Aklan, Capiz).
 * NEVER conflates the monitored footprint with active event hazard buffers
 * or critical deficit lists.
 */
export function computeScopedMunicipalities(
  municipalities: Municipality[],
  selectedRegionKey?: string | null
): Municipality[] {
  if (!municipalities || municipalities.length === 0) return [];

  const regKey = (selectedRegionKey || 'panay').toLowerCase().trim();

  // 1. Panay Island scope: exactly the 4 constituent provinces (95 LGUs)
  if (!selectedRegionKey || regKey === 'panay') {
    const panayMatches = municipalities.filter((m) => isPanayProvince(m.province));
    return panayMatches.length > 0 ? panayMatches : municipalities;
  }

  // 2. Nationwide or All
  if (regKey === 'all' || regKey === 'philippines' || regKey === 'nationwide') {
    return municipalities;
  }

  // 3. Panay & Guimaras (98 LGUs)
  if (regKey === 'panay_guimaras') {
    const pgMatches = municipalities.filter(
      (m) => isPanayProvince(m.province) || (m.province || '').toLowerCase().trim() === 'guimaras'
    );
    if (pgMatches.length > 0) return pgMatches;
  }

  // 4. Single Province match (e.g. 'capiz', 'iloilo', 'aklan', 'antique', 'batangas', etc.)
  const provMatches = municipalities.filter(
    (m) => (m.province || '').toLowerCase().trim() === regKey
  );
  if (provMatches.length > 0) return provMatches;

  // 5. Region match (e.g. 'central_visayas', 'ncr', 'r3', 'r4a', etc.)
  const regionMatches = municipalities.filter(
    (m) => (m.region || '').toLowerCase().trim() === regKey
  );
  if (regionMatches.length > 0) return regionMatches;

  // Fallback: Panay Island baseline
  const defaultPanay = municipalities.filter((m) => isPanayProvince(m.province));
  return defaultPanay.length > 0 ? defaultPanay : municipalities;
}

/**
 * Computes deterministic KPI metrics for the two distinct hierarchy states:
 * 1. Regional / Island Scope (selectedMunicipality = null):
 *    - Total Monitored LGUs = All LGUs in active region (e.g. 95 for Panay)
 *    - Critical LGUs = LGUs with R(t) < 60%
 *    - Affected Population = Population of critical LGUs within region
 * 2. Single Municipality Selected (selectedMunicipality != null):
 *    - Total Monitored LGUs = 1
 *    - Targeted metrics for the single LGU
 */
export function computeKpiMetrics(
  scopedMunicipalities: Municipality[],
  selectedMunicipality?: Municipality | any | null
): KpiSummaryMetrics {
  const isSingleMunicipality = !!selectedMunicipality;

  // 1. Total Monitored Footprint
  const totalMonitoredLgus = selectedMunicipality
    ? 1
    : scopedMunicipalities.length;

  // 2. Critical Deficit LGUs (< 60% R(t))
  const criticalLgus = selectedMunicipality
    ? (normalizeRecoveryScore(selectedMunicipality) < 60 ? [selectedMunicipality] : [])
    : scopedMunicipalities.filter((m) => normalizeRecoveryScore(m) < 60);

  // 3. Population Accounting
  const totalScopedPopulation = selectedMunicipality
    ? (selectedMunicipality.population || 0)
    : scopedMunicipalities.reduce((acc, m) => acc + (m.population || 0), 0);

  const criticalPopulation = criticalLgus.reduce((acc, m) => acc + (m.population || 0), 0);

  // 4. Restored LGUs (>= 90% R(t))
  const restoredLgus = selectedMunicipality
    ? (normalizeRecoveryScore(selectedMunicipality) >= 90 ? [selectedMunicipality] : [])
    : scopedMunicipalities.filter((m) => normalizeRecoveryScore(m) >= 90);

  // 5. Average recovery score
  const avgRecovery = selectedMunicipality
    ? Math.round(normalizeRecoveryScore(selectedMunicipality))
    : (scopedMunicipalities.length > 0
        ? Math.round(
            scopedMunicipalities.reduce((sum, m) => sum + normalizeRecoveryScore(m), 0) /
              scopedMunicipalities.length
          )
        : 0);

  return {
    totalMonitoredLgus,
    criticalLgus,
    criticalCount: criticalLgus.length,
    totalScopedPopulation,
    criticalPopulation,
    affectedPopulation: criticalPopulation,
    avgRecovery,
    restoredCount: restoredLgus.length,
    isSingleMunicipality,
  };
}

/**
 * Resolves active geographic scope when an incident is selected.
 * Hardening rule:
 * Explicit user selections or island-wide defaults ('panay', 'panay_guimaras', 'central_visayas', etc.)
 * are NOT unconditionally overwritten by activeEvent.epicenterProvince.
 * Only allows automatic down-scoping if the active filter is unset or 'all'.
 */
export function resolveIncidentScope(
  currentRegionKey: string | null | undefined,
  activeEvent?: DisasterEvent | any | null
): string {
  const current = (currentRegionKey || '').toLowerCase().trim();

  // If filter is unset or explicitly 'all', allow down-scoping to incident epicenter if specified
  if (!current || current === 'all') {
    if (activeEvent?.epicenterProvince) {
      return String(activeEvent.epicenterProvince).toLowerCase().trim();
    }
    return 'panay';
  }

  // Preserve broader regional boundary unless user explicitly selected a single province/municipality
  return currentRegionKey!;
}
