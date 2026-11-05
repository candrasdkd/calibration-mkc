import { thermohygrometers } from './instruments';
import type {
  CalculationResult,
  CalculatedPerformance,
  CalibrationData,
  EnvironmentMeasurement,
  EnvironmentResult,
  Instrument,
  MeasurementReferences,
  PerformanceEntry,
  SafetyCheck,
  SafetyData,
  SafetyResult,
  ThermohygrometerPoint,
} from './types';

const number = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const average = (values: number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;

function validDate(value: string) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3]);
}

function sampleStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function interpolate(value: number, table: ThermohygrometerPoint[]): number | null {
  if (value < table[0].value || value > table[table.length - 1].value) return null;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (value <= upper.value) {
      const portion = (value - lower.value) / (upper.value - lower.value);
      return lower.correction + portion * (upper.correction - lower.correction);
    }
  }
  return table[table.length - 1].correction;
}

function calculateEnvironment(data: CalibrationData): EnvironmentResult {
  const reference = data.environment.reference ?? thermohygrometers.find((item) => item.id === data.environment.standardId);
  if (!reference) return { reference: null, temperature: null, humidity: null, errors: ['Pilih thermohygrometer acuan.'] };
  const errors: string[] = [];
  const calculatePair = (
    kind: 'suhu' | 'kelembaban',
    startKey: 'temperatureStart' | 'humidityStart',
    endKey: 'temperatureEnd' | 'humidityEnd',
    points: ThermohygrometerPoint[],
    certificateU95: number,
  ): EnvironmentMeasurement | null => {
    const start = number(data.environment[startKey]);
    const end = number(data.environment[endKey]);
    if (start === null || end === null) return null;
    const startCorrection = interpolate(start, points);
    const endCorrection = interpolate(end, points);
    if (startCorrection === null || endCorrection === null) {
      errors.push(kind === 'suhu'
        ? 'Suhu harus berada pada rentang sertifikat thermohygrometer 15–37 °C.'
        : 'Kelembaban harus berada pada rentang sertifikat thermohygrometer 30–80%.');
      return null;
    }
    const correctedStart = start + startCorrection;
    const correctedEnd = end + endCorrection;
    const ua = sampleStandardDeviation([start, end]) / Math.sqrt(2);
    const uResolution = (0.5 * 0.1) / Math.sqrt(3);
    const combined = Math.sqrt(ua ** 2 + certificateU95 ** 2 + uResolution ** 2);
    return {
      start,
      end,
      startCorrection,
      endCorrection,
      correctedStart,
      correctedEnd,
      mean: (correctedStart + correctedEnd) / 2,
      range: Math.abs(correctedStart - correctedEnd),
      u95: combined * 2,
    };
  };

  const temperature = calculatePair('suhu', 'temperatureStart', 'temperatureEnd', reference.temperature, reference.temperatureU95);
  const humidity = calculatePair('kelembaban', 'humidityStart', 'humidityEnd', reference.humidity, reference.humidityU95);
  return { reference, temperature, humidity, errors };
}

function calculatePerformanceRow(row: PerformanceEntry, references: MeasurementReferences): CalculatedPerformance | null {
  const setting = number(row.setting);
  const parsedReadings = row.readings.map(number);
  const referenceValues = [references.calibratorResolution, references.calibratorUncertainty, references.uutResolution].map(number);
  const tolerancePercent = number(row.tolerancePercent);
  const readings = parsedReadings.filter((value): value is number => value !== null);
  const parsedReferences = referenceValues.filter((value): value is number => value !== null);
  if (setting === null || setting <= 0 || row.readings.length < 2 || readings.length !== row.readings.length
    || parsedReferences.length !== 3 || parsedReferences[0] <= 0
    || parsedReferences[1] < 0 || parsedReferences[2] <= 0 || tolerancePercent === null || tolerancePercent <= 0) return null;

  const mean = average(readings);
  let correction: number;
  if (row.formula === 'centrifugeSpeed' || row.formula === 'centrifugeTime') {
    correction = mean - setting;
  } else if (row.formula === 'fetalHeartRate') {
    correction = Math.abs(mean) - Math.abs(setting);
  } else {
    correction = Math.abs(setting) - Math.abs(mean);
  }

  const divisor = row.formula === 'fetalHeartRate' ? Math.sqrt(6)
    : row.formula === 'flowmeter' ? Math.sqrt(5) : Math.sqrt(3);
  const ua = sampleStandardDeviation(readings) / divisor;
  const calibratorUncertainty = parsedReferences[1] / 2;
  const uutResolutionUncertainty = (parsedReferences[2] / 2) / Math.sqrt(3);
  const calibratorResolutionUncertainty = (parsedReferences[0] / 2) / Math.sqrt(3);
  const u95 = Math.sqrt(ua ** 2 + calibratorUncertainty ** 2 + uutResolutionUncertainty ** 2 + calibratorResolutionUncertainty ** 2) * 2;
  const tolerance = setting * (tolerancePercent / 100);
  const testValue = row.formula === 'centrifugeSpeed' || row.formula === 'centrifugeTime'
    ? Math.abs(correction + u95)
    : Math.abs(correction) + Math.abs(u95);
  return {
    setting,
    mean,
    correction,
    ua,
    u95,
    tolerance,
    testValue,
    pass: testValue <= tolerance,
    readings,
  };
}

const earthLimits = [0.3, 0.2, 0.3, 0.5];
const leakageLimits = [1000, 500, 500, 100];

