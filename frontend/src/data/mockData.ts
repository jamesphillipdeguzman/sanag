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
    affectedPopulation: 1220000,
    description: 'Late-season typhoon causing gale-force wind damage and flash floods across coastal Antique and Aklan.',
  },
  {
    id: 'sts-trami-2024',
    name: 'Severe Tropical Storm Trami (Kristine)',
    date: '2024-10-22',
    startDate: '2024-10-22',
    endDate: '2024-11-22',
    severity: 'High',
    type: 'monsoon_flood',
    affectedPopulation: 1350000,
    description: 'Broad circulation severe tropical storm bringing unprecedented continuous precipitation and submerged transmission substations.',
  },
  {
    id: 'habagat-carina-2024',
    name: 'Southwest Monsoon / Gaemi Floods',
    date: '2024-07-24',
    startDate: '2024-07-24',
    endDate: '2024-08-24',
    severity: 'Moderate',
    type: 'monsoon_flood',
    affectedPopulation: 980000,
    description: 'Enhanced Southwest Monsoon combined with Typhoon Gaemi triggering massive urban and agricultural flooding across lowland Panay plains.',
  },
  {
    id: 'panay-blackout-2024',
    name: 'Panay Island Grid Collapse',
    date: '2024-01-02',
    startDate: '2024-01-02',
    endDate: '2024-02-01',
    severity: 'Severe',
    type: 'grid_failure',
    affectedPopulation: 4500000,
    description: 'Major transmission line trips and cascading plant shutdowns causing complete island-wide blackout across Panay and Guimaras.',
  },
  {
    id: 'sts-nalgae-2022',
    name: 'Severe Tropical Storm Nalgae (Paeng)',
    date: '2022-10-28',
    startDate: '2022-10-28',
    endDate: '2022-11-28',
    severity: 'High',
    type: 'monsoon_flood',
    affectedPopulation: 1580000,
    description: 'Severe Tropical Storm Nalgae brought immense rainbands causing widespread riverine flooding and bridge washouts across Western Visayas.',
  },
  {
    id: 'ts-megi-2022',
    name: 'Tropical Storm Megi (Agaton)',
    date: '2022-04-10',
    startDate: '2022-04-10',
    endDate: '2022-05-10',
    severity: 'High',
    type: 'monsoon_flood',
    affectedPopulation: 1120000,
    description: 'Stationary tropical storm inducing continuous heavy rains, catastrophic landslides, and severe lowland inundation across Capiz and Iloilo.',
  },
  {
    id: 'typhoon-rai-2021',
    name: 'Typhoon Rai (Odette)',
    date: '2021-12-16',
    startDate: '2021-12-16',
    endDate: '2022-01-16',
    severity: 'Severe',
    type: 'typhoon',
    affectedPopulation: 2450000,
    description: 'Super Typhoon Rai (Odette) devastated the Visayas corridor, inflicting major transmission line destruction and month-long restoration.',
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
  },
  {
    id: 'typhoon-haiyan-2013',
    name: 'Super Typhoon Haiyan (Yolanda)',
    date: '2013-11-08',
    startDate: '2013-11-08',
    endDate: '2013-12-08',
    severity: 'Severe',
    type: 'typhoon',
    affectedPopulation: 4200000,
    description: 'Catastrophic Category 5 super typhoon crossing the Visayas region with unprecedented storm surge and widespread grid destruction.',
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

export function getSeverityColor(severity: DisasterEvent['severity']): string {
  return severity === 'Severe' ? '#f43f5e' : severity === 'High' ? '#fbbf24' : '#599ffd';
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
    };
  });
}