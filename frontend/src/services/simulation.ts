/**
 * SANAG Disaster Simulation Service
 * 
 * Provides dynamic distance-decay post-event nocturnal radiance deficit
 * simulation for multi-regional & nationwide hazard events (e.g. Typhoon Haiyan,
 * GDACS real-time alerts, etc.) when explicit database observations are absent.
 */

import type { Municipality, DisasterEvent, GdacsAlert } from '@/types';

export interface SimulationRecord {
  pre_radiance: number;
  post_radiance: number;
  recovery_ratio: number; // 0.0 to 1.0 (e.g. 0.15 = 15% radiance)
  status: 'critical' | 'recovering' | 'warning' | 'restored';
  distance_km: number;
  event_id?: string;
  observation_date?: string;
}

export type ActiveSimulationMap = Record<string, SimulationRecord>;

/**
 * Calculates great-circle distance between two points on the Earth (Haversine formula).
 * Returns distance in kilometers.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Mean Earth radius in km
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
 * Computes simulated post-radiance recovery ratio and status based on distance
 * from event epicenter (distance-decay model):
 * 
 * - d < 45 km (Ground zero: Tacloban, Guiuan, Palo, Basey):
 *   5% - 25% radiance (Critical Deficit - Red #ef4444)
 * - 45 km <= d < 90 km (Ormoc, Carigara, Borongan):
 *   35% - 55% radiance (Critical Deficit - Red #ef4444)
 * - 90 km <= d < 150 km (North Cebu, Biliran, Southern Leyte):
 *   60% - 85% radiance (Active Restoration - Amber #f59e0b)
 * - d >= 150 km:
 *   >= 90% (Near-Full / Normal - Green #10b981)
 */
export function computeDistanceDecayRatio(distanceKm: number): {
  recovery_ratio: number;
  status: 'critical' | 'recovering' | 'warning' | 'restored';
} {
  if (distanceKm < 45) {
    // Linear gradient 0.05 (5%) at 0 km to 0.25 (25%) at 45 km
    const frac = Math.max(0, Math.min(1, distanceKm / 45));
    const ratio = 0.05 + 0.20 * frac;
    return {
      recovery_ratio: Number(ratio.toFixed(4)),
      status: 'critical',
    };
  }

  if (distanceKm < 90) {
    // Linear gradient 0.35 (35%) at 45 km to 0.55 (55%) at 90 km
    const frac = Math.max(0, Math.min(1, (distanceKm - 45) / 45));
    const ratio = 0.35 + 0.20 * frac;
    return {
      recovery_ratio: Number(ratio.toFixed(4)),
      status: 'critical',
    };
  }

  if (distanceKm < 150) {
    // Linear gradient 0.60 (60%) at 90 km to 0.85 (85%) at 150 km
    const frac = Math.max(0, Math.min(1, (distanceKm - 90) / 60));
    const ratio = 0.60 + 0.25 * frac;
    return {
      recovery_ratio: Number(ratio.toFixed(4)),
      status: 'warning',
    };
  }

  // d >= 150 km: 90% up to 100%
  const frac = Math.max(0, Math.min(1, (distanceKm - 150) / 100));
  const ratio = Math.min(1.0, 0.90 + 0.10 * frac);
  return {
    recovery_ratio: Number(ratio.toFixed(4)),
    status: 'restored',
  };
}

/**
 * Extracts centroid coordinates [lat, lng] from an administrative feature or municipality.
 */
