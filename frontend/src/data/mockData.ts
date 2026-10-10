import type { DisasterEvent, Municipality, RecoveryStatus } from '../types';

export const PRIMARY_EVENT_ID = 'typhoon-kalmaegi-2025';

export const events: DisasterEvent[] = [
  {
    id: 'typhoon-kalmaegi-2025',
    name: 'Typhoon Kalmaegi (Tino)',
    date: '2025-11-03',
    startDate: '2025-11-03',
    endDate: '2025-12-03',
    severity: 'High',
    type: 'typhoon',
    category: 'Typhoon',
    event_type: 'Tropical Cyclone',
    disaster_category: 'Category 3 Landfall',
    root_cause_summary: 'High sustained winds exceeding 185 km/h, widespread fallen distribution poles, localized flooding of low-lying substations, and severe line-clearing obstructions across coastal and northern corridors.',
    infrastructure_impact: 'Physical distribution grid damage requiring heavy on-the-ground hardware replacement; recovery follows a gradual, step-wise restoration curve over multiple observation cycles.',
    affectedPopulation: 1220000,
    description: 'Late-season typhoon causing gale-force wind damage and flash floods across coastal Antique and Aklan.',
    latitude: 11.5000,
    longitude: 122.3000,
    coordinates: [11.5000, 122.3000],
    viirs_data_available: true,
  },
  {
    id: 'sts-trami-2024',
    name: 'Severe Tropical Storm Trami (Kristine)',
    date: '2024-10-22',
    startDate: '2024-10-22',
    endDate: '2024-11-22',
    severity: 'High',
    type: 'monsoon_flood',
    category: 'Flood',
    event_type: 'Severe Tropical Storm',
    disaster_category: 'High-Volume Monsoon Inundation',
    root_cause_summary: 'Unprecedented continuous precipitation, inundated low-lying substations, and widespread transmission right-of-way landslides across river basins.',
    infrastructure_impact: 'Substation water-logging and precautionary sectional feeder isolations; rapid recovery as floodwaters recede followed by equipment drying.',
    affectedPopulation: 1350000,
    description: 'Broad circulation severe tropical storm bringing unprecedented continuous precipitation and submerged transmission substations.',
    latitude: 11.2000,
    longitude: 122.6000,
    coordinates: [11.2000, 122.6000],
    viirs_data_available: true,
  },
  {
    id: 'habagat-carina-2024',
    name: 'Southwest Monsoon / Gaemi Floods',
    date: '2024-07-24',
    startDate: '2024-07-24',
    endDate: '2024-08-24',
    severity: 'Moderate',
    type: 'monsoon_flood',
    category: 'Flood',
    event_type: 'Southwest Monsoon / Tropical Cyclone',
    disaster_category: 'Monsoon Flooding & Landslide',
    root_cause_summary: 'Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.',
    infrastructure_impact: 'Localized feeder trips and pole destabilization in saturated soils; moderate recovery timeline.',
    affectedPopulation: 980000,
    description: 'Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.',
    latitude: 10.9000,
    longitude: 122.4000,
    coordinates: [10.9000, 122.4000],
    viirs_data_available: true,
  },
  {
    id: 'panay-blackout-2024',
    name: 'Panay Island Grid Collapse',
    date: '2024-01-02',
    startDate: '2024-01-02',
    endDate: '2024-02-01',
    severity: 'Severe',
    type: 'grid_failure',
    category: 'Power Disruption',
    event_type: 'Grid Disturbance / Frequency Trip',
    disaster_category: 'Cascading System Separation',
    root_cause_summary: 'Unplanned, rapid tripping of multiple base-load generation units across Panay (including PEDC and PCPC units) leading to island-wide under-frequency cascade tripping and complete separation from the Negros-Panay submarine interconnect.',
    infrastructure_impact: 'Zero structural physical damage to distribution poles or substations; rapid, steep V-shaped recovery curve observed as plants resynchronize and black-start protocols activate.',
    affectedPopulation: 4500000,
    description: 'Major transmission line trips and cascading plant shutdowns causing complete island-wide blackout across Panay and Guimaras.',
    latitude: 11.0000,
    longitude: 122.5000,
    coordinates: [11.0000, 122.5000],
    viirs_data_available: true,
  },
  {
    id: 'sts-nalgae-2022',
    name: 'Severe Tropical Storm Nalgae (Paeng)',
    date: '2022-10-28',
    startDate: '2022-10-28',
    endDate: '2022-11-28',
    severity: 'High',
    type: 'monsoon_flood',
    category: 'Flood',
    event_type: 'Severe Tropical Storm',
    disaster_category: 'Flash Flooding & Mudslides',
    root_cause_summary: 'Stationary rainbands causing riverine surges, washed out bridge distribution conduits, and mudslide damage to transmission towers.',
    infrastructure_impact: 'Physical feeder breaks and severed bridge crossings requiring line re-routing and bypass installation.',
    affectedPopulation: 1580000,
    description: 'Severe Tropical Storm Nalgae brought immense rainbands causing widespread riverine flooding and bridge washouts across Western Visayas.',
    latitude: 11.1500,
    longitude: 122.5500,
    coordinates: [11.1500, 122.5500],
    viirs_data_available: true,
  },
  {
    id: 'ts-megi-2022',
    name: 'Tropical Storm Megi (Agaton)',
    date: '2022-04-10',
    startDate: '2022-04-10',
    endDate: '2022-05-10',
    severity: 'High',
    type: 'monsoon_flood',
    category: 'Flood',
    event_type: 'Tropical Storm',
    disaster_category: 'Prolonged Lowland Inundation',
    root_cause_summary: 'Slow-moving tropical depression causing persistent torrential rain, flash landslides, and submerged municipal load centers across Capiz.',
    infrastructure_impact: 'Waterlogged pad-mounted distribution transformers and mud deposit clearance across rural distribution lines.',
    affectedPopulation: 1120000,
    description: 'Stationary tropical storm inducing continuous heavy rains, catastrophic landslides, and severe lowland inundation across Capiz and Iloilo.',
    latitude: 11.3500,
    longitude: 122.7500,
    coordinates: [11.3500, 122.7500],
    viirs_data_available: true,
  },
  {
    id: 'typhoon-rai-2021',
    name: 'Typhoon Rai (Odette)',
    date: '2021-12-16',
    startDate: '2021-12-16',
    endDate: '2022-01-16',
    severity: 'Severe',
    type: 'typhoon',
    category: 'Typhoon',
    event_type: 'Super Typhoon',
    disaster_category: 'Category 5 Landfall',
    root_cause_summary: 'Catastrophic transmission tower toppling, severed high-voltage backbone interconnects, and total regional blackout footprint extending across Visayan provinces.',
    infrastructure_impact: 'Long-term grid reconstruction requiring emergency temporary bypass towers; persistent, weeks-long multi-LGU critical deficit.',
    affectedPopulation: 2450000,
    description: 'Super Typhoon Rai (Odette) devastated the Visayas corridor, inflicting major transmission line destruction and month-long restoration.',
    latitude: 10.8000,
    longitude: 123.0000,
    coordinates: [10.8000, 123.0000],
    viirs_data_available: true,
  },
  {
    id: 'typhoon-molave-2020',
    name: 'Typhoon Molave (Quinta)',
    date: '2020-10-25',
    startDate: '2020-10-25',
    endDate: '2020-11-25',
    severity: 'Moderate',
    type: 'typhoon',
    affectedPopulation: 890000,
    description: 'Fast-moving typhoon triggering coastal storm surges, widespread agricultural flooding, and localized power disruptions.',
    latitude: 11.4000,
    longitude: 122.8000,
    coordinates: [11.4000, 122.8000],
    viirs_data_available: true,
  },
  {
    id: 'typhoon-phanfone-2019',
    name: 'Typhoon Phanfone (Ursula)',
    date: '2019-12-25',
    startDate: '2019-12-25',
    endDate: '2020-01-25',
    severity: 'High',
    type: 'typhoon',
    affectedPopulation: 1680000,
    description: 'Holiday typhoon causing widespread destructive winds, power pole collapses, and prolonged blackouts across Northern Panay.',
    latitude: 11.6000,
    longitude: 122.4000,
    coordinates: [11.6000, 122.4000],
    viirs_data_available: true,
  },
  {
    id: 'typhoon-hagupit-2014',
    name: 'Typhoon Hagupit (Ruby)',
    date: '2014-12-06',
    startDate: '2014-12-06',
    endDate: '2015-01-05',
    severity: 'High',
    type: 'typhoon',
    affectedPopulation: 1450000,
    description: 'Powerful typhoon bringing torrential rainfall, high winds, and severe power outages across Panay and Eastern Visayas.',
    latitude: 11.7000,
    longitude: 123.1000,
    coordinates: [11.7000, 123.1000],
    viirs_data_available: true,
  },
  {
    id: 'typhoon-haiyan-2013',
    name: 'Super Typhoon Haiyan (Yolanda)',
    date: '2013-11-08',
    startDate: '2013-11-08',
    endDate: '2013-12-08',
    severity: 'Severe',
    type: 'typhoon',
    category: 'Typhoon',
    latitude: 11.1000,
    longitude: 125.3000,
    coordinates: [11.1000, 125.3000],
    affectedPopulation: 4200000,
    description: 'Catastrophic Category 5 super typhoon crossing the Visayas region with unprecedented storm surge and widespread grid destruction.',
    viirs_data_available: true,
  },
];

