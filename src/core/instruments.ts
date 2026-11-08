import type {
  CalibrationData,
  Instrument,
  Thermohygrometer,
  ThermohygrometerPoint,
} from './types';
import { adultScaleDigital, adultScaleMechanical, adultScaleStandards } from './weighingScales';

const readings = (count: number): string[] => Array.from({ length: count }, () => '');
const points = (values: [number, number][]): ThermohygrometerPoint[] => values.map(([value, correction]) => ({ value, correction }));
const sphygmomanometerInspectionItems = [
  'Badan / permukaan', 'Balon tensi, tabung, dan selang', 'Bantalan / rem', 'Filter air raksa',
  'Gauge / tabung aneroid', 'Indikator', 'Konektor', 'Label', 'Manset', 'Zeroing',
  'Pengencang', 'Valve penutup',
];
const sphygmomanometerPressurePoints = [0, 50, 100, 150, 200, 250];
const sphygmomanometerDrift = [
  { pressure: 0, up: 0.02, down: 0.02 }, { pressure: 50, up: 0.52, down: 0.52 },
  { pressure: 100, up: 0.52, down: 0.42 }, { pressure: 150, up: 0.61, down: 0.61 },
  { pressure: 200, up: 0.61, down: 0.61 }, { pressure: 250, up: 0.71, down: 0.61 },
];
export const thermohygrometers: Thermohygrometer[] = [
  {
    id: 'EFG19BE02496',
    serial: 'EFG19BE02496',
    temperature: points([[15, 0.5], [20, 0.4], [25, 0.5], [30, 0.6], [35, 0.8], [37, 0.9]]),
    humidity: points([[30, -6.9], [40, -8.8], [50, -9.6], [60, -9.2], [70, -7.8], [80, -5.4]]),
    temperatureU95: 0.5,
    humidityU95: 2.3,
  },
  {
    id: 'EFG19CE01086',
    serial: 'EFG19CE01086',
    temperature: points([[15, 0.1], [20, 0], [25, 0.1], [30, 0.2], [35, 0.5], [37, 0.6]]),
    humidity: points([[30, -5.6], [40, -6.8], [50, -7.4], [60, -7.2], [70, -6.3], [80, -4.7]]),
    temperatureU95: 0.5,
    humidityU95: 2.3,
  },
  {
    id: 'EFG19CE01084',
    serial: 'EFG19CE01084',
    temperature: points([[15, 0.4], [20, 0.3], [25, 0.2], [30, 0.1], [35, 0], [37, 0]]),
    humidity: points([[30, -7.6], [40, -9.5], [50, -10.1], [60, -9.7], [70, -8.1], [80, -5.3]]),
    temperatureU95: 0.5,
    humidityU95: 2.3,
  },
  {
    id: 'EFG19BE02500',
    serial: 'EFG19BE02500',
    temperature: points([[15, -0.2], [20, 0], [25, 0.2], [30, 0.4], [35, 0.7], [37, 0.8]]),
    humidity: points([[30, -8.2], [40, -9.7], [50, 10.1], [60, -9.4], [70, -7.7], [80, -4.8]]),
    temperatureU95: 0.5,
    humidityU95: 2.3,
  },
  {
    id: 'EFG19CE01110',
    serial: 'EFG19CE01110',
    temperature: points([[15, 0.6], [20, 0.4], [25, 0.3], [30, 0.3], [35, 0.4], [37, 0.5]]),
    humidity: points([[30, -8.3], [40, -9.9], [50, -10.3], [60, -9.5], [70, -7.5], [80, -4.3]]),
    temperatureU95: 0.5,
    humidityU95: 2.3,
  },
];

