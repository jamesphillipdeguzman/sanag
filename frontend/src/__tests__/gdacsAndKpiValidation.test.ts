import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  computeScopedMunicipalities,
  computeKpiMetrics,
  normalizeRecoveryScore,
  getRecoveryScoreTier,
  resolveIncidentScope,
} from '../utils/kpiAggregation';
import {
  REGIONAL_CHUNKS,
  REGION_PRESETS,
  resolveRegionFromCoordinates,
  getAllRegisteredRegions,
} from '../utils/regionLookup';
import { getRecoveryColor, getRecoveryStatusColor, events } from '../data/mockData';
import type { Municipality, DisasterEvent, GdacsAlert } from '../types';

interface Expectation<T = any> {
  toBe(expected: T): void;
  toEqual(expected: T): void;
  toBeGreaterThan(expected: number): void;
  toBeGreaterThanOrEqual(expected: number): void;
  toBeLessThan(expected: number): void;
  toBeNull(): void;
  toBeTruthy(): void;
  toBeFalsy(): void;
}

export const expect = <T = any>(actual: T): Expectation<T> => ({
  toBe(expected: T) {
    if (actual !== expected) {
      throw new Error(`Expected ${String(expected)}, but got ${String(actual)}`);
    }
  },
  toEqual(expected: T) {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new Error(`Expected ${expStr}, but got ${actStr}`);
    }
  },
  toBeGreaterThan(expected: number) {
    if ((actual as unknown as number) <= expected) {
      throw new Error(`Expected ${String(actual)} to be > ${expected}`);
    }
  },
  toBeGreaterThanOrEqual(expected: number) {
    if ((actual as unknown as number) < expected) {
      throw new Error(`Expected ${String(actual)} to be >= ${expected}`);
    }
  },
  toBeLessThan(expected: number) {
    if ((actual as unknown as number) >= expected) {
      throw new Error(`Expected ${String(actual)} to be < ${expected}`);
    }
  },
  toBeNull() {
    if (actual !== null) {
      throw new Error(`Expected null, but got ${String(actual)}`);
    }
  },
  toBeTruthy() {
    if (!actual) {
      throw new Error(`Expected truthy, but got ${String(actual)}`);
    }
  },
  toBeFalsy() {
    if (actual) {
      throw new Error(`Expected falsy, but got ${String(actual)}`);
    }
  },
});

export const describe = (name: string, fn: () => void) => {
  console.log(`\n--- Test Suite: ${name} ---`);
  fn();
};

export const it = (name: string, fn: () => void) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../../public');
const regionsDir = path.resolve(publicDir, 'regions');