export function getRecoveryColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

export function getRecoveryStatusColor(status: RecoveryStatus): string {
  return getRecoveryColor(status === 'restored' ? 95 : status === 'recovering' || status === 'warning' ? 75 : 30);
}

export function getSeverityColor(severity?: string): string {
  const norm = (severity || '').toLowerCase();
  if (norm === 'critical' || norm === 'severe' || norm === 'red') return '#f43f5e';
  if (norm === 'high' || norm === 'orange') return '#fbbf24';
  if (norm === 'moderate' || norm === 'medium' || norm === 'blue' || norm === 'sky') return '#38bdf8';
  if (norm === 'low' || norm === 'green') return '#10b981';
  return '#38bdf8';
}

export { formatAffectedPopulation, formatAffectedCompact } from '../utils/formatters';

export function generateRecoveryCurve(baseline: number, startDay: number, days: number, rate: number) {
  return Array.from({ length: days }, (_, index) => {
    const day = index + startDay;
    const progress = Math.min(1, index / (days - 1));
    const recoveryScore = Math.min(100, Math.round(35 + progress * 55 + (baseline % 9) + Math.sin(day / 3) * 2));
    return { day, recoveryScore };
  });
}

export function createMunicipalities(features: GeoJSON.Feature[]): Municipality[] {
  return features.map((feature, index) => {
    const properties = feature.properties ?? {};
    const recoveryScore = 100;
    const status: RecoveryStatus = 'restored';
    const area = Number(properties.AREA_SQKM ?? 50);
    const id = String(properties.ADM3_PCODE ?? properties.psgc_code ?? properties.ADM2_PCODE ?? index);
    const name = String(properties.ADM3_EN ?? properties.ADM2_EN ?? properties.ADM1_EN ?? 'Unnamed municipality');
    const province = String(properties.ADM2_EN ?? properties.province ?? 'Panay');
    const region = properties.ADM1_EN ?? properties.region_name ?? (['Iloilo', 'Capiz', 'Aklan', 'Antique'].includes(province) ? 'Region VI (Western Visayas)' : undefined);
    const pop = properties.population ? Number(properties.population) : Math.round(area * 860);

    let lat: number | undefined;
    let lng: number | undefined;
    const geom: any = feature.geometry;
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
        lat = Number((totalLat / count).toFixed(4));
        lng = Number((totalLng / count).toFixed(4));
      }
    }

    return {
      id,
      name,
      province,
      region,
      pcode: properties.ADM3_PCODE ? String(properties.ADM3_PCODE) : undefined,
      psgc: properties.psgc_code ? String(properties.psgc_code) : undefined,
      recoveryScore,
      status,
      population: pop,
      daysSinceEvent: 14,
      baselineRadiance: 8 + (index % 7),
      currentRadiance: 4 + (recoveryScore / 100) * 8,
      estimatedDaysToRecover: recoveryScore >= 90 ? 0 : Math.max(1, Math.round((100 - recoveryScore) / 8)),
      area,
      coordinates: lat != null && lng != null ? [lat, lng] : undefined,
      latitude: lat,
      longitude: lng,
    };
  });
}