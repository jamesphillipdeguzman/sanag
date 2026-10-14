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
import { PANAY_PROVINCE_SET, resolveRegionFromCoordinates } from '../utils/regionLookup';
import { formatAffectedPopulation, formatAffectedCompact } from '../utils/formatters';
import { ALL_SUBSTATIONS, getStationsByProvince, computeDistanceKm } from '../data/transmissionStations';
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
    expect(kpis.criticalCount).toBe(
      scoped.filter((m) => m.recoveryScore != null && m.recoveryScore < 60).length
    );

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

  it('Test 5: Task 1 Conditional Population Copy - Normal LGU drops affected', () => {
    // Single LGU with R(t) = 100% (e.g. Quezon City)
    const qc = {
      recoveryScore: 100,
      population: 3000000,
    };
    const isDeficit = qc.recoveryScore < 90;
    expect(isDeficit).toBe(false);

    // Population display formatting
    const formatted = formatAffectedCompact(qc.population);
    expect(formatted).toBe('3M');
    const displayVal = isDeficit ? `${formatted} affected` : `${formatted} total`;
    expect(displayVal).toBe('3M total');
  });

  it('Test 6: Task 1 Conditional Population Copy - Deficit LGU retains affected', () => {
    // Single LGU with R(t) = 55% (< 90%)
    const deficitLgu = {
      recoveryScore: 55,
      population: 85000,
    };
    const isDeficit = deficitLgu.recoveryScore < 90;
    expect(isDeficit).toBe(true);

    const displayVal = isDeficit
      ? formatAffectedPopulation(deficitLgu.population)
      : `${formatAffectedCompact(deficitLgu.population)} total`;
    expect(displayVal).toBe('85K affected');
  });

  it('Test 7: Task 2 Dynamic Spatial Scoping - Panay yields 14 active stations', () => {
    const panayProvinces = new Set(['iloilo', 'capiz', 'aklan', 'antique']);
    const panayStations = ALL_SUBSTATIONS.filter(
      (s) => panayProvinces.has(s.province.toLowerCase()) && s.status === 'active'
    );
    expect(panayStations.length).toBe(14);

    const grouped = getStationsByProvince(panayStations);
    expect(grouped.length).toBe(4);
  });

  it('Test 8: Task 2 Dynamic Spatial Scoping - Batangas scope displays Batangas assets', () => {
    const batangasStations = ALL_SUBSTATIONS.filter((s) => s.province.toLowerCase() === 'batangas');
    expect(batangasStations.length).toBe(3);

    const names = batangasStations.map((s) => s.name);
    expect(names.includes('Calaca Bulk Substation')).toBe(true);
    expect(names.includes('Lipa Substation')).toBe(true);
    expect(names.includes('Batangas City Substation')).toBe(true);

    // Panay stations not included
    expect(batangasStations.some((s) => s.province === 'iloilo')).toBe(false);
  });

  it('Test 9: Task 2 Spatial distance computation and fallback detection', () => {
    // Distance between Calaca Substation [13.9317, 120.8122] and Lipa City [13.9419, 121.1631] (~38km)
    const dist = computeDistanceKm([13.9317, 120.8122], [13.9419, 121.1631]);
    expect(dist > 30).toBe(true);
    expect(dist < 50).toBe(true);
  });

  it('Test 10: Task 1 Coordinate Resolver - Super Typhoon Yolanda (11.1, 125.3) resolves eastern_visayas', () => {
    const region = resolveRegionFromCoordinates(11.1000, 125.3000);
    expect(region).toBe('eastern_visayas');
  });

  it('Test 11: Task 1 Coordinate Resolver - Typhoon Kalmaegi / Panay Grid (11.5, 122.3) resolves panay', () => {
    const region = resolveRegionFromCoordinates(11.5000, 122.3000);
    expect(region).toBe('panay');
  });

  it('Test 12: Task 1 Coordinate Resolver - Mt. Kanlaon / Cebu (10.412, 123.133) resolves central_visayas', () => {
    const region = resolveRegionFromCoordinates(10.4120, 123.1330);
    expect(region).toBe('central_visayas');
  });

  it('Test 13: Task 1 Coordinate Resolver - Taal Volcano / Batangas (14.002, 120.993) resolves calabarzon', () => {
    const region = resolveRegionFromCoordinates(14.0020, 120.9930);
    expect(region).toBe('calabarzon');
  });

  it('Test 14: Task 1 Coordinate Resolver - Metro Manila / NCR (14.5995, 121.0364) resolves ncr', () => {
    const region = resolveRegionFromCoordinates(14.5995, 121.0364);
    expect(region).toBe('ncr');
  });

  it('Test 15: Task 1 Coordinate Resolver - Central Luzon (15.4828, 120.7120) resolves central_luzon', () => {
    const region = resolveRegionFromCoordinates(15.4828, 120.7120);
    expect(region).toBe('central_luzon');
  });

  it('Test 16: Task 1 Coordinate Resolver - Out of bounds falls back to nationwide', () => {
    expect(resolveRegionFromCoordinates(0.0, 0.0)).toBe('nationwide');
    expect(resolveRegionFromCoordinates(NaN, NaN)).toBe('nationwide');
  });

  it('Test 17: Disaggregated Deficit Cohorts - 142 LGUs (13 Restored, 87 Warning, 42 Critical)', () => {
    const lgus: Municipality[] = [];
    // 13 Restored (>= 90%)
    for (let i = 0; i < 13; i++) {
      lgus.push({
        id: `res-${i}`,
        name: `Restored ${i}`,
        province: 'Cebu',
        region: 'Region VII',
        pcode: `ph07000${i}`,
        recoveryScore: 92,
        status: 'restored',
        population: 50000,
        daysSinceEvent: 10,
        baselineRadiance: 10.0,
        currentRadiance: 9.2,
        estimatedDaysToRecover: 0,
        area: 100,
      });
    }
    // 42 Critical (< 60%)
    for (let i = 0; i < 42; i++) {
      lgus.push({
        id: `crit-${i}`,
        name: `Critical ${i}`,
        province: 'Negros Oriental',
        region: 'Region VII',
        pcode: `ph07100${i}`,
        recoveryScore: 45,
        status: 'critical',
        population: 30000,
        daysSinceEvent: 10,
        baselineRadiance: 10.0,
        currentRadiance: 4.5,
        estimatedDaysToRecover: 14,
        area: 120,
      });
    }
    // 87 Warning / Intermediate (60% to 89%)
    for (let i = 0; i < 87; i++) {
      lgus.push({
        id: `warn-${i}`,
        name: `Warning ${i}`,
        province: 'Bohol',
        region: 'Region VII',
        pcode: `ph07200${i}`,
        recoveryScore: 78,
        status: 'warning',
        population: 25000,
        daysSinceEvent: 10,
        baselineRadiance: 10.0,
        currentRadiance: 7.8,
        estimatedDaysToRecover: 5,
        area: 110,
      });
    }

    const metrics = computeKpiMetrics(lgus);

    expect(metrics.totalMonitoredLgus).toBe(142);
    expect(metrics.restoredCount).toBe(13);
    expect(metrics.criticalCount).toBe(42);
    expect(metrics.intermediateCount).toBe(87);
    expect(metrics.restoredCount + metrics.intermediateCount + metrics.criticalCount).toBe(142);
  });
});


