import type { DisasterEvent, Municipality, RecoveryStatus } from '../types';

export const PRIMARY_EVENT_ID = 'panay-blackout-2024';

export const events: DisasterEvent[] = [
  {
    id: 'panay-blackout-2024',
    name: 'Panay Island Grid Collapse',
    date: '2024-01-02',
    endDate: '2024-02-02',
    severity: 'Severe',
    type: 'blackout',
    affectedPopulation: 4500000,
    description: 'Major transmission line trips causing complete island-wide blackout across Panay and Guimaras.',
  },
  {
    id: 'haiyan',
    name: 'Typhoon Haiyan Aftermath',
    date: '2013-11-08',
    endDate: '2013-12-08',
    severity: 'Severe',
    type: 'typhoon',
    affectedPopulation: 420000,
    description: 'A regional power disruption affecting coastal and inland communities across Panay Island.',
  },
  {
    id: 'odette',
    name: 'Typhoon Odette',
    date: '2021-12-16',
    endDate: '2022-01-16',
    severity: 'High',
    type: 'typhoon',
    affectedPopulation: 185000,
    description: 'Heavy winds and flooding caused widespread outages and delayed restoration work.',
  },
  {
    id: 'monsoon',
    name: 'Southwest Monsoon Floods',
    date: '2024-08-02',
    endDate: '2024-09-02',
    severity: 'Moderate',
    type: 'flood',
    affectedPopulation: 94000,
    description: 'Flooding interrupted distribution lines in low-lying municipalities.',
  },
  {
    id: 'panay-earthquake-1990',
    name: '1990 Panay Earthquake',
    date: '1990-06-14',
    endDate: '1990-07-14',
    severity: 'Severe',
    type: 'earthquake',
    affectedPopulation: 750000,
    description: 'Magnitude 7.1 earthquake epicentered in Culasi, Antique causing extensive regional infrastructure destruction.',
  },
  {
    id: 'typhoon-tino',
    name: 'Typhoon Tino Western Visayas Impact',
    date: '2025-11-03',
    endDate: '2025-12-03',
    severity: 'High',
    type: 'typhoon',
    affectedPopulation: 310000,
    description: 'Severe wind gusts and heavy flooding causing regional power disruptions across Panay LGUs.',
  },
  {
    id: 'gdacs-1568718',
    name: 'Earthquake in Western Visayas (Panay Fault)',
    date: '2024-01-02',
    endDate: '2024-02-02',
    severity: 'High',
    type: 'earthquake',
    affectedPopulation: 520000,
    description: 'Moderate shallow tectonic earthquake along the Western Panay Fault line affecting Iloilo and Antique.',
  },
];

export function getRecoveryColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#599ffd';
  if (score >= 40) return '#fbbf24';
  return '#f43f5e';
}

export function getRecoveryStatusColor(status: RecoveryStatus): string {
  return getRecoveryColor(status === 'restored' ? 95 : status === 'recovering' ? 70 : status === 'warning' ? 50 : 20);
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