export const instruments: Instrument[] = [
  {
    id: 'centrifuge',
    name: 'Centrifuge',
    subtitle: 'Kecepatan putar, waktu, keselamatan listrik',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Tachometer', 'Lutron', 'DT-1236L', 'I. 52947'],
      ['Stopwatch', 'Seiko', 'S23589P7', '740487'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: [
      'Badan dan permukaan', 'Kotak kontak alat', 'Kontak catu daya',
      'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol fungsi', 'Tampilan dan indikator',
    ],
    performanceRows: [
      { id: 'low', label: 'Kecepatan rendah', setting: '1000', unit: 'RPM', count: 5, tolerancePercent: '10', formula: 'centrifugeSpeed' },
      { id: 'medium', label: 'Kecepatan sedang', setting: '2000', unit: 'RPM', count: 5, tolerancePercent: '10', formula: 'centrifugeSpeed' },
      { id: 'high', label: 'Kecepatan tinggi', setting: '4000', unit: 'RPM', count: 5, tolerancePercent: '10', formula: 'centrifugeSpeed' },
      { id: 'half', label: 'Kecepatan 50%', setting: '2500', unit: 'RPM', count: 5, tolerancePercent: '10', formula: 'centrifugeSpeed' },
      { id: 'time', label: 'Akurasi waktu putar', setting: '600', unit: 'detik', count: 3, tolerancePercent: '10', formula: 'centrifugeTime' },
    ],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
  },
  {
    id: 'fetal-doppler',
    name: 'Fetal Doppler',
    subtitle: 'Heart rate pada lima titik BPM',
    standards: [
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Vital Sign Simulator', 'Gossen Metrawatt', 'Seculife BP Pro', '735AE9911141'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kabel transduser', 'Tombol, saklar dan kontrol', 'Tampilan dan indikator'],
    performanceRows: [
      { id: '60', label: 'Heart rate', setting: '60', unit: 'BPM', count: 6, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '80', label: 'Heart rate', setting: '80', unit: 'BPM', count: 6, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '120', label: 'Heart rate', setting: '120', unit: 'BPM', count: 6, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '160', label: 'Heart rate', setting: '160', unit: 'BPM', count: 6, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '240', label: 'Heart rate', setting: '240', unit: 'BPM', count: 6, tolerancePercent: '5', formula: 'fetalHeartRate' },
    ],
    references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 90, physicalWeight: 10 },
  },
  {
    id: 'flowmeter',
    name: 'Flow Meter',
    subtitle: 'Laju aliran gas oksigen pada lima titik',
    standards: [
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Gas Flow Analyzer', 'IMT Medical', 'PF-300', '2012BA104380'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Tabung kaca', 'Skala penunjukan', 'Regulator', 'Humidifier', 'Filter'],
    performanceRows: [
      { id: '2', label: 'Laju aliran gas oksigen', setting: '2', unit: 'L/min', count: 5, tolerancePercent: '10', formula: 'flowmeter' },
      { id: '4', label: 'Laju aliran gas oksigen', setting: '4', unit: 'L/min', count: 5, tolerancePercent: '10', formula: 'flowmeter' },
      { id: '6', label: 'Laju aliran gas oksigen', setting: '6', unit: 'L/min', count: 5, tolerancePercent: '10', formula: 'flowmeter' },
      { id: '8', label: 'Laju aliran gas oksigen', setting: '8', unit: 'L/min', count: 5, tolerancePercent: '10', formula: 'flowmeter' },
      { id: '10', label: 'Laju aliran gas oksigen', setting: '10', unit: 'L/min', count: 5, tolerancePercent: '10', formula: 'flowmeter' },
    ],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '0.1' },
    score: { performanceThreshold: 30, performanceWeight: 90, physicalWeight: 10 },
  },
  {
    id: 'infusion-pump',
    name: 'Infusion Pump',
    subtitle: 'Laju aliran, occlusion, dan keselamatan listrik',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Infusion Device Analyzer', 'Gossen Metrawatt', 'Seculife IF Pro', '73199911066'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kontak catu daya', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [10, 50, 100, 150, 300].map((setting) => ({ id: String(setting), label: 'Laju aliran', setting: String(setting), unit: 'mL/h', count: 6, tolerancePercent: '10', formula: 'infusionFlow' as const })),
    references: { calibratorResolution: '0.01', calibratorUncertainty: '0', uutResolution: '0.01' },
    score: { performanceThreshold: 85, performanceWeight: 50, physicalWeight: 10 },
  },
  {
    id: 'syringe-pump',
    name: 'Syringe Pump',
    subtitle: 'Laju aliran, occlusion, dan keselamatan listrik',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Infusion Device Analyzer', 'Gossen Metrawatt', 'Seculife IF Pro', '73199911066'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kontak catu daya', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [10, 25, 50, 75, 100].map((setting) => ({ id: String(setting), label: 'Laju aliran', setting: String(setting), unit: 'mL/h', count: 6, tolerancePercent: '10', formula: 'infusionFlow' as const })),
    references: { calibratorResolution: '0.01', calibratorUncertainty: '0', uutResolution: '0.01' },
    score: { performanceThreshold: 85, performanceWeight: 50, physicalWeight: 10 },
  },
  {
    id: 'suction-pump',
    name: 'Suction Pump',
    subtitle: 'Tekanan vakum, waktu daya hisap, dan keselamatan listrik',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Digital Pressure Meter', 'Gossen Metrawatt', 'Seculife DP Pro', '732129100NNS081037'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tabung dan selang'],
    performanceRows: [],
    references: { calibratorResolution: '20', calibratorUncertainty: '0.31', uutResolution: '20' },
    score: { performanceThreshold: 100, performanceWeight: 50, physicalWeight: 10 },
    suctionPump: { pressurePoints: [-200, -300, -400, -500, -600], minimumVacuumMmHg: 300 },
  },
  {
    id: 'adult-scale-digital',
    name: 'Timbangan Dewasa Digital',
    subtitle: 'Digital · kapasitas 150 kg · resolusi 0,1 kg',
    standards: adultScaleStandards,
    inspectionItems: ['Permukaan timbangan', 'Tampilan digital', 'Indikator', 'Pegas', 'Selektor / tombol zero'],
    performanceRows: [],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '0.1' },
    score: { performanceThreshold: 70, performanceWeight: 90, physicalWeight: 10 },
    weighingScale: adultScaleDigital,
  },
  {
    id: 'adult-scale-mechanical',
    name: 'Timbangan Dewasa Mekanik',
    subtitle: 'Mekanik · kapasitas 130 kg · resolusi 1 kg',
    standards: adultScaleStandards,
    inspectionItems: ['Permukaan timbangan', 'Tampilan skala', 'Jarum penunjuk', 'Pegas', 'Selektor / tombol zero'],
    performanceRows: [],
    references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 90, physicalWeight: 10 },
    weighingScale: adultScaleMechanical,
  },
  {
    id: 'sphygmomanometer-analog',
    name: 'Sphygmomanometer Analog',
    subtitle: 'Analog · uji kebocoran, deflasi cepat, dan tekanan',
    standards: [
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Stopwatch', 'Seiko', 'S23589P7', '740487'],
      ['Digital Pressure Meter', 'Gossen Metrawatt', 'Seculife DP Pro', '732129100NNS081037'],
    ],
    inspectionItems: sphygmomanometerInspectionItems,
    performanceRows: [],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 90, physicalWeight: 10 },
    sphygmomanometer: {
      capacityMmHg: 300,
      accuracyClass: 2,
      pressurePoints: sphygmomanometerPressurePoints,
      dpmCorrections: [
        { pressure: 0, up: -0.02, down: -0.02 }, { pressure: 50, up: -0.22, down: -0.22 },
        { pressure: 100, up: -0.22, down: -0.22 }, { pressure: 150, up: -0.21, down: -0.21 },
        { pressure: 200, up: -0.21, down: -0.21 }, { pressure: 250, up: -0.11, down: -0.11 },
        { pressure: 300, up: -0.21, down: -0.21 },
      ],
      dpmU95: 0.15,
      drift: sphygmomanometerDrift,
    },
  },
  {
    id: 'sphygmomanometer-digital',
    name: 'Sphygmomanometer Digital',
    subtitle: 'Digital · uji kebocoran, deflasi cepat, dan tekanan',
    standards: [
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Stopwatch', 'Seiko', 'S23589P7', '740487'],
      ['Digital Pressure Meter', 'Gossen Metrawatt', 'Seculife DP Pro', '732129100NNS081012'],
    ],
    inspectionItems: sphygmomanometerInspectionItems,
    performanceRows: [],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 90, physicalWeight: 10 },
    sphygmomanometer: {
      capacityMmHg: 250,
      accuracyClass: 1,
      pressurePoints: sphygmomanometerPressurePoints,
      dpmCorrections: [
        { pressure: 0, up: 0, down: 0 }, { pressure: 50, up: 0, down: -0.3 },
        { pressure: 100, up: -0.4, down: -0.5 }, { pressure: 150, up: -0.5, down: -0.5 },
        { pressure: 200, up: -0.5, down: -0.6 }, { pressure: 250, up: -0.6, down: -0.7 },
        { pressure: 300, up: -0.6, down: -0.7 },
      ],
      dpmU95: 0.4,
      drift: sphygmomanometerDrift,
    },
  },
];