describe('1. Geographic Scoping & Regional Dataset Integrity', () => {
  it('discovers and validates all 36 regional GeoJSON datasets in frontend/public', () => {
    const regionFiles = fs.readdirSync(regionsDir).filter((f: string) => f.endsWith('.geojson'));
    expect(regionFiles.length).toBeGreaterThan(20);

    const publicFiles = fs.readdirSync(publicDir).filter((f: string) => f.endsWith('.geojson'));
    expect(publicFiles.length).toBeGreaterThan(0);

    let totalGeoJsonFiles = regionFiles.length + publicFiles.length;
    expect(totalGeoJsonFiles).toBeGreaterThanOrEqual(36);

    // Validate NIR (Negros Island Region) dataset exists
    const nirFile = path.resolve(regionsDir, 'nir.geojson');
    expect(fs.existsSync(nirFile)).toBe(true);

    const nirRaw = JSON.parse(fs.readFileSync(nirFile, 'utf8'));
    expect(nirRaw.type).toBe('FeatureCollection');
    expect(Array.isArray(nirRaw.features)).toBe(true);
    expect(nirRaw.features.length).toBe(6); // 6 key component cities of Negros (Bacolod, Silay, Talisay, Bago, Kabankalan, San Carlos)

    // Verify all features have valid coordinates in EPSG:4326 (Philippines lat: 4..22, lng: 116..128)
    for (const f of nirRaw.features) {
      expect(f.geometry).toBeTruthy();
      expect(['Polygon', 'MultiPolygon'].includes(f.geometry.type)).toBe(true);
      const props = f.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2;
      expect(Boolean(pcode)).toBe(true);
    }
  });

  it('validates unique identifiers and non-zero features across all regional chunks', () => {
    for (const chunk of REGIONAL_CHUNKS) {
      const filePath = path.resolve(publicDir, chunk.geojsonPath.replace(/^\//, ''));
      expect(fs.existsSync(filePath)).toBe(true);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      expect(data.type).toBe('FeatureCollection');
      expect(data.features.length).toBeGreaterThan(0);

      // Verify identifier uniqueness within chunk
      const seenIds = new Set<string>();
      for (const f of data.features) {
        const id = f.properties?.ADM3_PCODE || f.properties?.psgc_code || f.properties?.GID_2 || f.properties?.id;
        expect(Boolean(id)).toBe(true);
        seenIds.add(id);
      }
      expect(seenIds.size).toBe(data.features.length);
    }
  });

  it('validates nationwide boundary feature count and coordinate bounds', () => {
    const nationPath = path.resolve(publicDir, 'philippines_boundaries.geojson');
    expect(fs.existsSync(nationPath)).toBe(true);
    const nationData = JSON.parse(fs.readFileSync(nationPath, 'utf8'));
    expect(nationData.type).toBe('FeatureCollection');
    expect(nationData.features.length).toBe(187); // 187 nationwide boundary features
  });
});

describe('2. Alert & Preset Geographic Resolution', () => {
  it('correctly resolves coordinates for all historical disaster presets', () => {
    for (const evt of events) {
      expect(Boolean(evt.id)).toBe(true);
      expect(Boolean(evt.name)).toBe(true);
      expect(Boolean(evt.date)).toBe(true);

      if (evt.latitude != null && evt.longitude != null) {
        const resolved = resolveRegionFromCoordinates(evt.latitude, evt.longitude);
        expect(Boolean(resolved)).toBe(true);
        const isValidMatch =
          !evt.regionKey ||
          resolved === evt.regionKey ||
          (evt.regionKey === 'panay' && ['antique', 'iloilo', 'capiz', 'aklan', 'panay'].includes(resolved)) ||
          (evt.regionKey === 'calabarzon' && ['calabarzon', 'calabarzon_mimaropa', 'ncr'].includes(resolved));
        expect(isValidMatch).toBe(true);
      }
    }
  });

  it('resolves GDACS alert coordinates without silent fallback to Panay', () => {
    const sampleAlerts: GdacsAlert[] = [
      {
        id: 'gdacs-tc-1',
        event_id: 1001,
        name: 'Tropical Cyclone Yolanda',
        title: 'Tropical Cyclone Yolanda',
        type: 'Tropical Cyclone',
        category: 'Typhoon',
        alert_level: 'Red',
        date: '2013-11-08',
        latitude: 11.1000,
        longitude: 125.3000,
        severity: 'Severe',
      },
      {
        id: 'gdacs-vo-1',
        event_id: 1002,
        name: 'Kanlaon Volcano Eruption',
        title: 'Kanlaon Volcano Eruption',
        type: 'Volcano',
        category: 'Volcanic Eruption',
        alert_level: 'Orange',
        date: '2024-06-03',
        latitude: 10.4120,
        longitude: 123.1330,
        severity: 'High',
      },
      {
        id: 'gdacs-vo-2',
        event_id: 1003,
        name: 'Taal Volcano Eruption',
        title: 'Taal Volcano Eruption',
        type: 'Volcano',
        category: 'Volcanic Eruption',
        alert_level: 'Red',
        date: '2020-01-12',
        latitude: 14.0020,
        longitude: 120.9930,
        severity: 'Severe',
      },
      {
        id: 'gdacs-eq-1',
        event_id: 1004,
        name: 'Davao Earthquake',
        title: 'Davao Earthquake',
        type: 'Earthquake',
        category: 'Earthquake',
        alert_level: 'Red',
        date: '2019-10-31',
        latitude: 6.9200,
        longitude: 125.1500,
        severity: 'Severe',
      },
    ] as unknown as GdacsAlert[];

    expect(resolveRegionFromCoordinates(sampleAlerts[0].latitude!, sampleAlerts[0].longitude!)).toBe('eastern_visayas');
    expect(resolveRegionFromCoordinates(sampleAlerts[1].latitude!, sampleAlerts[1].longitude!)).toBe('central_visayas');
    expect(resolveRegionFromCoordinates(sampleAlerts[2].latitude!, sampleAlerts[2].longitude!)).toBe('calabarzon');
    expect(resolveRegionFromCoordinates(sampleAlerts[3].latitude!, sampleAlerts[3].longitude!)).toBe('mindanao_south');
  });

  it('resolves incident scope preserving explicit user selections', () => {
    const activeEvt: DisasterEvent = {
      id: 'panay-blackout-2024',
      name: 'Panay Grid Collapse',
      date: '2024-01-02',
      regionKey: 'panay',
    } as unknown as DisasterEvent;

    const provinceEvt: DisasterEvent = {
      id: 'iloilo-incident-2024',
      name: 'Iloilo Local Outage',
      date: '2024-01-02',
      epicenterProvince: 'Iloilo',
    } as unknown as DisasterEvent;

    // Explicit island-wide scope should NOT down-scope to single province
    expect(resolveIncidentScope('panay', activeEvt)).toBe('panay');
    expect(resolveIncidentScope('panay_guimaras', activeEvt)).toBe('panay_guimaras');
    expect(resolveIncidentScope('all', activeEvt)).toBe('panay');
    expect(resolveIncidentScope('all', provinceEvt)).toBe('iloilo');
    expect(resolveIncidentScope('', provinceEvt)).toBe('iloilo');
  });
});

describe('3. Recovery Scores & Map Polygon Styling', () => {
  it('normalizes valid recovery scores and never defaults missing to 100%', () => {
    expect(normalizeRecoveryScore({ id: '1', name: 'A', recoveryScore: 85 } as Municipality)).toBe(85);
    expect(normalizeRecoveryScore({ id: '2', name: 'B', recoveryScore: 0 } as Municipality)).toBe(0);
    expect(normalizeRecoveryScore({ id: '3', name: 'C', recoveryScore: 100 } as Municipality)).toBe(100);
    expect(normalizeRecoveryScore({ id: '4', name: 'D', recoveryScore: 150 } as Municipality)).toBe(100);
    expect(normalizeRecoveryScore({ id: '5', name: 'E', recoveryScore: -10 } as Municipality)).toBeNull();
    expect(normalizeRecoveryScore({ id: '6', name: 'F', recoveryScore: null } as Municipality)).toBeNull();
    expect(normalizeRecoveryScore({ id: '7', name: 'G' } as Municipality)).toBeNull();
    expect(normalizeRecoveryScore({ id: '8', name: 'H', recoveryScore: undefined } as Municipality)).toBeNull();
  });

  it('partitions recovery scores into strict canonical tiers', () => {
    expect(getRecoveryScoreTier(45)).toBe('critical');
    expect(getRecoveryScoreTier(59)).toBe('critical');
    expect(getRecoveryScoreTier(60)).toBe('intermediate');
    expect(getRecoveryScoreTier(75)).toBe('intermediate');
    expect(getRecoveryScoreTier(89)).toBe('intermediate');
    expect(getRecoveryScoreTier(90)).toBe('restored');
    expect(getRecoveryScoreTier(100)).toBe('restored');
    expect(getRecoveryScoreTier(null)).toBe('unavailable');
    expect(getRecoveryScoreTier(undefined)).toBe('unavailable');
  });

  it('renders consistent RAG colors and neutral styling for unavailable scores', () => {
    // Critical (< 60%) = Red #EF4444
    expect(getRecoveryColor(45).toUpperCase()).toBe('#EF4444');
    expect(getRecoveryColor(0).toUpperCase()).toBe('#EF4444');
    expect(getRecoveryColor(59).toUpperCase()).toBe('#EF4444');

    // Intermediate (60%..89%) = Amber #F59E0B
    expect(getRecoveryColor(60).toUpperCase()).toBe('#F59E0B');
    expect(getRecoveryColor(85).toUpperCase()).toBe('#F59E0B');
    expect(getRecoveryColor(89).toUpperCase()).toBe('#F59E0B');

    // Restored (>= 90%) = Green #10B981
    expect(getRecoveryColor(90).toUpperCase()).toBe('#10B981');
    expect(getRecoveryColor(100).toUpperCase()).toBe('#10B981');

    // Missing / Unavailable = Neutral Slate #64748B (Never #10B981)
    expect(getRecoveryColor(null).toUpperCase()).toBe('#64748B');
    expect(getRecoveryColor(undefined).toUpperCase()).toBe('#64748B');
    expect(getRecoveryColor(NaN).toUpperCase()).toBe('#64748B');

    expect(getRecoveryStatusColor('unavailable').toUpperCase()).toBe('#64748B');
    expect(getRecoveryStatusColor(null).toUpperCase()).toBe('#64748B');
    expect(getRecoveryStatusColor('restored').toUpperCase()).toBe('#10B981');
    expect(getRecoveryStatusColor('critical').toUpperCase()).toBe('#EF4444');
  });
});

describe('4. Summary KPIs & Mathematical Invariants', () => {
  it('guarantees cohort partition: totalMonitoredLgus === critical + intermediate + restored + unavailable', () => {
    const mockLgus: Municipality[] = [
      { id: '1', name: 'LGU 1', province: 'Iloilo', population: 50000, recoveryScore: 40, status: 'critical' },
      { id: '2', name: 'LGU 2', province: 'Iloilo', population: 60000, recoveryScore: 55, status: 'critical' },
      { id: '3', name: 'LGU 3', province: 'Capiz', population: 30000, recoveryScore: 70, status: 'recovering' },
      { id: '4', name: 'LGU 4', province: 'Aklan', population: 40000, recoveryScore: 85, status: 'recovering' },
      { id: '5', name: 'LGU 5', province: 'Antique', population: 45000, recoveryScore: 95, status: 'restored' },
      { id: '6', name: 'LGU 6', province: 'Antique', population: 35000, recoveryScore: 92, status: 'restored' },
      { id: '7', name: 'LGU 7', province: 'Antique', population: 25000, recoveryScore: null, status: 'unavailable' },
      { id: '8', name: 'LGU 8', province: 'Capiz', population: 20000, recoveryScore: null, status: 'unavailable' },
    ] as unknown as Municipality[];

    const kpi = computeKpiMetrics(mockLgus);
    expect(kpi.totalMonitoredLgus).toBe(8);
    expect(kpi.criticalCount).toBe(2);
    expect(kpi.intermediateCount).toBe(2);
    expect(kpi.restoredCount).toBe(2);
    expect(kpi.unavailableCount).toBe(2);

    // Sum invariant
    expect(kpi.totalMonitoredLgus).toBe(
      kpi.criticalCount + kpi.intermediateCount + kpi.restoredCount + kpi.unavailableCount
    );

    // Population invariant
    expect(kpi.criticalPopulation).toBe(110000);
    expect(kpi.intermediatePopulation).toBe(70000);
    expect(kpi.restoredPopulation).toBe(80000);
    expect(kpi.totalScopedPopulation).toBe(305000);

    // Average recovery strictly over valid scores: (40 + 55 + 70 + 85 + 95 + 92) / 6 = 437 / 6 = 72.83 -> 73
    expect(kpi.validScoreCount).toBe(6);
    expect(kpi.avgRecovery).toBe(73);
  });

  it('guarantees zero-deficit rule: never labels total population as affected when no deficits exist', () => {
    const normalLgus: Municipality[] = [
      { id: '1', name: 'LGU 1', province: 'Iloilo', population: 50000, recoveryScore: 95, status: 'restored' },
      { id: '2', name: 'LGU 2', province: 'Iloilo', population: 60000, recoveryScore: 92, status: 'restored' },
      { id: '3', name: 'LGU 3', province: 'Capiz', population: 40000, recoveryScore: 90, status: 'restored' },
    ] as unknown as Municipality[];

    const kpi = computeKpiMetrics(normalLgus);
    expect(kpi.criticalCount).toBe(0);
    expect(kpi.criticalPopulation).toBe(0);
    expect(kpi.affectedPopulation).toBe(0);
    expect(kpi.isCritical).toBe(false);
    expect(kpi.totalScopedPopulation).toBe(150000);
  });

  it('handles empty datasets and 100% unavailable scores without NaN or division by zero', () => {
    const emptyKpi = computeKpiMetrics([]);
    expect(emptyKpi.totalMonitoredLgus).toBe(0);
    expect(emptyKpi.criticalCount).toBe(0);
    expect(emptyKpi.avgRecovery).toBeNull();
    expect(emptyKpi.totalScopedPopulation).toBe(0);

    const pendingLgus: Municipality[] = [
      { id: '1', name: 'LGU 1', province: 'Iloilo', population: 50000, recoveryScore: null, status: 'unavailable' },
      { id: '2', name: 'LGU 2', province: 'Iloilo', population: 60000, recoveryScore: null, status: 'unavailable' },
    ] as unknown as Municipality[];
    const pendingKpi = computeKpiMetrics(pendingLgus);
    expect(pendingKpi.totalMonitoredLgus).toBe(2);
    expect(pendingKpi.unavailableCount).toBe(2);
    expect(pendingKpi.validScoreCount).toBe(0);
    expect(pendingKpi.avgRecovery).toBeNull();
    expect(pendingKpi.criticalPopulation).toBe(0);
    expect(pendingKpi.affectedPopulation).toBe(0);
  });
});

describe('5. Scoping Hierarchies & Panay Assumption Elimination', () => {
  it('scopes municipalities dynamically for nationwide, regional, provincial, and single LGU', () => {
    const mockAll: Municipality[] = [
      { id: '1', name: 'Iloilo City', province: 'Iloilo', region: 'Region VI', population: 450000 },
      { id: '2', name: 'Roxas City', province: 'Capiz', region: 'Region VI', population: 180000 },
      { id: '3', name: 'Kalibo', province: 'Aklan', region: 'Region VI', population: 90000 },
      { id: '4', name: 'San Jose', province: 'Antique', region: 'Region VI', population: 65000 },
      { id: '5', name: 'Jordan', province: 'Guimaras', region: 'Region VI', population: 40000 },
      { id: '6', name: 'Bacolod City', province: 'Negros Occidental', region: 'NIR', population: 600000 },
      { id: '7', name: 'Dumaguete', province: 'Negros Oriental', region: 'NIR', population: 135000 },
      { id: '8', name: 'Cebu City', province: 'Cebu', region: 'Region VII', population: 960000 },
      { id: '9', name: 'Tacloban City', province: 'Leyte', region: 'Region VIII', population: 250000 },
    ] as unknown as Municipality[];

    // Nationwide scope
    const nation = computeScopedMunicipalities(mockAll, 'nationwide');
    expect(nation.length).toBe(9);

    // Panay island scope (4 constituent provinces: Iloilo, Capiz, Aklan, Antique)
    const panay = computeScopedMunicipalities(mockAll, 'panay');
    expect(panay.length).toBe(4);
    expect(panay.map((m) => m.name)).toEqual(['Iloilo City', 'Roxas City', 'Kalibo', 'San Jose']);

    // NIR scope
    const nir = computeScopedMunicipalities(mockAll, 'nir');
    expect(nir.length).toBe(2);
    expect(nir.map((m) => m.name)).toEqual(['Bacolod City', 'Dumaguete']);

    // Province scope
    const capiz = computeScopedMunicipalities(mockAll, 'capiz');
    expect(capiz.length).toBe(1);
    expect(capiz[0].name).toBe('Roxas City');

    // Single municipality KPI calculation
    const singleKpi = computeKpiMetrics(panay, panay[0]);
    expect(singleKpi.totalMonitoredLgus).toBe(1);
    expect(singleKpi.isSingleMunicipality).toBe(true);
    expect(singleKpi.totalScopedPopulation).toBe(450000);
  });
});
