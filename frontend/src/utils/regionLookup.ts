/**
 * Region Lookup & Spatial Chunk Registry for Project SANAG
 * Dynamically resolves Philippine geographical coordinates and bounding boxes
 * to regional boundary GeoJSON chunks to minimize mobile memory footprint.
 */

export interface RegionChunkMeta {
  key: string;
  label: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  geojsonPath: string;
  islandGroup: 'Panay' | 'Nationwide' | 'Luzon' | 'Visayas' | 'Mindanao';
  center: [number, number];
  zoom: number;
}

export interface RegionPreset {
  id: string;
  name: string;
  center: [number, number];
  zoom: number;
  islandGroup: 'Panay' | 'Nationwide' | 'Luzon' | 'Visayas' | 'Mindanao';
}

/**
 * Registry of nationwide multi-vertex administrative GeoJSON chunks.
 * Sorted with geographically smaller, specific bounding boxes first so point-in-bounds queries
 * resolve fine-grained metropolitan areas (e.g., NCR) before broad island group rectangles.
 */
export const REGIONAL_CHUNKS: RegionChunkMeta[] = [
  {
    key: 'ncr',
    label: 'NCR (Metro Manila)',
    minLat: 14.35,
    maxLat: 14.80,
    minLng: 120.90,
    maxLng: 121.15,
    geojsonPath: '/regions/ncr.geojson',
    islandGroup: 'Luzon',
    center: [14.5995, 121.0364],
    zoom: 11,
  },
  {
    key: 'iloilo',
    label: 'Iloilo Province',
    minLat: 10.4668,
    maxLat: 11.6388,
    minLng: 122.0122,
    maxLng: 123.3727,
    geojsonPath: '/regions/iloilo.geojson',
    islandGroup: 'Panay',
    center: [11.0528, 122.6925],
    zoom: 9,
  },
  {
    key: 'capiz',
    label: 'Capiz Province',
    minLat: 11.1335,
    maxLat: 11.6175,
    minLng: 122.1999,
    maxLng: 123.0976,
    geojsonPath: '/regions/capiz.geojson',
    islandGroup: 'Panay',
    center: [11.3755, 122.6487],
    zoom: 10,
  },
  {
    key: 'aklan',
    label: 'Aklan Province',
    minLat: 11.3129,
    maxLat: 11.9982,
    minLng: 121.8436,
    maxLng: 122.5768,
    geojsonPath: '/regions/aklan.geojson',
    islandGroup: 'Panay',
    center: [11.6555, 122.2102],
    zoom: 10,
  },
  {
    key: 'antique',
    label: 'Antique Province',
    minLat: 10.4064,
    maxLat: 12.2069,
    minLng: 121.2827,
    maxLng: 122.3237,
    geojsonPath: '/regions/antique.geojson',
    islandGroup: 'Panay',
    center: [11.3066, 121.8032],
    zoom: 9,
  },
  {
    key: 'panay',
    label: 'Panay Island (Western Visayas)',
    minLat: 10.30,
    maxLat: 12.15,
    minLng: 121.75,
    maxLng: 123.45,
    geojsonPath: '/regions/panay.geojson',
    islandGroup: 'Panay',
    center: [11.0000, 122.5000],
    zoom: 8,
  },
  {
    key: 'central_visayas',
    label: 'Central Visayas (Region VII - Cebu, Bohol)',
    minLat: 9.00,
    maxLat: 11.65,
    minLng: 122.55,
    maxLng: 124.75,
    geojsonPath: '/regions/central_visayas.geojson',
    islandGroup: 'Visayas',
    center: [10.3157, 123.8854],
    zoom: 9,
  },
  {
    key: 'cebu_bohol',
    label: 'Central Visayas (Cebu / Bohol)',
    minLat: 9.00,
    maxLat: 11.65,
    minLng: 122.55,
    maxLng: 124.75,
    geojsonPath: '/regions/central_visayas.geojson',
    islandGroup: 'Visayas',
    center: [10.1000, 123.9000],
    zoom: 9,
  },
  {
    key: 'car',
    label: 'CAR (Cordillera Administrative Region)',
    minLat: 16.15,
    maxLat: 18.60,
    minLng: 120.40,
    maxLng: 121.75,
    geojsonPath: '/regions/car.geojson',
    islandGroup: 'Luzon',
    center: [17.0754, 121.0028],
    zoom: 8,
  },
  {
    key: 'bicol',
    label: 'Bicol Region (Region V)',
    minLat: 11.65,
    maxLat: 14.55,
    minLng: 122.25,
    maxLng: 124.50,
    geojsonPath: '/regions/bicol.geojson',
    islandGroup: 'Luzon',
    center: [13.4210, 123.4136],
    zoom: 8,
  },
  {
    key: 'central_luzon',
    label: 'Central Luzon (Region III)',
    minLat: 14.30,
    maxLat: 16.60,
    minLng: 119.70,
    maxLng: 122.35,
    geojsonPath: '/regions/central_luzon.geojson',
    islandGroup: 'Luzon',
    center: [15.4828, 120.7120],
    zoom: 8,
  },
  {
    key: 'ilocos_cagayan',
    label: 'Northern Luzon (Ilocos & Cagayan - Regions I & II)',
    minLat: 15.60,
    maxLat: 21.20,
    minLng: 119.70,
    maxLng: 122.60,
    geojsonPath: '/regions/ilocos_cagayan.geojson',
    islandGroup: 'Luzon',
    center: [17.2000, 121.1000],
    zoom: 7,
  },
  {
    key: 'calabarzon_mimaropa',
    label: 'Southern Tagalog & MIMAROPA (Regions IV-A & IV-B)',
    minLat: 7.50,
    maxLat: 15.30,
    minLng: 116.85,
    maxLng: 125.30,
    geojsonPath: '/regions/calabarzon_mimaropa.geojson',
    islandGroup: 'Luzon',
    center: [13.8000, 121.1000],
    zoom: 8,
  },
  {
    key: 'ncr_southern_tagalog',
    label: 'NCR & Southern Tagalog',
    minLat: 13.00,
    maxLat: 15.20,
    minLng: 120.50,
    maxLng: 122.50,
    geojsonPath: '/regions/calabarzon_mimaropa.geojson',
    islandGroup: 'Luzon',
    center: [14.2000, 121.2000],
    zoom: 9,
  },
  {
    key: 'panay_guimaras',
    label: 'Western Visayas (Panay & Negros)',
    minLat: 9.40,
    maxLat: 12.15,
    minLng: 121.25,
    maxLng: 123.60,
    geojsonPath: '/regions/panay_guimaras.geojson',
    islandGroup: 'Visayas',
    center: [10.8500, 122.7500],
    zoom: 8,
  },
  {
    key: 'eastern_visayas',
    label: 'Eastern Visayas (Region VIII - Leyte, Samar)',
    minLat: 9.85,
    maxLat: 12.80,
    minLng: 123.95,
    maxLng: 126.05,
    geojsonPath: '/regions/eastern_visayas.geojson',
    islandGroup: 'Visayas',
    center: [11.2443, 125.0039],
    zoom: 8,
  },
  {
    key: 'zamboanga_peninsula',
    label: 'Zamboanga Peninsula (Region IX)',
    minLat: 6.80,
    maxLat: 8.90,
    minLng: 121.85,
    maxLng: 123.75,
    geojsonPath: '/regions/zamboanga_peninsula.geojson',
    islandGroup: 'Mindanao',
    center: [7.8385, 122.7560],
    zoom: 8,
  },
  {
    key: 'northern_mindanao_caraga',
    label: 'Northern Mindanao & Caraga (Regions X & XIII)',
    minLat: 7.35,
    maxLat: 10.55,
    minLng: 123.50,
    maxLng: 126.55,
    geojsonPath: '/regions/northern_mindanao_caraga.geojson',
    islandGroup: 'Mindanao',
    center: [8.6500, 125.1000],
    zoom: 8,
  },
  {
    key: 'mindanao_south',
    label: 'South Mindanao (Davao & SOCCSKSARGEN / Sarangani)',
    minLat: 5.30,
    maxLat: 8.05,
    minLng: 124.00,
    maxLng: 126.65,
    geojsonPath: '/regions/mindanao_south.geojson',
    islandGroup: 'Mindanao',
    center: [6.5000, 125.4000],
    zoom: 8,
  },
  {
    key: 'barmm',
    label: 'Bangsamoro (BARMM)',
    minLat: 4.50,
    maxLat: 8.25,
    minLng: 118.00,
    maxLng: 125.10,
    geojsonPath: '/regions/barmm.geojson',
    islandGroup: 'Mindanao',
    center: [7.2047, 124.2384],
    zoom: 8,
  },
];

