interface Expectation<T = any> {
  toBe(expected: T): void;
  toBeLessThanOrEqual(expected: number): void;
}

export const expect = <T = any>(actual: T): Expectation<T> => ({
  toBe(expected: T) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, but got ${String(actual)}`);
    }
  },
  toBeLessThanOrEqual(expected: number) {
    if ((actual as unknown as number) > expected) {
      throw new Error(`Expected ${String(actual)} to be <= ${expected}`);
    }
  },
});

export const describe = (_name: string, fn: () => void) => {
  fn();
};

export const it = (_name: string, fn: () => void) => {
  fn();
};

import {
  computeScopedMunicipalities,
  computeKpiMetrics,
  resolveIncidentScope,
} from '../utils/kpiAggregation';
import { PANAY_PROVINCE_SET } from '../utils/regionLookup';
import type { Municipality, DisasterEvent } from '../types';

// Mock 95 Panay LGUs across 4 provinces (44 Iloilo, 18 Antique, 17 Aklan, 16 Capiz)
function generateMockPanayMunicipalities(): Municipality[] {
  const result: Municipality[] = [];
  const specs = [
    { province: 'Iloilo', count: 44, basePop: 40000 },
    { province: 'Antique', count: 18, basePop: 30000 },
    { province: 'Aklan', count: 17, basePop: 35000 },
    { province: 'Capiz', count: 16, basePop: 45000 },
    { province: 'Guimaras', count: 3, basePop: 20000 }, // Guimaras is outside 4 Panay provinces
  ];

  let idCounter = 1;
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      const isDeficit = (idCounter % 5 === 0);
      result.push({
        id: `mun-${idCounter}`,
        name: `${spec.province} Mun ${i + 1}`,
        province: spec.province,
        region: 'Region VI',
        pcode: `ph06${spec.province.slice(0, 2).toLowerCase()}${String(i + 1).padStart(3, '0')}`,
        recoveryScore: isDeficit ? 45 : 85,
        status: isDeficit ? 'critical' : 'recovering',
        population: spec.basePop + i * 500,
        daysSinceEvent: 10,
        baselineRadiance: 10.0,
        currentRadiance: isDeficit ? 4.5 : 8.5,
        estimatedDaysToRecover: isDeficit ? 14 : 3,
        area: 120,
      });
      idCounter++;
    }
  }

  return result;
}

describe('Panay Province Membership Mapping', () => {
  it('PANAY_PROVINCE_SET contains all 4 constituent provinces', () => {
    expect(PANAY_PROVINCE_SET.has('iloilo')).toBe(true);
    expect(PANAY_PROVINCE_SET.has('capiz')).toBe(true);
    expect(PANAY_PROVINCE_SET.has('aklan')).toBe(true);
    expect(PANAY_PROVINCE_SET.has('antique')).toBe(true);
    expect(PANAY_PROVINCE_SET.has('guimaras')).toBe(false);
  });

  it('evaluates exactly 95 municipalities when Panay Island is scoped', () => {
    const all = generateMockPanayMunicipalities();
    const panayOnly = computeScopedMunicipalities(all, 'panay');
    expect(panayOnly.length).toBe(95);
  });
});

describe('Phase 2 Unit Tests: KPI Aggregation & Hierarchical Scoping', () => {
  const municipalities = generateMockPanayMunicipalities();

  it('Test 1: Panay Island Scope Isolation (No Municipality Selected)', () => {
    const selectedRegionKey = 'panay';
    const selectedMunicipality = null;

    const scoped = computeScopedMunicipalities(municipalities, selectedRegionKey);
    const kpis = computeKpiMetrics(scoped, selectedMunicipality);

    // Monitored LGU count === 95
    expect(kpis.totalMonitoredLgus).toBe(95);

    // Critical LGU count <= 95 (only those with R(t) < 60%)
    expect(kpis.criticalCount).toBeLessThanOrEqual(95);
    expect(kpis.criticalCount).toBe(scoped.filter((m) => m.recoveryScore < 60).length);

    // Affected population aggregates only critical LGUs across all 4 provinces
    const expectedAffectedPop = kpis.criticalLgus.reduce((sum, m) => sum + (m.population || 0), 0);
    expect(kpis.affectedPopulation).toBe(expectedAffectedPop);
    expect(kpis.criticalPopulation).toBe(expectedAffectedPop);
  });

  it('Test 2: Single Municipality Scope', () => {
    const selectedRegionKey = 'panay';
    const selectedMunicipality: Municipality = {
      id: 'mun-roxas',
      name: 'Roxas City',
      province: 'Capiz',
      population: 179292,
      recoveryScore: 45,
      status: 'critical',
      daysSinceEvent: 10,
      baselineRadiance: 12.0,
      currentRadiance: 5.4,
      estimatedDaysToRecover: 12,
      area: 95,
    };

    const scoped = computeScopedMunicipalities(municipalities, selectedRegionKey);
    const kpis = computeKpiMetrics(scoped, selectedMunicipality);

    // Monitored LGU count === 1
    expect(kpis.totalMonitoredLgus).toBe(1);

    // Critical status === true (since 45 < 60)
    expect(kpis.criticalCount).toBe(1);
    expect(kpis.criticalLgus.length).toBe(1);

    // Affected population === 179292
    expect(kpis.affectedPopulation).toBe(179292);
    expect(kpis.totalScopedPopulation).toBe(179292);
    expect(kpis.avgRecovery).toBe(45);
  });

  it('Test 3: Incident Selection Does Not Overwrite Regional Scope', () => {
    const selectedRegionKey = 'panay';
    const typhoonKalmaegi: DisasterEvent = {
      id: 'typhoon-kalmaegi-2025',
      name: 'Typhoon Kalmaegi (Tino)',
      date: '2025-11-03',
      endDate: '2025-12-03',
      severity: 'Critical',
      type: 'typhoon',
      affectedPopulation: 1220000,
      description: 'Typhoon hitting northern Panay and Capiz',
      epicenterProvince: 'capiz',
      critical_municipalities: [
        { name: 'Roxas City', pcode: 'PH061914000', recovery_score: 38, r_t: 0.38, status: 'critical' },
        { name: 'Panay', pcode: 'PH061911000', recovery_score: 42, r_t: 0.42, status: 'critical' },
      ],
    };

    // Changing activeEvent must NOT overwrite selectedRegionKey
    const resolvedKey = resolveIncidentScope(selectedRegionKey, typhoonKalmaegi);
    expect(resolvedKey).toBe('panay');

    // Scoped LGU array length must remain 95
    const scoped = computeScopedMunicipalities(municipalities, resolvedKey);
    expect(scoped.length).toBe(95);
  });

  it('Test 4: Down-scoping allowed only when region filter is unset or "all"', () => {
    const eventWithEpicenter = {
      id: 'event-1',
      name: 'Event 1',
      epicenterProvince: 'capiz',
    };

    expect(resolveIncidentScope(null, eventWithEpicenter)).toBe('capiz');
    expect(resolveIncidentScope('all', eventWithEpicenter)).toBe('capiz');

    // Preserved for explicit regional scopes
    expect(resolveIncidentScope('panay', eventWithEpicenter)).toBe('panay');
    expect(resolveIncidentScope('panay_guimaras', eventWithEpicenter)).toBe('panay_guimaras');
    expect(resolveIncidentScope('central_visayas', eventWithEpicenter)).toBe('central_visayas');
  });
});