export const getInstrument = (id: string): Instrument | undefined => instruments.find((instrument) => instrument.id === id);

export function createInitialData(instrumentId: string): CalibrationData {
  const instrument = getInstrument(instrumentId);
  if (!instrument) throw new Error(`Alat tidak dikenal: ${instrumentId}`);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    identity: {
      customerId: '', documentNumber: '', orderNumber: '', labelNumber: '', brand: '', model: '', serial: '',
      capacity: instrument.weighingScale ? String(instrument.weighingScale.capacityKg) : instrument.sphygmomanometer ? String(instrument.sphygmomanometer.capacityMmHg) : '',
      accuracy: instrument.weighingScale ? String(instrument.weighingScale.resolutionKg) : instrument.sphygmomanometer ? `Kelas ${instrument.sphygmomanometer.accuracyClass}` : '',
      technician: '', receivedDate: today, testDate: today, issueDate: '', room: '', customer: '', address: '', city: '', method: '',
    },
    environment: {
      standardId: '', reference: null, temperatureStart: '', temperatureEnd: '',
      humidityStart: '', humidityEnd: '',
    },
    selectedDevices: [],
    references: { ...instrument.references },
    inspections: instrument.inspectionItems.map((label) => ({ label, physical: '', function: '', note: '' })),
    performance: instrument.performanceRows.map((row) => ({ ...row, readings: readings(row.count) })),
    ...(instrument.weighingScale ? { weighing: {
      repeatabilityReadings: Array.from({ length: 10 }, () => ({ zeroReading: '', indication: '' })),
      points: instrument.weighingScale.points.map(({ id }) => ({ id, zeroReading: '', indication: '', standardWeights: [] })),
      standardsInitialized: false,
    } } : {}),
    ...(instrument.sphygmomanometer ? { sphygmomanometer: {
      leakageDrop: '',
      rapidDeflationSeconds: '',
      pressureReadings: instrument.sphygmomanometer.pressurePoints.map((setting) => ({ setting, up: readings(3), down: readings(3) })),
    } } : {}),
    ...(instrument.id === 'infusion-pump' || instrument.id === 'syringe-pump' ? { infusionPump: {
      channel: 'Channel 1', occlusionReadings: readings(6),
    } } : {}),
    ...(instrument.suctionPump ? { suctionPump: {
      pressureReadings: instrument.suctionPump.pressurePoints.map((setting) => ({ setting, up: readings(3), down: readings(3) })),
      maximumVacuumReading: '',
      maximumVacuumSeconds: '',
    } } : {}),
    safety: {
      voltage: '', earthType: '2', earthResistance: '',
      earthMeets: '', leakageType: '1', equipmentLeakage: '', equipmentLeakageMeets: '',
      appliedLeakage: '', appliedLeakageMeets: '', appliedLeakageNA: false,
      insulationResistance: '', insulationMeets: '',
    },
  };
}