function atLeast(value: string, threshold: number): boolean {
  const numeric = number(value);
  if (numeric !== null) return numeric >= threshold;
  const greaterThan = String(value).match(/^>\s*(\d+(?:[.,]\d+)?)$/);
  return Boolean(greaterThan && Number(greaterThan[1].replace(',', '.')) >= threshold) || /^ol$/i.test(String(value).trim());
}

function calculateSafety(safety: SafetyData): SafetyResult {
  const voltage = number(safety.voltage);
  const earth = number(safety.earthResistance);
  const equipmentLeakage = number(safety.equipmentLeakage);
  const appliedLeakage = number(safety.appliedLeakage);
  const earthType = Number(safety.earthType) - 1;
  const leakageType = Number(safety.leakageType) - 1;
  const checks: SafetyCheck[] = [
    { label: 'Tegangan jala-jala', result: voltage === null ? null : voltage >= 198 && voltage <= 242, measured: safety.voltage, limit: '198–242 V' },
    { label: 'Resistansi pembumian protektif', result: earth === null ? null : earth <= earthLimits[earthType], measured: safety.earthResistance, limit: `${earthLimits[earthType]} Ω` },
    { label: 'Arus bocor peralatan', result: equipmentLeakage === null ? null : equipmentLeakage <= leakageLimits[leakageType], measured: safety.equipmentLeakage, limit: `${leakageLimits[leakageType]} mA` },
    { label: 'Arus bocor bagian diaplikasikan', result: safety.appliedLeakageNA ? true : appliedLeakage === null ? null : appliedLeakage <= 50, measured: safety.appliedLeakageNA ? 'Tidak berlaku' : safety.appliedLeakage, limit: '50 mA' },
    { label: 'Resistansi isolasi', result: safety.insulationResistance ? atLeast(safety.insulationResistance, 2) : null, measured: safety.insulationResistance, limit: '≥ 2 MΩ' },
  ];
  const complete = checks.every((check) => check.result !== null);
  const passed = checks.filter((check) => check.result === true).length;
  return {
    checks,
    complete,
    score: complete ? passed * 8 : null,
  };
}

export function calculateRecord(instrument: Instrument, data: CalibrationData): CalculationResult {
  const environment = calculateEnvironment(data);
  const performance = data.performance.map((row) => ({
    ...row,
    result: calculatePerformanceRow(row, data.references),
  }));
  const inspections = data.inspections.map((item) => ({
    ...item,
    complete: Boolean(item.physical && item.function),
    passed: item.physical === 'Baik' && item.function === 'Baik',
  }));
  const inspectionComplete = inspections.every((item) => item.complete);
  const inspectionRate = inspectionComplete
    ? (inspections.filter((item) => item.passed).length / inspections.length) * 100
    : null;
  const physicalScore = inspectionRate === null ? null : inspectionRate >= 70 ? instrument.score.physicalWeight : 0;
  const safety = instrument.id === 'centrifuge' ? calculateSafety(data.safety) : null;
  const performanceComplete = performance.length > 0 && performance.every((row) => row.result !== null);
  const performanceRate = performanceComplete
    ? (performance.filter((row) => row.result?.pass === true).length / performance.length) * 100
    : null;
  const performanceScore = performanceRate === null
    ? null
    : performanceRate >= instrument.score.performanceThreshold ? instrument.score.performanceWeight : 0;
  const safetyScore = safety ? safety.score : 0;
  const score = physicalScore !== null && performanceScore !== null && safetyScore !== null
    ? physicalScore + performanceScore + safetyScore
    : null;

  const missing = [];
  const identity = data.identity;
  for (const [key, label] of [
    ['labelNumber', 'Nomor label'], ['brand', 'Merek'], ['model', 'Tipe/model'],
    ['serial', 'Nomor seri'], ['technician', 'Petugas'], ['testDate', 'Tanggal pelaksanaan'],
    ['room', 'Ruang pelaksanaan'], ['customer', 'Pelanggan'], ['method', 'Metode kerja'],
  ] as [keyof CalibrationData['identity'], string][]) {
    if (!String(identity[key] || '').trim()) missing.push(label);
  }
  if (identity.testDate && !validDate(identity.testDate)) missing.push('Tanggal pelaksanaan harus valid dan berformat YYYY-MM-DD');
  if (data.selectedDevices && !data.selectedDevices.length) missing.push('Alat ukur yang digunakan');
  if (!environment.temperature || !environment.humidity) missing.push('Data suhu dan kelembaban ruangan');
  if (environment.errors.length) missing.push(...environment.errors);
  if (!inspectionComplete) missing.push('Pemeriksaan fisik dan fungsi');
  if (!performanceComplete) missing.push('Titik ukur, bacaan, dan ketidakpastian kinerja');
  if (safety && !safety.complete) missing.push('Semua pemeriksaan keselamatan listrik');
  const referenceValues = [data.references.calibratorResolution, data.references.calibratorUncertainty, data.references.uutResolution].map(number);
  const validReferenceValues = referenceValues.filter((value): value is number => value !== null);
  if (validReferenceValues.length !== 3 || validReferenceValues[0] <= 0 || validReferenceValues[1] < 0 || validReferenceValues[2] <= 0) {
    missing.push('Resolusi dan ketidakpastian standar harus valid');
  }

  return {
    environment,
    inspections,
    inspectionRate,
    physicalScore,
    performance,
    performanceRate,
    performanceScore,
    safety,
    safetyScore,
    score,
    missing: [...new Set(missing)],
    complete: missing.length === 0,
    status: missing.length ? 'BELUM LENGKAP' : score !== null && score >= 70 ? 'LAIK PAKAI DAN AMAN UNTUK DIGUNAKAN' : 'TIDAK LAIK PAKAI',
  };
}
