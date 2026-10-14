import {
  normalizeCoordinates,
  formatDisplayDate,
  getSeverityBadgeStyle,
  type UnifiedIncidentOption,
} from '../components/MapTelemetrySidebar';
import { resolveRegionFromCoordinates } from '../utils/regionLookup';
import { events as mockHistoricalEvents } from '../data/mockData';
import type { DisasterEvent, GdacsAlert } from '../types';

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
    if (typeof actual !== 'number' || actual <= expected) {
      throw new Error(`Expected ${actual} to be greater than ${expected}`);
    }
  },
  toBeGreaterThanOrEqual(expected: number) {
    if (typeof actual !== 'number' || actual < expected) {
      throw new Error(`Expected ${actual} to be >= ${expected}`);
    }
  },
  toBeLessThan(expected: number) {
    if (typeof actual !== 'number' || actual >= expected) {
      throw new Error(`Expected ${actual} to be less than ${expected}`);
    }
  },
  toBeNull() {
    if (actual !== null) {
      throw new Error(`Expected null, but got ${String(actual)}`);
    }
  },
  toBeTruthy() {
    if (!actual) {
      throw new Error(`Expected truthy value, but got ${String(actual)}`);
    }
  },
  toBeFalsy() {
    if (actual) {
      throw new Error(`Expected falsy value, but got ${String(actual)}`);
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
    console.error(`  ✗ ${name}: ${err.message}`);
    throw err;
  }
};

describe('1. Geographic & Coordinate Normalization', () => {
  it('correctly maps standard [lat, lng] coordinates', () => {
    const coords = normalizeCoordinates([11.2, 122.5]);
    expect(coords[0]).toBe(11.2);
    expect(coords[1]).toBe(122.5);
  });

  it('inverts inverted GeoJSON [lng, lat] where longitude >= 100', () => {
    const coords = normalizeCoordinates([122.5, 11.2]);
    expect(coords[0]).toBe(11.2);
    expect(coords[1]).toBe(122.5);
  });

  it('handles explicit latitude and longitude numbers', () => {
    const coords = normalizeCoordinates(null, 10.7, 122.9);
    expect(coords[0]).toBe(10.7);
    expect(coords[1]).toBe(122.9);
  });

  it('inverts explicit lat/lng if accidentally reversed', () => {
    const coords = normalizeCoordinates(null, 122.9, 10.7);
    expect(coords[0]).toBe(10.7);
    expect(coords[1]).toBe(122.9);
  });

  it('falls back to central Panay coordinates when missing', () => {
    const coords = normalizeCoordinates(null, null, null);
    expect(coords[0]).toBe(11.2);
    expect(coords[1]).toBe(122.5);
  });
});

describe('2. Date & Severity Badge Styling', () => {
  it('formats ISO and display dates cleanly', () => {
    expect(formatDisplayDate('2024-01-02T14:30:00Z')).toBe('2024-01-02');
    expect(formatDisplayDate('2025-11-03')).toBe('2025-11-03');
    expect(formatDisplayDate('')).toBe('Active Baseline');
  });

  it('resolves severity badge classes for Critical, High, and Moderate', () => {
    const crit = getSeverityBadgeStyle('Critical');
    expect(crit.dot).toBe('bg-rose-500');
    expect(crit.label).toBe('CRITICAL');

    const red = getSeverityBadgeStyle('RED');
    expect(red.dot).toBe('bg-rose-500');

    const high = getSeverityBadgeStyle('High');
    expect(high.dot).toBe('bg-amber-500');
    expect(high.label).toBe('HIGH');

    const orange = getSeverityBadgeStyle('ORANGE');
    expect(orange.dot).toBe('bg-amber-500');

    const mod = getSeverityBadgeStyle('Moderate');
    expect(mod.dot).toBe('bg-emerald-500');
    expect(mod.label).toBe('MODERATE');
  });
});

describe('3. Unified Incident Consolidation & Chronological Sorting', () => {
  const mockAlerts: GdacsAlert[] = [
    {
      event_id: '10001',
      id: 'gdacs-10001',
      name: 'Tropical Cyclone Auring',
      type: 'TC',
      alert_level: 'Red',
      date: '2026-10-14T08:00:00Z',
      description: 'Active Typhoon Category 3',
      coordinates: [12.5, 124.0],
    },
    {
      event_id: '10002',
      id: 'gdacs-10002',
      name: 'Mount Kanlaon Ash Eruption',
      type: 'VO',
      alert_level: 'Orange',
      date: '2026-06-03T12:00:00Z',
      description: 'Volcanic plume activity',
      coordinates: [10.41, 123.13],
    },
  ];

  it('consolidates historical disaster events and GDACS alerts into a unified list sorted newest first', () => {
    const historical: UnifiedIncidentOption[] = mockHistoricalEvents.map((e) => {
      const coords = normalizeCoordinates(e.coordinates, e.latitude, e.longitude);
      return {
        id: String(e.id || e.name),
        name: e.name,
        date: e.date || e.startDate || '2024-01-01',
        type: 'historical',
        severity: e.severity,
        category: e.category || 'Historical Event',
        coordinates: coords,
        regionKey: e.regionKey || resolveRegionFromCoordinates(coords[0], coords[1]),
        rawItem: e,
      };
    });

    const gdacs: UnifiedIncidentOption[] = mockAlerts.map((a) => {
      const coords = normalizeCoordinates(a.coordinates, a.latitude, a.longitude);
      return {
        id: String(a.id || a.event_id),
        name: a.name,
        date: a.date,
        type: 'gdacs',
        severity: a.alert_level || 'ORANGE',
        category: a.type || 'GDACS Alert',
        coordinates: coords,
        regionKey: a.regionKey || resolveRegionFromCoordinates(coords[0], coords[1]),
        rawItem: a,
      };
    });

    const unified = [...gdacs, ...historical].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    // Verify ordering: 2026 alerts and newest events should be at the top
    expect(unified.length).toBe(mockAlerts.length + mockHistoricalEvents.length);
    expect(unified[0].name).toBe('Tropical Cyclone Auring'); // 2026-10-14
    expect(unified[0].type).toBe('gdacs');
    expect(unified[1].name).toBe('Antique Coastal Flooding'); // 2026-08-21
    expect(unified[1].type).toBe('historical');
    expect(unified[2].name).toBe('Mount Kanlaon Ash Eruption'); // 2026-06-03
    expect(unified[2].type).toBe('gdacs');
  });

  it('resolves geographic scope and regionKey from incident coordinates', () => {
    // Panay Blackout 2024 coordinates [11.0, 122.5]
    const panayCoords = normalizeCoordinates([11.0, 122.5]);
    const panayRegion = resolveRegionFromCoordinates(panayCoords[0], panayCoords[1]);
    expect(panayRegion).toBe('panay');

    // Kanlaon Volcano coordinates [10.41, 123.13] (Negros)
    const negrosCoords = normalizeCoordinates([10.41, 123.13]);
    const negrosRegion = resolveRegionFromCoordinates(negrosCoords[0], negrosCoords[1]);
    expect(negrosRegion).toBeTruthy();

    // Mindanao South coordinates [6.1, 125.1]
    const mindanaoCoords = normalizeCoordinates([6.1, 125.1]);
    const mindanaoRegion = resolveRegionFromCoordinates(mindanaoCoords[0], mindanaoCoords[1]);
    expect(mindanaoRegion).toBe('mindanao_south');
  });
});
