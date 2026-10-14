/**
 * Transmission Substation & Telemetry Nodes Dataset
 * Ground-truth high-voltage transmission substation and grid telemetry nodes
 * operated across the Philippines by the National Grid Corporation of the Philippines (NGCP)
 * and connected distribution utilities (ILECO, CAPELCO, AKELCO, ANTECO, MERALCO, BATELEC, VECO, etc.).
 */

import rawSubstations from './philippinesSubstations.json';

export interface TransmissionStation {
  id: string;
  name: string;
  province: string;
  municipality: string;
  voltage?: string;
  voltageKv?: number | string;
  type?: 'substation' | 'switching_station' | 'telemetry_node' | string;
  status: 'active' | 'standby' | 'maintenance' | string;
  operator: string;
  operationalStatus: 'Energized' | 'Islanded' | 'Tripped' | 'Critical' | string;
  coverage: string[];
  coordinates: [number, number];
}

export const ALL_SUBSTATIONS: TransmissionStation[] = (rawSubstations as any[]).map((s) => ({
  ...s,
  voltage: s.voltage || (s.voltageKv ? `${s.voltageKv}kV` : '138kV'),
  voltageKv: s.voltageKv ?? 138,
  province: String(s.province).toLowerCase().trim(),
  municipality: s.municipality || '',
  coordinates: s.coordinates as [number, number],
  status: s.status || 'active',
  operationalStatus: s.operationalStatus || 'Energized',
  coverage: Array.isArray(s.coverage) ? s.coverage : [],
}));

export const PANAY_TRANSMISSION_STATIONS: TransmissionStation[] = ALL_SUBSTATIONS.filter((s) =>
  ['iloilo', 'capiz', 'aklan', 'antique'].includes(s.province.toLowerCase())
);

export const REGION_PROVINCE_MAP: Record<string, string[]> = {
  panay: ['iloilo', 'capiz', 'aklan', 'antique'],
  iloilo: ['iloilo'],
  capiz: ['capiz'],
  aklan: ['aklan'],
  antique: ['antique'],
  panay_guimaras: ['iloilo', 'capiz', 'aklan', 'antique', 'guimaras', 'negros occidental'],
  r6_negros: ['negros occidental', 'guimaras', 'iloilo'],
  guimaras: ['guimaras'],
  negros_occidental: ['negros occidental'],
  calabarzon: ['batangas', 'laguna', 'cavite', 'quezon'],
  r4a: ['batangas', 'laguna', 'cavite', 'quezon'],
  calabarzon_mimaropa: ['batangas', 'laguna', 'cavite', 'quezon'],
  batangas: ['batangas'],
  laguna: ['laguna'],
  cavite: ['cavite'],
  quezon: ['quezon'],
  ncr: ['metro manila'],
  ncr_southern_tagalog: ['metro manila', 'batangas', 'laguna', 'cavite', 'quezon'],
  central_visayas: ['cebu', 'bohol'],
  cebu_bohol: ['cebu', 'bohol'],
  r7: ['cebu', 'bohol'],
  cebu: ['cebu'],
  bohol: ['bohol'],
  eastern_visayas: ['leyte'],
  r8: ['leyte'],
  leyte: ['leyte'],
  philippines: [
    'iloilo',
    'capiz',
    'aklan',
    'antique',
    'guimaras',
    'negros occidental',
    'batangas',
    'laguna',
    'cavite',
    'quezon',
    'metro manila',
    'cebu',
    'bohol',
    'leyte',
  ],
  all: [
    'iloilo',
    'capiz',
    'aklan',
    'antique',
    'guimaras',
    'negros occidental',
    'batangas',
    'laguna',
    'cavite',
    'quezon',
    'metro manila',
    'cebu',
    'bohol',
    'leyte',
  ],
};

/**
 * Calculates Great-Circle Haversine distance in kilometers between two lat/lng pairs.
 */
export function computeDistanceKm(
  coord1?: [number, number] | null,
  coord2?: [number, number] | null
): number {
  if (!coord1 || !coord2) return 999999;
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a normalized province key into formal title casing for UI display.
 */
export function formatProvinceDisplayName(prov: string): string {
  if (!prov) return '';
  const lower = prov.toLowerCase().trim();
  if (lower === 'ncr' || lower === 'metro manila') return 'Metro Manila';
  return prov
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export interface ProvinceStationGroup {
  province: string;
  count: number;
  active_count: number;
  stations: TransmissionStation[];
}

/**
 * Groups transmission stations by province, preserving canonical Panay sequence when Panay-scoped,
 * or dynamically ordering provinces for nationwide scopes.
 */
export function getStationsByProvince(
  stations: TransmissionStation[] = ALL_SUBSTATIONS
): ProvinceStationGroup[] {
  const groups: Record<string, TransmissionStation[]> = {};
  for (const station of stations) {
    const provKey = (station.province || 'other').toLowerCase().trim();
    if (!groups[provKey]) {
      groups[provKey] = [];
    }
    groups[provKey].push(station);
  }

  const panayOrder = ['iloilo', 'capiz', 'aklan', 'antique'];
  const keys = Object.keys(groups);
  const isOnlyPanay = keys.length > 0 && keys.every((k) => panayOrder.includes(k));

  if (isOnlyPanay) {
    return panayOrder
      .filter((k) => groups[k] && groups[k].length > 0)
      .map((k) => {
        const provStations = groups[k];
        return {
          province: formatProvinceDisplayName(k),
          count: provStations.length,
          active_count: provStations.filter((s) => s.status === 'active').length,
          stations: provStations,
        };
      });
  }

  return keys.map((k) => {
    const provStations = groups[k];
    return {
      province: formatProvinceDisplayName(k),
      count: provStations.length,
      active_count: provStations.filter((s) => s.status === 'active').length,
      stations: provStations,
    };
  });
}

/**
 * Calculates active transmission stations count dynamically from any collection.
 */
export function getActiveStationsCount(
  stations: TransmissionStation[] = ALL_SUBSTATIONS
): number {
  return stations.filter((s) => s.status === 'active').length;
}
