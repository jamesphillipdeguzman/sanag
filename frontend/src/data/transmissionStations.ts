/**
 * Transmission Substation & Telemetry Nodes Dataset
 * Ground-truth high-voltage transmission substation and grid telemetry nodes
 * operated across the 4 Panay Island provinces (Iloilo, Capiz, Aklan, Antique)
 * supplying power to the local government units (LGUs).
 */

export interface TransmissionStation {
  id: string;
  name: string;
  province: 'Iloilo' | 'Capiz' | 'Aklan' | 'Antique' | string;
  voltage: string;
  type?: 'substation' | 'switching_station' | 'telemetry_node' | string;
  status: 'active' | 'standby' | 'maintenance' | string;
}

export const PANAY_TRANSMISSION_STATIONS: TransmissionStation[] = [
  { id: 'st-sb', name: 'Santa Barbara Substation', province: 'Iloilo', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-pav', name: 'Pavia Switching Station', province: 'Iloilo', voltage: '69kV', type: 'switching_station', status: 'active' },
  { id: 'st-din', name: 'Dingle Substation', province: 'Iloilo', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-bv', name: 'Barotac Viejo Substation', province: 'Iloilo', voltage: '69kV', type: 'substation', status: 'active' },
  { id: 'st-sar', name: 'Sara Substation', province: 'Iloilo', voltage: '69kV', type: 'substation', status: 'active' },
  { id: 'st-con', name: 'Concepcion Substation', province: 'Iloilo', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-rox', name: 'Roxas Substation', province: 'Capiz', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-pan', name: 'Panitan Substation', province: 'Capiz', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-sig', name: 'Sigma Substation', province: 'Capiz', voltage: '69kV', type: 'substation', status: 'active' },
  { id: 'st-nab', name: 'Nabas Substation', province: 'Aklan', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-kal', name: 'Kalibo Substation', province: 'Aklan', voltage: '69kV', type: 'substation', status: 'active' },
  { id: 'st-alt', name: 'Altavas Substation', province: 'Aklan', voltage: '69kV', type: 'substation', status: 'active' },
  { id: 'st-sj', name: 'San Jose Substation', province: 'Antique', voltage: '138kV', type: 'substation', status: 'active' },
  { id: 'st-cul', name: 'Culasi Substation', province: 'Antique', voltage: '69kV', type: 'substation', status: 'active' },
];

/**
 * Calculates active transmission stations count dynamically from the collection.
 */
export function getActiveStationsCount(
  stations: TransmissionStation[] = PANAY_TRANSMISSION_STATIONS
): number {
  return stations.filter((s) => s.status === 'active').length;
}

export interface ProvinceStationGroup {
  province: string;
  count: number;
  active_count: number;
  stations: TransmissionStation[];
}

/**
 * Groups transmission stations by province, preserving consistent province ordering.
 */
export function getStationsByProvince(
  stations: TransmissionStation[] = PANAY_TRANSMISSION_STATIONS
): ProvinceStationGroup[] {
  const provinces = ['Iloilo', 'Capiz', 'Aklan', 'Antique'];
  return provinces.map((prov) => {
    const provStations = stations.filter((s) => s.province === prov);
    return {
      province: prov,
      count: provStations.length,
      active_count: provStations.filter((s) => s.status === 'active').length,
      stations: provStations,
    };
  });
}