export function extractCentroid(
  item: any,
  centroidsMap?: Map<string, [number, number]> | null
): [number, number] | null {
  if (!item) return null;

  // 1. Direct centroid map lookup
  const pcode = item.properties?.ADM3_PCODE || item.properties?.psgc_code || item.properties?.GID_2 || item.pcode || item.id;
  if (pcode && centroidsMap?.has(pcode)) {
    return centroidsMap.get(pcode)!;
  }
  if (item.id && centroidsMap?.has(item.id)) {
    return centroidsMap.get(item.id)!;
  }

  // 2. Municipality object coordinates
  if (Array.isArray(item.coordinates) && item.coordinates.length === 2) {
    return [item.coordinates[0], item.coordinates[1]];
  }
  if (item.latitude != null && item.longitude != null) {
    return [item.latitude, item.longitude];
  }

  // 3. GeoJSON Feature geometry calculation
  const geom = item.geometry || item;
  if (geom && geom.coordinates) {
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;

    const traverse = (coords: any) => {
      if (!Array.isArray(coords)) return;
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        totalLng += coords[0];
        totalLat += coords[1];
        count += 1;
      } else {
        coords.forEach(traverse);
      }
    };

    traverse(geom.coordinates);
    if (count > 0) {
      return [totalLat / count, totalLng / count];
    }
  }

  return null;
}

/**
 * Checks if the mounted municipalities have explicit database radiance records
 * for the event. If missing or incomplete, dynamically computes synthetic
 * post-radiance scores based on proximity to the event coordinates.
 */
