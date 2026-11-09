import type {
  CalibrationData,
  CalibrationRecord,
  CustomEquipment,
  Instrument,
  PerformanceFormula,
  PerformanceSetting,
  Standard,
  Thermohygrometer,
  ThermohygrometerPoint,
} from './types';
import { adultScaleDigital, adultScaleMechanical, adultScaleStandards } from './weighingScales';

const readings = (count: number): string[] => Array.from({ length: count }, () => '');
const workbookPoint = (
  id: string,
  label: string,
  setting: string,
  unit: string,
  count: number,
  tolerancePercent: string,
  formula: PerformanceFormula = 'workbookAccuracy',
  options: Partial<PerformanceSetting> = {},
): PerformanceSetting => ({ id, label, setting, unit, count, tolerancePercent, formula, ...options });
const oxygenFlowRows = (idPrefix: string, tolerance: string, references: Instrument['references'], includeInScore = true) => Array.from({ length: 10 }, (_, index) =>
  workbookPoint(`${idPrefix}-${index + 1}`, 'Laju aliran gas oksigen', String(index + 1), 'L/min', 5, tolerance, 'workbookAccuracy', { references, includeInScore }));
const ventilatorReferences = { calibratorResolution: '0.01', calibratorUncertainty: '0', uutResolution: '0.1' };
const gasFlowReferences = { calibratorResolution: '0.1', calibratorUncertainty: '0.05', uutResolution: '0.1' };
const ventilatorPerformanceRows: PerformanceSetting[] = [
  ['m1-vt', 'Mode VT300/RR20/FiO₂30 · Volume tidal', '300', 'mL'],
  ['m1-rate', 'Mode VT300/RR20/FiO₂30 · Breath rate', '20', 'bpm'],
  ['m1-o2', 'Mode VT300/RR20/FiO₂30 · FiO₂', '30', '%'],
  ['m1-peep', 'Mode VT300/RR20/FiO₂30 · PEEP', '5', 'cmH₂O'],
  ['m1-pip', 'Mode VT300/RR20/FiO₂30 · PIP', '30', 'cmH₂O'],
  ['m1-ti', 'Mode VT300/RR20/FiO₂30 · Ti', '0.5', 'detik'],
  ['m2-vt', 'Mode VT400/RR15/FiO₂60 · Volume tidal', '400', 'mL'],
  ['m2-rate', 'Mode VT400/RR15/FiO₂60 · Breath rate', '15', 'bpm'],
  ['m2-o2', 'Mode VT400/RR15/FiO₂60 · FiO₂', '60', '%'],
  ['m2-peep', 'Mode VT400/RR15/FiO₂60 · PEEP', '5', 'cmH₂O'],
  ['m2-pip', 'Mode VT400/RR15/FiO₂60 · PIP', '20', 'cmH₂O'],
  ['m2-ti', 'Mode VT400/RR15/FiO₂60 · Ti', '1', 'detik'],
  ['m3-vt', 'Mode VT500/RR10/FiO₂90 · Volume tidal', '500', 'mL'],
  ['m3-rate', 'Mode VT500/RR10/FiO₂90 · Breath rate', '10', 'bpm'],
  ['m3-o2', 'Mode VT500/RR10/FiO₂90 · FiO₂', '90', '%'],
  ['m3-peep', 'Mode VT500/RR10/FiO₂90 · PEEP', '5', 'cmH₂O'],
  ['m3-pip', 'Mode VT500/RR10/FiO₂90 · PIP', '10', 'cmH₂O'],
  ['m3-ti', 'Mode VT500/RR10/FiO₂90 · Ti', '1.5', 'detik'],
  ['m4-vt', 'Mode VT300/RR20/FiO₂60 · Volume tidal', '300', 'mL'],
  ['m4-rate', 'Mode VT300/RR20/FiO₂60 · Breath rate', '20', 'bpm'],
  ['m4-o2', 'Mode VT300/RR20/FiO₂60 · FiO₂', '60', '%'],
  ['m5-vt', 'Mode VT300/RR20/FiO₂90 · Volume tidal', '300', 'mL'],
  ['m5-rate', 'Mode VT300/RR20/FiO₂90 · Breath rate', '20', 'bpm'],
  ['m5-o2', 'Mode VT300/RR20/FiO₂90 · FiO₂', '90', '%'],
].map(([id, label, setting, unit]) => workbookPoint(id, label, setting, unit, 5, '10', 'workbookComparisonAccuracy', { references: ventilatorReferences }));
const incubatorTemperatureRows = (setting: string) => ['T1', 'T2', 'T3', 'T4', 'T5'].map((sensor) => workbookPoint(
  `${setting}-${sensor.toLowerCase()}`, `Suhu udara ${setting} °C · ${sensor} min/maks`, setting, '°C', 6, '0', 'workbookPairedAccuracy',
  { absoluteTolerance: '1.5', references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '0.1' } },
));
const incubatorVariationRows = (setting: string, tolerance: string) => ['T1', 'T2', 'T3', 'T4', 'T5'].map((sensor) => workbookPoint(
  `${setting}-variation-${sensor.toLowerCase()}`, `Variasi suhu ${setting} °C · ${sensor}`, setting, '°C', 0, '0', 'workbookRange',
  { absoluteTolerance: tolerance, sourceIds: [`${setting}-${sensor.toLowerCase()}`] },
));
const bedsideRows = (prefix: string, label: string, settings: number[], unit: string, tolerancePercent: string, absoluteTolerance?: string) => settings.map((setting) => workbookPoint(
  `${prefix}-${setting}`, label, String(setting), unit, 6, tolerancePercent, 'workbookAccuracy',
  { ...(absoluteTolerance ? { absoluteTolerance } : {}), references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' } },
));
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
      { id: 'time', label: 'Akurasi waktu putar', setting: '300', unit: 'detik', count: 3, tolerancePercent: '10', formula: 'centrifugeTime' },
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
      { id: '60', label: 'Heart rate', setting: '60', unit: 'BPM', count: 5, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '90', label: 'Heart rate', setting: '90', unit: 'BPM', count: 5, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '120', label: 'Heart rate', setting: '120', unit: 'BPM', count: 5, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '150', label: 'Heart rate', setting: '150', unit: 'BPM', count: 5, tolerancePercent: '5', formula: 'fetalHeartRate' },
      { id: '180', label: 'Heart rate', setting: '180', unit: 'BPM', count: 5, tolerancePercent: '5', formula: 'fetalHeartRate' },
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
      { id: '1', label: 'Laju aliran gas oksigen', setting: '1', unit: 'L/min', count: 5, tolerancePercent: '20', formula: 'flowmeter' },
      { id: '2', label: 'Laju aliran gas oksigen', setting: '2', unit: 'L/min', count: 5, tolerancePercent: '20', formula: 'flowmeter' },
      { id: '4', label: 'Laju aliran gas oksigen', setting: '4', unit: 'L/min', count: 5, tolerancePercent: '20', formula: 'flowmeter' },
      { id: '6', label: 'Laju aliran gas oksigen', setting: '6', unit: 'L/min', count: 5, tolerancePercent: '20', formula: 'flowmeter' },
      { id: '8', label: 'Laju aliran gas oksigen', setting: '8', unit: 'L/min', count: 5, tolerancePercent: '20', formula: 'flowmeter' },
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
    suctionPump: { pressurePoints: [-150, -225, -300, -375, -450], minimumVacuumMmHg: 150, maximumVacuumMmHg: 450 },
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
  {
    id: 'aed',
    name: 'AED / Defibrillator',
    subtitle: 'Akurasi energi keluaran pada delapan setting',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Defibrillator Analyzer', 'Gossen Metrawatt', 'TC-920', '73969912072'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [5, 10, 20, 30, 50, 100, 150, 200].map((setting) => workbookPoint(
      `energy-${setting}`, 'Akurasi energi keluaran', String(setting), 'Joule', 3, '15', 'workbookAccuracy',
      { references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' }, uncertaintyRule: 'signed' },
    )),
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'aed-without-setting',
    name: 'AED tanpa setting',
    subtitle: 'Energi keluaran tetap · ambang minimum 110 Joule',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Defibrillator Analyzer', 'Gossen Metrawatt', 'TC-920', '73969912072'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [workbookPoint('fixed-energy', 'Energi keluaran tetap', '110', 'Joule', 3, '0', 'workbookMinimum', {
      includeUncertainty: false,
      references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' },
    })],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'anesthesia-unit',
    name: 'Anesthesia Unit',
    subtitle: 'Laju aliran gas, oxygen flush, dan keselamatan listrik',
    standards: [
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Gas Flow Analyzer', 'IMT Medical', 'PF-300', '2012BA104380'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Baterai', 'Selang pernapasan', 'Konektor gas', 'Back up catu daya', 'Alarm', 'Pelabelan dan aksesoris'],
    performanceRows: [
      ...oxygenFlowRows('gas-flow', '20', gasFlowReferences),
      workbookPoint('oxygen-flush', 'Oxygen flush valve', '55', 'L/min', 1, '0', 'workbookBand', {
        minimumSetting: '35', maximumSetting: '75', includeUncertainty: false, includeInScore: false,
      }),
    ],
    references: gasFlowReferences,
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'anesthesia-ventilator',
    name: 'Anesthesia Ventilator',
    subtitle: 'Ventilator, aliran gas, oxygen flush, dan keselamatan listrik',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Gas Flow Analyzer', 'IMT Medical', 'PF-300', '2012BA104380'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Baterai', 'Selang pernapasan', 'Konektor gas', 'Back up catu daya', 'Alarm', 'Pelabelan dan aksesoris'],
    performanceRows: [
      ...ventilatorPerformanceRows,
      ...oxygenFlowRows('oxygen-flow', '10', gasFlowReferences, false),
      workbookPoint('oxygen-flush', 'Oxygen flush valve', '55', 'L/min', 1, '0', 'workbookBand', {
        minimumSetting: '35', maximumSetting: '75', includeUncertainty: false, includeInScore: false,
      }),
    ],
    references: ventilatorReferences,
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'anesthesia-ventilator-vaporizer',
    name: 'Anesthesia Ventilator + Vaporizer',
    subtitle: 'Ventilator dan konsentrasi Sevoflurane / Isoflurane',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Gas Flow Analyzer', 'IMT Medical', 'PF-300', '2012BA104380'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Vaporizer Analyzer Sevoflurane', 'HEYER', 'VP 300', 'VP300ES1XYZR00221'],
      ['Vaporizer Analyzer Isoflurane', 'HEYER', 'VP 300', 'VP300EI1XYZR00255'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Baterai', 'Selang pernapasan', 'Konektor gas', 'Back up catu daya', 'Alarm', 'Pelabelan dan aksesoris'],
    performanceRows: [
      ...ventilatorPerformanceRows,
      ...oxygenFlowRows('oxygen-flow', '10', gasFlowReferences, false),
      workbookPoint('oxygen-flush', 'Oxygen flush valve', '55', 'L/min', 1, '0', 'workbookBand', {
        minimumSetting: '35', maximumSetting: '75', includeUncertainty: false, includeInScore: false,
      }),
      ...(['Sevoflurane', 'Isoflurane'] as const).flatMap((gas) => [0, 0.5, 1, 3, 5].map((setting) => workbookPoint(
        `${gas.toLowerCase()}-${setting}`, `${gas} · konsentrasi aliran udara 4 L/min`, String(setting), '%', 3, '0', 'workbookAccuracy', {
          absoluteTolerance: setting === 0 ? '0.1' : '0.3',
          references: { calibratorResolution: '0.1', calibratorUncertainty: '0.05', uutResolution: '0.1' },
          includeInScore: false,
        },
      ))),
    ],
    references: ventilatorReferences,
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'autoclave-steam-sterilizer',
    name: 'Autoclave (Steam Sterilizer)',
    subtitle: 'Temperatur siklus pada tiga titik sensor',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Thermometer', 'Lutron', 'TC-920', 'I.479807'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kontak catu daya', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [121, 134].flatMap((setting) => ['T1', 'T2', 'T3'].map((sensor) => workbookPoint(
      `temperature-${setting}-${sensor.toLowerCase()}`, `${sensor} · siklus ${setting} °C min/maks`, String(setting), '°C', 6, '0', 'workbookPairedAccuracy', {
        absoluteTolerance: setting === 121 ? '2' : '3', uncertaintyRule: 'signed',
        references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '0.1' },
      },
    ))),
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '0.1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'baby-incubator',
    name: 'Baby Incubator',
    subtitle: 'Suhu udara, kestabilan, waktu pemulihan, dan sensor kulit',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Incubator Analyzer', 'Fluke', 'Incu 1', '6050763'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Baterai', 'Alarm', 'Aksesoris dan sensor'],
    performanceRows: [
      ...incubatorTemperatureRows('32'),
      ...incubatorVariationRows('32', '1.5'),
      ...incubatorTemperatureRows('36'),
      ...incubatorVariationRows('36', '0.8'),
      workbookPoint('overshoot-32', 'Lonjakan suhu pada kontrol 32 °C', '2', '°C', 5, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('recovery-32', 'Waktu pemulihan setelah lonjakan 32 °C', '900', 'detik', 5, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('overshoot-36', 'Lonjakan suhu pada kontrol 36 °C', '2', '°C', 5, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('recovery-36', 'Waktu pemulihan setelah lonjakan 36 °C', '900', 'detik', 5, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('air-speed', 'Kecepatan udara pada 36 °C', '0.35', 'm/s', 6, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('mattress-temperature', 'Suhu matras pada 36 °C', '40', '°C', 6, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('noise', 'Kebisingan pada 36 °C', '60', 'dBA', 6, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('skin-temperature-control', 'Sensor kulit terhadap temperatur kontrol', '36', '°C', 6, '0', 'workbookAccuracy', { absoluteTolerance: '0.7' }),
      workbookPoint('skin-temperature-baby-mode', 'Sensor kulit terhadap kulit / Baby Mode', '36', '°C', 6, '0', 'workbookAccuracy', { absoluteTolerance: '0.3' }),
    ],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '0.1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'bedside-monitor',
    name: 'Bedside Monitor',
    subtitle: 'Heart rate, respirasi, SpO₂, dan NIBP',
    standards: [
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Vital Sign Simulator', 'Fluke', 'Prosim 4 Vital Sign Simulator', '3904012'],
      ['SpO₂ Simulator', 'Fluke', 'Prosim SPOT Light SpO₂', '3904012'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kabel catu utama', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Kabel aksesoris', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [
      ...bedsideRows('heart-rate', 'Heart rate', [30, 60, 120, 180], 'bpm', '5', '5'),
      ...bedsideRows('respiration', 'Respirasi', [10, 30, 60, 100], 'BrPM', '5', '5'),
      ...bedsideRows('spo2', 'Saturasi oksigen', [85, 90, 95, 100], '% O₂', '1'),
      ...bedsideRows('spo2-heart-rate', 'Heart rate melalui SpO₂', [60, 120, 180, 240], 'bpm', '1'),
      ...([[60, 40, 30], [120, 93, 80], [150, 117, 100], [200, 167, 150]] as [number, number, number][]).flatMap(([systolic, mean, diastolic]) => [
        workbookPoint(`nibp-systolic-${systolic}`, 'NIBP · Systole', String(systolic), 'mmHg', 6, '0', 'workbookAccuracy', { absoluteTolerance: '8', references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' } }),
        workbookPoint(`nibp-mean-${systolic}`, 'NIBP · Mean', String(mean), 'mmHg', 6, '0', 'workbookAccuracy', { absoluteTolerance: '8', references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' } }),
        workbookPoint(`nibp-diastolic-${systolic}`, 'NIBP · Diastole', String(diastolic), 'mmHg', 6, '0', 'workbookAccuracy', { absoluteTolerance: '8', references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' } }),
      ]),
    ],
    references: { calibratorResolution: '1', calibratorUncertainty: '0', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'biosafety-cabinet',
    name: 'Biosafety Cabinet',
    subtitle: 'Particle counter, kecepatan aliran, cahaya, suara, dan UV',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
      ['Particle Counter', 'Extech Instrument', 'VPC 300', '170526242'],
      ['Light Meter', 'Lutron', 'LM-8010', 'AL.89713'],
      ['Sound Level Meter', 'Krisbow', '-', '-'],
      ['Anemometer', 'Krisbow', 'KW06-053', '-'],
      ['UV Radiometer', 'Lutron', 'UV-340A', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kontak catu daya', 'Remote', 'Hidrolik', 'Roda'],
    performanceRows: [
      workbookPoint('particle-counter', 'Particle Counter · partikel 0,5 μm', '100', 'partikel', 6, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('inflow-velocity', 'Inflow velocity', '0.53', 'm/s', 6, '0', 'workbookAccuracy', { absoluteTolerance: '0.025', includeUncertainty: false }),
      workbookPoint('downflow-velocity', 'Downflow velocity', '0.35', 'm/s', 6, '0', 'workbookAccuracy', { absoluteTolerance: '0.025', includeUncertainty: false }),
      workbookPoint('light-meter', 'Light meter', '750', 'lux', 6, '0', 'workbookMinimum', { includeUncertainty: false }),
      workbookPoint('sound-level', 'Sound level meter', '55', 'dBA', 6, '0', 'workbookMaximum', { includeUncertainty: false }),
      workbookPoint('uv-radiometer', 'Lampu UV', '40', 'μW/cm²', 6, '0', 'workbookMinimum', { includeUncertainty: false }),
    ],
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0.05', uutResolution: '0.1' },
    score: { performanceThreshold: 70, performanceWeight: 0, physicalWeight: 60 },
    electricalSafety: true,
  },
  {
    id: 'blanket-warmer',
    name: 'Blanket Warmer',
    subtitle: 'Suhu T1 pada tiga seri pengukuran',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Thermometer', 'Lutron', 'TC-920', 'I.479807'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', '73969912072'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kontak catu daya', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: [1, 2, 3].map((cycle) => workbookPoint(
      `temperature-t1-${cycle}`, `Suhu T1 · pengukuran ${cycle}`, '38.5', '°C', 5, '10', 'workbookAccuracy', {
        references: { calibratorResolution: '0.1', calibratorUncertainty: '0.02', uutResolution: '1' },
        uncertaintyRule: 'signed', ...(cycle > 1 ? { includeInScore: false } : {}),
      },
    )),
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0.02', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
  {
    id: 'blood-bank-refrigerator',
    name: 'Blood Bank Refrigerator',
    subtitle: 'Suhu minimum dan maksimum pada lima sensor',
    standards: [
      ['Electrical Safety Analyzer', 'Gossen Metrawatt', 'Seculife ST Pro', 'FC7267170003'],
      ['Thermometer Digital', 'Lutron', 'TC-920', 'I.479807'],
      ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
    ],
    inspectionItems: ['Badan dan permukaan', 'Kotak kontak alat', 'Kontak catu daya', 'Sekering pengaman', 'Tombol, saklar dan kontrol', 'Tombol-tombol fungsi', 'Tampilan dan indikator'],
    performanceRows: ['T1', 'T2', 'T3', 'T4', 'T5'].map((sensor) => workbookPoint(
      `temperature-${sensor.toLowerCase()}`, `${sensor} suhu minimum/maksimum`, '4', '°C', 6, '25', 'workbookPairedAccuracy', {
        absoluteTolerance: '1', uncertaintyRule: 'signed',
        references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '1' },
      },
    )),
    references: { calibratorResolution: '0.1', calibratorUncertainty: '0.01', uutResolution: '1' },
    score: { performanceThreshold: 70, performanceWeight: 50, physicalWeight: 10 },
    electricalSafety: true,
  },
];

export const getInstrument = (id: string): Instrument | undefined => instruments.find((instrument) => instrument.id === id);

export const getInstrumentTemplateId = (instrument: Instrument) => instrument.templateId ?? instrument.id;

export function getCustomEquipmentInstrument(entry: CustomEquipment): Instrument | undefined {
  const template = getInstrument(entry.templateId);
  if (!template) return undefined;
  const existingNames = new Set(template.standards.map(([name]) => name.trim().toLowerCase()));
  const addedStandards = entry.standardNames.flatMap((name): Standard[] => {
    const normalized = name.trim().toLowerCase();
    if (!normalized || existingNames.has(normalized)) return [];
    existingNames.add(normalized);
    return [[name.trim(), '', '', ''] as Standard];
  });
  return { ...template, id: entry.id, templateId: template.id, name: entry.name, subtitle: `Rumus mengikuti ${template.name}`, standards: [...template.standards, ...addedStandards] };
}

export function getRecordInstrument(record: CalibrationRecord): Instrument | undefined {
  return record.instrumentSnapshot ?? getInstrument(record.instrumentId);
}

export function createInitialData(instrumentId: string): CalibrationData {
  const instrument = getInstrument(instrumentId);
  if (!instrument) throw new Error(`Alat tidak dikenal: ${instrumentId}`);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return {
    identity: {
      customerId: '', documentNumber: '', orderNumber: '', labelNumber: '', brand: '', model: '', serial: '',
      capacity: instrument.weighingScale ? String(instrument.weighingScale.capacityKg) : instrument.sphygmomanometer ? String(instrument.sphygmomanometer.capacityMmHg) : '',
      accuracy: instrument.weighingScale ? String(instrument.weighingScale.resolutionKg) : instrument.sphygmomanometer ? String(instrument.sphygmomanometer.accuracyClass) : '',
      technician: '', receivedDate: today, testDate: today, issueDate: '', room: '', customer: '', address: '', city: '', method: '',
    },
    equipmentPhotos: { front: '', back: '', left: '', right: '' },
    environment: {
      standardId: '', reference: null, temperatureStart: '', temperatureEnd: '',
      humidityStart: '', humidityEnd: '',
    },
    selectedDevices: [],
    references: { ...instrument.references },
    inspections: instrument.inspectionItems.map((label) => ({ label, physical: '', function: '', note: '' })),
    performance: instrument.performanceRows.map((row) => ({
      ...row,
      readings: readings(row.count),
      ...(row.formula === 'workbookComparisonAccuracy' ? { standardReadings: readings(row.count) } : {}),
      ...(row.formula === 'workbookPairedAccuracy' ? { pairedReadings: readings(row.count) } : {}),
    })),
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
    ...(getInstrumentTemplateId(instrument) === 'infusion-pump' || getInstrumentTemplateId(instrument) === 'syringe-pump' ? { infusionPump: {
      channel: 'Channel 1', occlusionReadings: readings(6),
    } } : {}),
    ...(instrument.suctionPump ? { suctionPump: {
      pressureReadings: instrument.suctionPump.pressurePoints.map((setting) => ({ setting, up: readings(6), down: readings(6) })),
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
