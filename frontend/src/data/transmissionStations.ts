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
  operator: string;
  operationalStatus: 'Energized' | 'Islanded' | 'Tripped' | 'Critical';
  coverage: string[];
  coordinates?: [number, number];
}

export const PANAY_TRANSMISSION_STATIONS: TransmissionStation[] = [
  {
    id: 'st-sb',
    name: 'Santa Barbara Substation',
    province: 'Iloilo',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / ILECO I',
    operationalStatus: 'Energized',
    coverage: ['Santa Barbara', 'Pavia', 'Alimodian', 'Leon'],
    coordinates: [10.8236, 122.5342],
  },
  {
    id: 'st-pav',
    name: 'Pavia Switching Station',
    province: 'Iloilo',
    voltage: '69kV',
    type: 'switching_station',
    status: 'active',
    operator: 'NGCP / MORE Power / ILECO I',
    operationalStatus: 'Energized',
    coverage: ['Pavia', 'Iloilo City', 'Leganes'],
    coordinates: [10.7781, 122.5444],
  },
  {
    id: 'st-din',
    name: 'Dingle Substation',
    province: 'Iloilo',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / ILECO II',
    operationalStatus: 'Energized',
    coverage: ['Dingle', 'Pototan', 'Barotac Nuevo', 'Mina'],
    coordinates: [11.0042, 122.6714],
  },
  {
    id: 'st-bv',
    name: 'Barotac Viejo Substation',
    province: 'Iloilo',
    voltage: '69kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / ILECO III',
    operationalStatus: 'Islanded',
    coverage: ['Barotac Viejo', 'Banate', 'San Rafael'],
    coordinates: [11.0506, 122.8489],
  },
  {
    id: 'st-sar',
    name: 'Sara Substation',
    province: 'Iloilo',
    voltage: '69kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / ILECO III',
    operationalStatus: 'Energized',
    coverage: ['Sara', 'Ajuy', 'Lemery', 'San Dionisio'],
    coordinates: [11.2617, 123.0131],
  },
  {
    id: 'st-con',
    name: 'Concepcion Substation',
    province: 'Iloilo',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / PCPC / ILECO III',
    operationalStatus: 'Energized',
    coverage: ['Concepcion', 'Estancia', 'Balasan'],
    coordinates: [11.2189, 123.1161],
  },
  {
    id: 'st-rox',
    name: 'Roxas Substation',
    province: 'Capiz',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / CAPELCO',
    operationalStatus: 'Energized',
    coverage: ['Roxas City', 'Panay', 'Ivisan'],
    coordinates: [11.5853, 122.7511],
  },
  {
    id: 'st-pan',
    name: 'Panitan Substation',
    province: 'Capiz',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / CAPELCO',
    operationalStatus: 'Energized',
    coverage: ['Panitan', 'Pontevedra', 'Maayon', 'Pilar'],
    coordinates: [11.4503, 122.8189],
  },
  {
    id: 'st-sig',
    name: 'Sigma Substation',
    province: 'Capiz',
    voltage: '69kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / CAPELCO',
    operationalStatus: 'Islanded',
    coverage: ['Sigma', 'Mambusao', 'Dao', 'Cuartero'],
    coordinates: [11.4258, 122.6756],
  },
  {
    id: 'st-nab',
    name: 'Nabas Substation',
    province: 'Aklan',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / AKELCO',
    operationalStatus: 'Energized',
    coverage: ['Nabas', 'Malay (Boracay)', 'Ibajay'],
    coordinates: [11.8528, 122.0661],
  },
  {
    id: 'st-kal',
    name: 'Kalibo Substation',
    province: 'Aklan',
    voltage: '69kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / AKELCO',
    operationalStatus: 'Energized',
    coverage: ['Kalibo', 'New Washington', 'Banga', 'Numancia'],
    coordinates: [11.7081, 122.3664],
  },
  {
    id: 'st-alt',
    name: 'Altavas Substation',
    province: 'Aklan',
    voltage: '69kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / AKELCO',
    operationalStatus: 'Energized',
    coverage: ['Altavas', 'Batan', 'Balete', 'Libacao'],
    coordinates: [11.5333, 122.4833],
  },
  {
    id: 'st-sj',
    name: 'San Jose Substation',
    province: 'Antique',
    voltage: '138kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / ANTECO',
    operationalStatus: 'Energized',
    coverage: ['San Jose de Buenavista', 'Hamtic', 'Sibalom'],
    coordinates: [10.7444, 121.9444],
  },
  {
    id: 'st-cul',
    name: 'Culasi Substation',
    province: 'Antique',
    voltage: '69kV',
    type: 'substation',
    status: 'active',
    operator: 'NGCP / ANTECO',
    operationalStatus: 'Energized',
    coverage: ['Culasi', 'Tibiao', 'Barbaza', 'Pandan'],
    coordinates: [11.4286, 122.0578],
  },
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
