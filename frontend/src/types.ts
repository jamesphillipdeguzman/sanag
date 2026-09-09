export type RecoveryStatus = 'restored' | 'recovering' | 'warning' | 'critical';

export interface Municipality {
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
}

export type DisasterType = 'blackout' | 'typhoon' | 'flood';

export interface DisasterEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  severity: 'Severe' | 'High' | 'Moderate';
  type: DisasterType;
  affectedPopulation: number;
  description: string;
}