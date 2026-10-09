import React from 'react';
import type { Municipality } from '@/types';

export interface WeatherForecastProps {
  lat?: number;
  lon?: number;
  regionName?: string;
  selectedMunicipality?: Municipality | null;
  selectedRegionKey?: string;
  selectedId?: string | null;
}

declare const WeatherForecast: React.FC<WeatherForecastProps>;
export default WeatherForecast;