export function computeDistanceDecaySimulation({
  event,
  municipalities,
  features,
  centroidsMap,
  explicitRecords = [],
}: {
  event: DisasterEvent | GdacsAlert | null | undefined;
  municipalities?: Municipality[] | null;
  features?: GeoJSON.Feature[] | null;
  centroidsMap?: Map<string, [number, number]> | null;
  explicitRecords?: any[];
}): ActiveSimulationMap {
  const simulationMap: ActiveSimulationMap = {};
  if (!event) return simulationMap;

  // Determine event coordinates
  const lat = (event as any).latitude ?? (event as any).coordinates?.[0];
  const lng = (event as any).longitude ?? (event as any).coordinates?.[1];

  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) {
    return simulationMap;
  }

  // Index explicit records by pcode and normalized name
  const explicitByPcode = new Map<string, any>();
  const explicitByName = new Map<string, any>();
  if (Array.isArray(explicitRecords)) {
    explicitRecords.forEach((rec) => {
      if (rec.r_t == null) return;
      const pc = rec.pcode || rec.municipality_pcode;
      if (pc && pc !== 'UNKNOWN') {
        explicitByPcode.set(pc, rec);
      }
      if (rec.municipality_name) {
        explicitByName.set(rec.municipality_name.toLowerCase().trim(), rec);
      }
    });
  }

  // Helper to register a record under multiple aliases
  const registerSimulation = (
    keys: (string | null | undefined)[],
    record: SimulationRecord
  ) => {
    keys.forEach((key) => {
      if (key && typeof key === 'string' && key.trim()) {
        simulationMap[key] = record;
      }
    });
  };

  // Process GeoJSON Features (if provided from loaded regional chunk)
  if (features && features.length > 0) {
    features.forEach((feature) => {
      const props = feature.properties || {};
      const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE || '';
      const rawName = String(props.ADM3_EN || props.name || props.ADM2_EN || '');
      const normName = rawName.toLowerCase().trim();
      const id = String(pcode || normName);

      // Check explicit records first
      const explicit = (pcode ? explicitByPcode.get(pcode) : null) || (normName ? explicitByName.get(normName) : null);
      if (explicit && explicit.r_t != null) {
        const ratio = Number(explicit.r_t);
        const pre = Number(explicit.baseline_radiance ?? 15.0);
        const post = Number(explicit.daily_radiance ?? explicit.post_event_radiance ?? (pre * ratio));
        const status = ratio < 0.60 ? 'critical' : ratio < 0.90 ? 'warning' : 'restored';
        const simRecord: SimulationRecord = {
          pre_radiance: pre,
          post_radiance: post,
          recovery_ratio: ratio,
          status,
          distance_km: 0,
        };
        registerSimulation([pcode, id, normName, props.ADM3_PCODE, props.psgc_code, props.GID_2], simRecord);
        return;
      }

      // Proximity fallback
      const centroid = extractCentroid(feature, centroidsMap);
      const dist = centroid ? calculateHaversineDistance(centroid[0], centroid[1], lat, lng) : 999;
      const { recovery_ratio, status } = computeDistanceDecayRatio(dist);
      const pre_radiance = 15.0;
      const post_radiance = Number((pre_radiance * recovery_ratio).toFixed(2));

      const simRecord: SimulationRecord = {
        pre_radiance,
        post_radiance,
        recovery_ratio,
        status,
        distance_km: Number(dist.toFixed(1)),
      };
      registerSimulation([pcode, id, normName, props.ADM3_PCODE, props.psgc_code, props.GID_2], simRecord);
    });
  }

  // Process Municipality items
  if (municipalities && municipalities.length > 0) {
    municipalities.forEach((m) => {
      const pcode = m.pcode || m.id;
      const normName = (m.name || '').toLowerCase().trim();

      // Check explicit records first
      const explicit = (pcode ? explicitByPcode.get(pcode) : null) || (normName ? explicitByName.get(normName) : null);
      if (explicit && explicit.r_t != null) {
        const ratio = Number(explicit.r_t);
        const pre = Number(explicit.baseline_radiance ?? m.baselineRadiance ?? 15.0);
        const post = Number(explicit.daily_radiance ?? explicit.post_event_radiance ?? (pre * ratio));
        const status = ratio < 0.60 ? 'critical' : ratio < 0.90 ? 'warning' : 'restored';
        const simRecord: SimulationRecord = {
          pre_radiance: pre,
          post_radiance: post,
          recovery_ratio: ratio,
          status,
          distance_km: 0,
        };
        registerSimulation([pcode, m.id, normName, m.pcode, m.psgc], simRecord);
        return;
      }

      // Proximity fallback
      const centroid = extractCentroid(m, centroidsMap);
      const dist = centroid ? calculateHaversineDistance(centroid[0], centroid[1], lat, lng) : 999;
      const { recovery_ratio, status } = computeDistanceDecayRatio(dist);
      const pre_radiance = m.baselineRadiance && m.baselineRadiance > 0 ? m.baselineRadiance : 15.0;
      const post_radiance = Number((pre_radiance * recovery_ratio).toFixed(2));

      const simRecord: SimulationRecord = {
        pre_radiance,
        post_radiance,
        recovery_ratio,
        status,
        distance_km: Number(dist.toFixed(1)),
      };
      registerSimulation([pcode, m.id, normName, m.pcode, m.psgc], simRecord);
    });
  }

  return simulationMap;
}

/**
 * Canvas 2D Feature Color Binding
 * 
 * Determines standard polygon stroke/fill hex according to the user specification:
 * - < 0.60: Red #ef4444 (Critical Deficit)
 * - < 0.90: Amber #f59e0b (Active Restoration)
 * - >= 0.90: Green #10b981 (Near-Full / Normal Recovery)
 */
export const getFeatureColor = (
  feature: any,
  activeSimulationMap?: ActiveSimulationMap | null
): string => {
  const props = feature?.properties || feature || {};
  const pcode = props.ADM3_PCODE || props.psgc_code || props.GID_2 || props.ADM2_PCODE || props.pcode || props.id;
  const name = (props.ADM3_EN || props.name || '').toLowerCase().trim();

  const simData = activeSimulationMap
    ? (activeSimulationMap[pcode] || (props.id ? activeSimulationMap[props.id] : null) || (name ? activeSimulationMap[name] : null))
    : null;

  if (!simData) return '#10b981'; // default green
  if (simData.recovery_ratio < 0.60) return '#ef4444'; // Red: Critical
  if (simData.recovery_ratio < 0.90) return '#f59e0b'; // Amber: Active Restoration
  return '#10b981'; // Green: Near-Full Recovery
};
