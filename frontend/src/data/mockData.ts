type RecoveryStatus = 'restored' | 'recovering' | 'warning' | 'critical';

type DisasterEvent = {
  id: string;
  name: string;
  date: string;
  endDate: string;
  severity: 'Severe' | 'High' | 'Moderate';
  type: string;
  affectedPopulation: number;
  description: string;
};

type Municipality = {
  id: string;
  name: string;
  province: string;
  recoveryScore: number;
  status: RecoveryStatus;
  population: number;
  daysSinceEvent: number;
  baselineRadiance: number;
  currentRadiance: number;
  estimatedDaysToRecover: number;
  area: number;
};

export const events: DisasterEvent[] = [
  {
    id: 'haiyan', name: 'Typhoon Haiyan Aftermath', date: 'Nov 8, 2013', endDate: 'Nov 15, 2013',
    severity: 'Severe', type: 'typhoon', affectedPopulation: 420000,
    description: 'A regional power disruption affecting coastal and inland communities across Panay Island.',
  },
  {
    id: 'odette', name: 'Typhoon Odette', date: 'Dec 16, 2021', endDate: 'Dec 23, 2021',
    severity: 'High', type: 'typhoon', affectedPopulation: 185000,
    description: 'Heavy winds and flooding caused widespread outages and delayed restoration work.',
  },
  {
    id: 'monsoon', name: 'Southwest Monsoon Floods', date: 'Aug 2, 2024', endDate: 'Aug 6, 2024',
    severity: 'Moderate', type: 'flood', affectedPopulation: 94000,
    description: 'Flooding interrupted distribution lines in low-lying municipalities.',
  },
];

export function getRecoveryColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#599ffd';
  if (score >= 40) return '#fbbf24';
  return '#f43f5e';
}

export function getRecoveryStatusColor(status: RecoveryStatus): string {
  return getRecoveryColor(status === 'restored' ? 85 : status === 'recovering' ? 65 : status === 'warning' ? 45 : 20);
}

export function getSeverityColor(severity: DisasterEvent['severity']): string {
  return severity === 'Severe' ? '#f43f5e' : severity === 'High' ? '#fbbf24' : '#599ffd';
}

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
    const recoveryScore = 38 + ((index * 17) % 59);
    const status: RecoveryStatus = recoveryScore >= 80 ? 'restored' : recoveryScore >= 60 ? 'recovering' : recoveryScore >= 40 ? 'warning' : 'critical';
    const area = Number(properties.AREA_SQKM ?? 50);
    return {
      id: String(properties.ADM3_PCODE ?? index),
      name: String(properties.ADM3_EN ?? 'Unnamed municipality'),
      province: String(properties.ADM2_EN ?? 'Panay'),
      recoveryScore,
      status,
      population: Math.round(area * 860),
      daysSinceEvent: 14,
      baselineRadiance: 8 + (index % 7),
      currentRadiance: 4 + (recoveryScore / 100) * 8,
      estimatedDaysToRecover: recoveryScore >= 80 ? 0 : Math.max(1, Math.round((100 - recoveryScore) / 8)),
      area,
    };
  });
}