/**
 * Standard preset dictionary for quick camera jumps and selector bindings.
 */
export const REGION_PRESETS: Record<string, RegionPreset> = {
  panay: { id: 'panay', name: 'Panay Island (Default)', center: [11.0, 122.5], zoom: 8, islandGroup: 'Panay' },
  iloilo: { id: 'iloilo', name: 'Iloilo Province', center: [11.0528, 122.6925], zoom: 9, islandGroup: 'Panay' },
  capiz: { id: 'capiz', name: 'Capiz Province', center: [11.3755, 122.6487], zoom: 10, islandGroup: 'Panay' },
  aklan: { id: 'aklan', name: 'Aklan Province', center: [11.6555, 122.2102], zoom: 10, islandGroup: 'Panay' },
  antique: { id: 'antique', name: 'Antique Province', center: [11.3066, 121.8032], zoom: 9, islandGroup: 'Panay' },
  guimaras: { id: 'guimaras', name: 'Guimaras Province', center: [10.5925, 122.5900], zoom: 10, islandGroup: 'Panay' },
  cebu: { id: 'central_visayas', name: 'Cebu Province', center: [10.3157, 123.8854], zoom: 9, islandGroup: 'Visayas' },
  bohol: { id: 'central_visayas', name: 'Bohol Province', center: [9.8500, 124.1435], zoom: 10, islandGroup: 'Visayas' },
  davao: { id: 'mindanao_south', name: 'Davao Region', center: [7.1907, 125.4504], zoom: 9, islandGroup: 'Mindanao' },
  philippines: { id: 'philippines', name: 'Nationwide (Philippines)', center: [12.8797, 121.7740], zoom: 6, islandGroup: 'Nationwide' },
  ncr: { id: 'ncr', name: 'NCR (Metro Manila)', center: [14.5995, 121.0364], zoom: 11, islandGroup: 'Luzon' },
  car: { id: 'car', name: 'CAR (Cordillera)', center: [17.0754, 121.0028], zoom: 8, islandGroup: 'Luzon' },
  ilocos_cagayan: { id: 'ilocos_cagayan', name: 'Northern Luzon (Ilocos & Cagayan)', center: [17.2000, 121.1000], zoom: 7, islandGroup: 'Luzon' },
  r1: { id: 'ilocos_cagayan', name: 'Region I (Ilocos Region)', center: [16.8906, 120.5739], zoom: 8, islandGroup: 'Luzon' },
  r2: { id: 'ilocos_cagayan', name: 'Region II (Cagayan Valley)', center: [17.6132, 121.7270], zoom: 8, islandGroup: 'Luzon' },
  central_luzon: { id: 'central_luzon', name: 'Region III (Central Luzon)', center: [15.4828, 120.7120], zoom: 8, islandGroup: 'Luzon' },
  r3: { id: 'central_luzon', name: 'Region III (Central Luzon)', center: [15.4828, 120.7120], zoom: 8, islandGroup: 'Luzon' },
  calabarzon_mimaropa: { id: 'calabarzon_mimaropa', name: 'Southern Tagalog & MIMAROPA', center: [13.8000, 121.1000], zoom: 8, islandGroup: 'Luzon' },
  ncr_southern_tagalog: { id: 'calabarzon_mimaropa', name: 'NCR & Southern Tagalog', center: [14.2000, 121.2000], zoom: 9, islandGroup: 'Luzon' },
  r4a: { id: 'calabarzon_mimaropa', name: 'Region IV-A (CALABARZON)', center: [14.1008, 121.0794], zoom: 8, islandGroup: 'Luzon' },
  r4b: { id: 'calabarzon_mimaropa', name: 'MIMAROPA (Region IV-B)', center: [12.0000, 120.0000], zoom: 7, islandGroup: 'Luzon' },
  bicol: { id: 'bicol', name: 'Region V (Bicol Region)', center: [13.4210, 123.4136], zoom: 8, islandGroup: 'Luzon' },
  r5: { id: 'bicol', name: 'Region V (Bicol Region)', center: [13.4210, 123.4136], zoom: 8, islandGroup: 'Luzon' },
  panay_guimaras: { id: 'panay_guimaras', name: 'Western Visayas (Panay & Negros)', center: [10.8500, 122.7500], zoom: 8, islandGroup: 'Visayas' },
  r6_negros: { id: 'panay_guimaras', name: 'Region VI (Negros Occidental)', center: [10.6765, 122.9509], zoom: 8, islandGroup: 'Visayas' },
  central_visayas: { id: 'central_visayas', name: 'Central Visayas (Cebu / Bohol)', center: [10.1000, 123.9000], zoom: 9, islandGroup: 'Visayas' },
  cebu_bohol: { id: 'central_visayas', name: 'Central Visayas (Cebu / Bohol)', center: [10.1000, 123.9000], zoom: 9, islandGroup: 'Visayas' },
  r7: { id: 'central_visayas', name: 'Region VII (Central Visayas / Cebu)', center: [10.3157, 123.8854], zoom: 9, islandGroup: 'Visayas' },
  eastern_visayas: { id: 'eastern_visayas', name: 'Region VIII (Eastern Visayas / Leyte)', center: [11.2443, 125.0039], zoom: 8, islandGroup: 'Visayas' },
  r8: { id: 'eastern_visayas', name: 'Region VIII (Eastern Visayas / Leyte)', center: [11.2443, 125.0039], zoom: 8, islandGroup: 'Visayas' },
  zamboanga_peninsula: { id: 'zamboanga_peninsula', name: 'Region IX (Zamboanga Peninsula)', center: [7.8385, 122.7560], zoom: 8, islandGroup: 'Mindanao' },
  r9: { id: 'zamboanga_peninsula', name: 'Region IX (Zamboanga Peninsula)', center: [7.8385, 122.7560], zoom: 8, islandGroup: 'Mindanao' },
  northern_mindanao_caraga: { id: 'northern_mindanao_caraga', name: 'Northern Mindanao & Caraga', center: [8.6500, 125.1000], zoom: 8, islandGroup: 'Mindanao' },
  r10: { id: 'northern_mindanao_caraga', name: 'Region X (Northern Mindanao)', center: [8.4542, 124.6319], zoom: 8, islandGroup: 'Mindanao' },
  r13: { id: 'northern_mindanao_caraga', name: 'Region XIII (Caraga)', center: [8.9511, 125.5288], zoom: 8, islandGroup: 'Mindanao' },
  mindanao_south: { id: 'mindanao_south', name: 'South Mindanao (Davao / Sarangani)', center: [6.5000, 125.4000], zoom: 8, islandGroup: 'Mindanao' },
  r11: { id: 'mindanao_south', name: 'Region XI (Davao Region)', center: [7.1907, 125.4504], zoom: 8, islandGroup: 'Mindanao' },
  r12: { id: 'mindanao_south', name: 'Region XII (SOCCSKSARGEN)', center: [6.5064, 124.8480], zoom: 8, islandGroup: 'Mindanao' },
  barmm: { id: 'barmm', name: 'BARMM (Bangsamoro)', center: [7.2047, 124.2384], zoom: 8, islandGroup: 'Mindanao' },
};

