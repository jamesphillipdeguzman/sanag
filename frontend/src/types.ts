export type RecoveryStatus = 'restored' | 'recovering' | 'warning' | 'critical';

export interface Municipality {
  id: string;
  name: string;
  province: string;
  region?: string;
  pcode?: string;
  psgc?: string;
  recoveryScore: number;
  status: RecoveryStatus;
  population: number;
  daysSinceEvent: number;
  baselineRadiance: number;
  currentRadiance: number;
  estimatedDaysToRecover: number;
  area: number;
  recoveryDate?: string | null;
}

export type DisasterType = 'blackout' | 'typhoon' | 'flood' | 'earthquake' | 'disaster';

export interface DisasterEvent {
  id: string;
  name: string;
  date: string;
  endDate: string;
  severity: 'Severe' | 'High' | 'Moderate';
  type: DisasterType;
  affectedPopulation: number;
  description: string;
  category?: string;
  alert_level?: string;
  viirs_data_available?: boolean;
  critical_municipalities?: Array<{
    name: string;
    pcode: string;
    recovery_score: number;
    r_t: number;
    status: string;
  }>;
}

export interface GdacsAlert {
  event_id: string | number;
  id?: string;
  name: string;
  type: string;
  category?: string;
  alert_level: 'Red' | 'Orange' | 'Green' | string;
  alert_score?: number;
  date: string;
  fromdate?: string;
  description: string;
  severity_text?: string;
  country?: string;
  url?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: [number, number] | null;
  bbox?: number[] | null;
  geometry?: any;
  is_imported?: boolean;
  viirs_data_available?: boolean;
}