/**
 * Coordinate-to-region resolver: maps point latitude/longitude to the most fitting regional chunk.
 * Evaluates candidates by bounding box area ascending, so tight urban zones (e.g. NCR) match ahead of broader macro-regions.
 */
export function findRegionByCoordinates(lat: number, lng: number): RegionChunkMeta | null {
  const matches = REGIONAL_CHUNKS.filter(
    (r) => lat >= r.minLat && lat <= r.maxLat && lng >= r.minLng && lng <= r.maxLng
  );

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    // Return the chunk with the smallest bounding box area (highest spatial specificity)
    return matches.sort((a, b) => {
      const areaA = (a.maxLat - a.minLat) * (a.maxLng - a.minLng);
      const areaB = (b.maxLat - b.minLat) * (b.maxLng - b.minLng);
      return areaA - areaB;
    })[0];
  }

  // Fallback for near-offshore points (e.g. earthquake epicenters within ~1.2 degrees of coast)
  let bestNear: RegionChunkMeta | null = null;
  let minDistanceSq = 1.44; // within ~1.2 degrees (~130km)
  for (const r of REGIONAL_CHUNKS) {
    const cLat = (r.minLat + r.maxLat) / 2;
    const cLng = (r.minLng + r.maxLng) / 2;
    const dSq = (lat - cLat) ** 2 + (lng - cLng) ** 2;
    if (dSq < minDistanceSq) {
      minDistanceSq = dSq;
      bestNear = r;
    }
  }

  return bestNear;
}

/**
 * Checks if a bounding box intersects a regional chunk
 */
export function findRegionByBounds(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): RegionChunkMeta | null {
  return (
    REGIONAL_CHUNKS.find(
      (r) =>
        r.minLat <= bounds.maxLat &&
        r.maxLat >= bounds.minLat &&
        r.minLng <= bounds.maxLng &&
        r.maxLng >= bounds.minLng
    ) || null
  );
}

/**
 * Exports all registered Philippine regional chunks for dropdowns, selectors, and settings modals.
 */
export function getAllRegisteredRegions(): RegionChunkMeta[] {
  // Deduplicate keys that share identical targets while preserving canonical display list
  const seen = new Set<string>();
  const list: RegionChunkMeta[] = [];
  for (const chunk of REGIONAL_CHUNKS) {
    if (!seen.has(chunk.geojsonPath)) {
      seen.add(chunk.geojsonPath);
      list.push(chunk);
    }
  }
  return list;
}
