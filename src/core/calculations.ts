import { getInstrumentTemplateId, thermohygrometers } from './instruments';
import type {
  CalculationResult,
  CalculatedPerformance,
  CalibrationData,
  EnvironmentMeasurement,
  EnvironmentResult,
  Instrument,
  InfusionPumpData,
  MeasurementReferences,
  PerformanceEntry,
  SafetyCheck,
  SafetyData,
  SafetyResult,
  SuctionPumpData,
  SuctionPumpResult,
  SphygmomanometerConfig,
  SphygmomanometerData,
  SphygmomanometerDirectionResult,
  SphygmomanometerResult,
  ThermohygrometerPoint,
  WeighingData,
  WeighingResult,
  WeighingStandardWeight,
} from './types';

const number = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};
const positiveIdentityNumber = (value: string) => {
  const parsed = number(value.replace(/^kelas\s*/i, ''));
  return parsed !== null && parsed > 0 ? parsed : null;
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

function studentTCritical95(degreesOfFreedom: number): number {
  const z = 1.959963984540054;
  const v = degreesOfFreedom;
  return z
    + (z ** 3 + z) / (4 * v)
    + (5 * z ** 5 + 16 * z ** 3 + 3 * z) / (96 * v ** 2)
    + (3 * z ** 7 + 19 * z ** 5 + 17 * z ** 3 - 15 * z) / (384 * v ** 3)
    + (79 * z ** 9 + 776 * z ** 7 + 1482 * z ** 5 - 1920 * z ** 3 - 945 * z) / (92160 * v ** 4);
}

function calculateWeighing(instrument: Instrument, data?: WeighingData): WeighingResult | null {
  const config = instrument.weighingScale;
  if (!config) return null;
  const repeatabilityReadings = Array.isArray(data?.repeatabilityReadings) ? data.repeatabilityReadings.map((reading) => {
    const zeroReading = number(reading.zeroReading);
    const indication = number(reading.indication);
    return { zeroReading, indication, difference: zeroReading === null || indication === null ? null : indication - zeroReading };
  }) : [];
  const repeatedReadings = repeatabilityReadings.map((reading) => reading.difference);
  const repeatabilityComplete = repeatabilityReadings.length === 10 && repeatabilityReadings.every((reading) => reading.zeroReading !== null && reading.indication !== null);
  const validRepeatedReadings = repeatedReadings.filter((value): value is number => value !== null);
  const inputPoints = Array.isArray(data?.points) ? data.points : [];
  const points = config.points.map((setting) => {
    const input = inputPoints.find((point) => point.id === setting.id);
    const zeroReading = number(input?.zeroReading);
    const indication = number(input?.indication);
    const weights = Array.isArray(input?.standardWeights) ? input.standardWeights : [];
    const validWeights = weights.filter((weight): weight is WeighingStandardWeight => Boolean(weight && typeof weight.serial === 'string' && typeof weight.name === 'string'
      && typeof weight.brand === 'string' && typeof weight.model === 'string'
      && weight.serial.trim() && weight.name.trim() && weight.brand.trim() && weight.model.trim()
      && Number.isFinite(weight.nominalKg) && weight.nominalKg > 0
      && Number.isFinite(weight.uncertaintyU95G) && weight.uncertaintyU95G >= 0
      && Number.isFinite(weight.conventionalMass2025G) && weight.conventionalMass2025G > 0
      && Number.isFinite(weight.conventionalMass2026G) && weight.conventionalMass2026G > 0));
    const weightDataComplete = weights.length > 0 && validWeights.length === weights.length;
    const nominalLoadKg = validWeights.reduce((sum, weight) => sum + weight.nominalKg, 0);
    const weightsComplete = weightDataComplete && new Set(validWeights.map((weight) => weight.serial)).size === validWeights.length
      && Math.abs(nominalLoadKg - setting.loadKg) < 1e-6;
    const referenceMassKg = weightDataComplete ? validWeights.reduce((sum, weight) => sum + weight.conventionalMass2026G / 1000, 0) : null;
    const certificateU95G = validWeights.reduce((sum, weight) => sum + weight.uncertaintyU95G, 0);
    const driftG = validWeights.reduce((sum, weight) => sum + (0.5 * (weight.conventionalMass2026G - weight.conventionalMass2025G)) / Math.sqrt(3), 0);
    const uResolution = (0.5 * config.resolutionKg) / Math.sqrt(config.resolutionDivisor);
    const uRepeatability = (0.5 * config.resolutionKg) / 2;
    const uCertificate = (certificateU95G / 2) / 1000;
    const uDrift = (driftG / Math.sqrt(3)) / 1000;
    const components = [uResolution, uRepeatability, uCertificate, uDrift];
    const variance = components.reduce((sum, component) => sum + component ** 2, 0);
    const dofDenominator = components.reduce((sum, component) => sum + component ** 4 / 50, 0);
    const effectiveDof = dofDenominator > 0 ? variance ** 2 / dofDenominator : Number.POSITIVE_INFINITY;
    const uncertaintyU95Kg = weightDataComplete ? Math.sqrt(variance) * studentTCritical95(effectiveDof) : null;
    const complete = weightsComplete && zeroReading !== null && indication !== null;
    return {
      id: setting.id,
      loadKg: setting.loadKg,
      zeroReading,
      indication,
      standardWeightSerials: validWeights.map((weight) => weight.serial),
      standardWeightsComplete: weightsComplete,
      referenceMassKg,
      correction: indication === null || referenceMassKg === null ? null : indication - referenceMassKg,
      uncertaintyU95Kg,
      complete,
    };
  });
  const complete = repeatabilityComplete && points.length === config.points.length && points.every((point) => point.complete);
  const maxAbsoluteCorrection = complete ? Math.max(...points.map((point) => Math.abs(point.correction ?? 0))) : null;
  const maxUncertaintyU95 = complete ? Math.max(...points.map((point) => point.uncertaintyU95Kg ?? 0)) : null;
  const lop = maxAbsoluteCorrection === null || maxUncertaintyU95 === null ? null : maxAbsoluteCorrection + maxUncertaintyU95;
  return {
    repeatabilityMean: repeatabilityComplete ? average(validRepeatedReadings) : null,
    repeatabilityStandardDeviation: repeatabilityComplete ? sampleStandardDeviation(validRepeatedReadings) : null,
    reportStandardDeviation: Math.sqrt(2 / 3) * (0.5 * config.resolutionKg),
    repeatabilityReadings,
    points,
    maxAbsoluteCorrection,
    maxUncertaintyU95,
    lop,
    limit: 10 * config.resolutionKg,
    pass: lop === null ? null : lop <= 10 * config.resolutionKg,
    complete,
  };
}

function interpolatePressureCorrection(value: number, config: SphygmomanometerConfig, direction: 'up' | 'down'): number | null {
  const table = config.dpmCorrections;
  if (value < table[0].pressure || value > table[table.length - 1].pressure) return null;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (value <= upper.pressure) {
      const portion = (value - lower.pressure) / (upper.pressure - lower.pressure);
      return lower[direction] + portion * (upper[direction] - lower[direction]);
    }
  }
  return table[table.length - 1][direction];
}

function calculateSphygmomanometer(config: SphygmomanometerConfig, data: SphygmomanometerData | undefined, standardValid: boolean): SphygmomanometerResult {
  const leakageDrop = number(data?.leakageDrop);
  const rapidDeflationSeconds = number(data?.rapidDeflationSeconds);
  const pressureReadings = config.pressurePoints.map((setting) => {
    const input = data?.pressureReadings.find((item) => item.setting === setting);
    const calculateDirection = (direction: 'up' | 'down'): SphygmomanometerDirectionResult => {
      const readings = (input?.[direction] ?? []).map(number);
      const corrections = readings.map((reading) => reading === null ? null : interpolatePressureCorrection(reading, config, direction));
      const correctedReadings = readings.map((reading, index) => reading === null || corrections[index] === null ? null : reading + corrections[index]!);
      const complete = readings.length === 3 && readings.every((reading) => reading !== null)
        && correctedReadings.every((reading) => reading !== null);
      const drift = config.drift.find((item) => item.pressure === setting)?.[direction];
      if (!complete || drift === undefined) return {
        readings, correctedReadings, mean: null, standardDeviation: null, correction: null,
        uncertaintyU95: null, decisionValue: null, complete: false, pass: null,
      };
      if (!standardValid) return {
        readings, correctedReadings: readings.map(() => null), mean: null, standardDeviation: null,
        correction: null, uncertaintyU95: null, decisionValue: null, complete: true, pass: null,
      };
      const validReadings = correctedReadings as number[];
      const mean = average(validReadings);
      const standardDeviation = sampleStandardDeviation(validReadings);
      const components = [
        (0.5 * config.accuracyClass) / Math.sqrt(6),
        standardDeviation / Math.sqrt(3),
        drift / Math.sqrt(3),
        config.dpmU95 / 2,
      ];
      const variance = components.reduce((sum, component) => sum + component ** 2, 0);
      const dofDenominator = components.reduce((sum, component, index) => sum + component ** 4 / [50, 5, 50, 50][index], 0);
      const effectiveDof = variance ** 2 / dofDenominator;
      const uncertaintyU95 = Math.max(studentTCritical95(effectiveDof) * Math.sqrt(variance), 0.99);
      const correction = setting - mean;
      const decisionValue = Math.abs(correction) + uncertaintyU95;
      return {
        readings, correctedReadings, mean, standardDeviation, correction, uncertaintyU95,
        decisionValue, complete: true, pass: decisionValue <= 4,
      };
    };
    return { setting, up: calculateDirection('up'), down: calculateDirection('down') };
  });
  const complete = leakageDrop !== null && rapidDeflationSeconds !== null
    && pressureReadings.length === config.pressurePoints.length
    && pressureReadings.every((point) => point.up.complete && point.down.complete) && standardValid;
  return {
    leakageDrop: { value: leakageDrop, pass: leakageDrop === null ? null : leakageDrop <= 15 },
    rapidDeflationSeconds: { value: rapidDeflationSeconds, pass: rapidDeflationSeconds === null ? null : rapidDeflationSeconds <= 10 },
    pressureReadings,
    complete,
  };
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

function calculatePerformanceRow(row: PerformanceEntry, references: MeasurementReferences, allRows: PerformanceEntry[]): CalculatedPerformance | null {
  if (row.formula.startsWith('workbook')) return calculateWorkbookPerformanceRow(row, references, allRows);
  const setting = number(row.setting);
  const parsedReadings = row.readings.map(number);
  const referenceValues = [references.calibratorResolution, references.calibratorUncertainty, references.uutResolution].map(number);
  const tolerancePercent = row.formula === 'flowmeter' ? 20 : number(row.tolerancePercent);
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

  const ua = sampleStandardDeviation(readings) / Math.sqrt(readings.length);
  const calibratorUncertainty = parsedReferences[1] / 2;
  const uutResolutionUncertainty = (parsedReferences[2] / 2) / Math.sqrt(3);
  const calibratorResolutionUncertainty = (parsedReferences[0] / 2) / Math.sqrt(3);
  const u95 = Math.sqrt(ua ** 2 + calibratorUncertainty ** 2 + uutResolutionUncertainty ** 2 + calibratorResolutionUncertainty ** 2) * 2;
  const tolerance = row.formula === 'fetalHeartRate' ? tolerancePercent : setting * (tolerancePercent / 100);
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

function calculateWorkbookPerformanceRow(row: PerformanceEntry, defaults: MeasurementReferences, allRows: PerformanceEntry[]): CalculatedPerformance | null {
  const formula = row.formula;
  const setting = number(row.setting);
  if (formula === 'workbookRange') {
    const sources = (row.sourceIds ?? []).map((id) => allRows.find((item) => item.id === id));
    const values = sources.flatMap((source) => source
      ? [...source.readings, ...(source.pairedReadings ?? [])].map(number)
      : []);
    const tolerance = number(row.absoluteTolerance);
    if (setting === null || sources.length === 0 || sources.some((source) => !source || source.readings.length !== source.count
      || source.readings.some((value) => number(value) === null)
      || source.formula === 'workbookPairedAccuracy' && (!source.pairedReadings || source.pairedReadings.length !== source.count
        || source.pairedReadings.some((value) => number(value) === null)))
      || values.length === 0 || values.some((value) => value === null) || tolerance === null) return null;
    const numericValues = values as number[];
    const range = Math.max(...numericValues) - Math.min(...numericValues);
    return { setting, mean: range, correction: range, ua: 0, u95: 0, tolerance, testValue: range, pass: range <= tolerance, readings: numericValues };
  }
  const readings = row.readings.map(number);
  const standardReadings = row.standardReadings?.map(number);
  const pairedReadings = row.pairedReadings?.map(number);
  const isComparison = formula === 'workbookComparisonAccuracy';
  const isPaired = formula === 'workbookPairedAccuracy';
  const referenceValues = [row.references ?? defaults].flatMap((reference) => [
    reference.calibratorResolution, reference.calibratorUncertainty, reference.uutResolution,
  ]).map(number);
  if (setting === null || row.count < 1 || row.readings.length !== row.count
    || readings.some((value) => value === null)) return null;
  if (isComparison && (!standardReadings || standardReadings.length !== row.count || standardReadings.some((value) => value === null))) return null;
  if (isPaired && (!pairedReadings || pairedReadings.length !== row.count || pairedReadings.some((value) => value === null))) return null;

  const minimum = number(row.minimumSetting);
  const maximum = number(row.maximumSetting);
  if (formula === 'workbookBand' && (minimum === null || maximum === null || minimum > maximum)) return null;
  const useUncertainty = row.includeUncertainty !== false;
  const parsedReferences = referenceValues.filter((value): value is number => value !== null);
  if (useUncertainty && (parsedReferences.length !== 3 || parsedReferences[0] <= 0 || parsedReferences[1] < 0 || parsedReferences[2] <= 0)) return null;

  const primaryReadings = readings as number[];
  const pairedValues = pairedReadings as number[] | undefined;
  const samples = isPaired ? primaryReadings.map((value, index) => (value + pairedValues![index]) / 2) : primaryReadings;
  const mean = average(samples);
  const ua = samples.length > 1 ? sampleStandardDeviation(samples) / Math.sqrt(samples.length) : 0;
  const uncertaintyFor = (repeatability: number): number => {
    if (!useUncertainty) return 0;
    const [calibratorResolution, calibratorUncertainty, uutResolution] = parsedReferences;
    const components = [
      repeatability,
      calibratorUncertainty / 2,
      (uutResolution / 2) / Math.sqrt(3),
      (calibratorResolution / 2) / Math.sqrt(3),
    ];
    return Math.sqrt(components.reduce((sum, component) => sum + component ** 2, 0)) * 2;
  };
  const u95 = uncertaintyFor(ua);
  const correction = mean - setting;
  const configuredTolerance = row.toleranceBySetting?.find((item) => Number(item.setting) === setting);
  const absoluteTolerance = number(configuredTolerance?.tolerance ?? row.absoluteTolerance) ?? 0;
  const tolerancePercent = number(row.tolerancePercent) ?? 0;
  const tolerance = formula === 'workbookMinimum' || formula === 'workbookMaximum'
    ? setting
    : formula === 'workbookBand'
      ? (maximum! - minimum!) / 2
      : Math.max(absoluteTolerance, Math.abs(setting) * tolerancePercent / 100);
  let testValue = row.uncertaintyRule === 'signed' ? Math.abs(correction + u95) : Math.abs(correction) + u95;
  let pass = testValue <= tolerance;
  if (formula === 'workbookMinimum') {
    testValue = mean - u95;
    pass = testValue >= setting;
  } else if (formula === 'workbookMaximum') {
    testValue = mean + u95;
    pass = testValue <= setting;
  } else if (formula === 'workbookBand') {
    testValue = mean;
    pass = mean - u95 >= minimum! && mean + u95 <= maximum!;
  }

  let standardMean: number | undefined;
  let standardU95: number | undefined;
  let standardPass: boolean | undefined;
  let uutPass: boolean | undefined;
  if (isComparison) {
    const standardValues = standardReadings as number[];
    standardMean = average(standardValues);
    const standardUa = standardValues.length > 1 ? sampleStandardDeviation(standardValues) / Math.sqrt(standardValues.length) : 0;
    standardU95 = uncertaintyFor(standardUa);
    uutPass = pass;
    standardPass = (row.uncertaintyRule === 'signed'
      ? Math.abs(standardMean - setting + standardU95)
      : Math.abs(standardMean - setting) + standardU95) <= tolerance;
    pass = pass && standardPass;
  }
  return {
    setting, mean, correction, ua, u95, tolerance, testValue, pass,
    readings: primaryReadings, ...(standardMean === undefined ? {} : { standardMean, standardU95, standardPass, uutPass }),
  };
}

const pumpFlowChannels = {
  'Channel 1': {
    flow: [-0.0044382463855594, -0.6893402184501818], occlusion: [0.0007131474999683357, -0.32276291846077326],
    drift: [[5, 0.32], [10, 0.21], [50, 1.11], [100, 1.1], [300, 7.83]],
  },
  'Channel 2': {
    flow: [-0.008489446490550527, -0.9974586654622964], occlusion: [0.0007349966213253538, -0.19390370130089055],
    drift: [[5, 0.09], [10, 0.3], [50, 0.64], [100, 3.63], [300, 1.72]],
  },
  'Channel 3': {
    flow: [-0.021639410741783483, 0.031476368066201355], occlusion: [0.000803253772109678, -0.02413768438734311],
    drift: [[5, 0.32], [10, 0.02], [50, 0.77], [100, 0.35], [300, 7.83]],
  },
} as const;
const pumpFlowCertificateU95 = [[10, 0.11], [25, 0.25625], [50, 0.5], [75, 0.75], [100, 1], [150, 1.55], [300, 3.2]] as const;

function interpolateTable(value: number, table: readonly (readonly [number, number])[]): number | null {
  if (value < table[0][0] || value > table[table.length - 1][0]) return null;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (value <= upper[0]) return lower[1] + ((value - lower[0]) / (upper[0] - lower[0])) * (upper[1] - lower[1]);
  }
  return table[table.length - 1][1];
}

function expandedUncertainty(components: number[], reliabilities: number[]): number {
  const variance = components.reduce((sum, component) => sum + component ** 2, 0);
  const denominator = components.reduce((sum, component, index) => sum + component ** 4 / reliabilities[index], 0);
  const effectiveDof = denominator ? variance ** 2 / denominator : Number.POSITIVE_INFINITY;
  return Math.sqrt(variance) * studentTCritical95(effectiveDof);
}

function calculatePumpFlow(row: PerformanceEntry, channel: string): CalculatedPerformance | null {
  const setting = number(row.setting);
  const readings = row.readings.map(number);
  const profile = pumpFlowChannels[channel as keyof typeof pumpFlowChannels];
  if (!profile || setting === null || setting <= 0 || readings.length !== 6 || readings.some((reading) => reading === null)) return null;
  const values = readings as number[];
  const mean = average(values);
  const drift = interpolateTable(setting, profile.drift);
  const certificateU95 = interpolateTable(setting, pumpFlowCertificateU95);
  if (drift === null || certificateU95 === null) return null;
  const correction = profile.flow[1] + profile.flow[0] * mean;
  const correctedMean = mean + correction;
  const error = correctedMean - setting;
  const standardDeviation = sampleStandardDeviation(values);
  const ua = standardDeviation / Math.sqrt(3);
  const u95 = expandedUncertainty([
    0.01 / Math.sqrt(3), ua, drift / Math.sqrt(3), certificateU95 / 2,
  ], [50, 2, 50, 50]);
  const tolerance = 0.1;
  const testValue = Math.abs(error / setting);
  return { setting, mean, correction, correctedMean, error, ua, u95, tolerance, testValue, pass: testValue <= tolerance, readings: values };
}

function calculatePumpOcclusion(input: InfusionPumpData | undefined, limit: number): CalculationResult['pumpOcclusion'] {
  if (!input || input.occlusionReadings.length !== 6) return null;
  const profile = pumpFlowChannels[input.channel as keyof typeof pumpFlowChannels];
  const readings = input.occlusionReadings.map(number);
  if (!profile || readings.some((reading) => reading === null)) return null;
  const values = readings as number[];
  const mean = average(values);
  const correction = profile.occlusion[1] + profile.occlusion[0] * mean;
  const correctedMean = mean + correction;
  const uncertaintyU95 = expandedUncertainty([
    0.01 / Math.sqrt(3), sampleStandardDeviation(values) / Math.sqrt(3), 0.012 / 2,
  ], [50, 2, 50]);
  return { mean, correction, correctedMean, uncertaintyU95, limit, pass: mean <= limit, readings: values };
}

const suctionDrift = {
  up: [[0, 0.02], [100, 0.82], [200, 0.12], [300, 0.42], [400, 0.12], [500, 0.22], [600, 0.72]],
  down: [[0, 0.02], [100, 0.52], [200, 0.08], [300, 0.32], [400, 0.12], [500, 0.42], [600, 0.72]],
} as const;

function calculateSuctionPump(config: NonNullable<Instrument['suctionPump']>, data: SuctionPumpData | undefined, standardValid: boolean): SuctionPumpResult {
  const legacy = Boolean(data?.pressureReadings.some((point) => !config.pressurePoints.includes(point.setting)));
  const settings = legacy ? (data?.pressureReadings ?? []).map((point) => point.setting) : config.pressurePoints;
  const repeatCount = legacy ? 3 : 6;
  const pressureReadings = settings.map((setting) => {
    const input = data?.pressureReadings.find((point) => point.setting === setting);
    const calculateDirection = (direction: 'up' | 'down') => {
      const readings = (input?.[direction] ?? []).map(number);
      if (!standardValid || readings.length !== repeatCount || readings.some((value) => value === null)) return null;
      const values = readings as number[];
      const mean = average(values);
      const signedMean = -mean;
      const drift = interpolateTable(Math.abs(setting), suctionDrift[direction]);
      if (drift === null) return null;
      const slope = direction === 'up' ? 0.003441823675411558 : 0.003504637540282135;
      const intercept = direction === 'up' ? 0.2940836678821175 : 0.3211573395802835;
      const correction = intercept + slope * signedMean;
      const correctedMean = signedMean + correction;
      const error = correctedMean - setting;
      const ua = sampleStandardDeviation(values) / Math.sqrt(values.length);
      const uncertaintyU95 = expandedUncertainty([
        (20 * 0.5 / 3) / Math.sqrt(6), ua, drift / Math.sqrt(3), 0.31 / 2,
      ], [50, 2, 50, 50]);
      return { readings: values, mean, correction, correctedMean, error, uncertaintyU95, pass: Math.abs(error / setting) <= 0.1 };
    };
    return { setting, up: calculateDirection('up'), down: calculateDirection('down') };
  });
  const maximumVacuumReading = number(data?.maximumVacuumReading);
  const maximumVacuumSeconds = number(data?.maximumVacuumSeconds);
  const complete = standardValid && maximumVacuumReading !== null && maximumVacuumSeconds !== null
    && pressureReadings.every((point) => point.up !== null && point.down !== null);
  return {
    pressureReadings,
    maximumVacuumReading,
    maximumVacuumReadingPass: maximumVacuumReading === null ? null : legacy
      ? Math.abs(maximumVacuumReading) >= 300
      : Math.abs(maximumVacuumReading) >= config.minimumVacuumMmHg && Math.abs(maximumVacuumReading) <= config.maximumVacuumMmHg,
    maximumVacuumSeconds,
    maximumVacuumPass: maximumVacuumSeconds === null ? null : maximumVacuumSeconds <= 10,
    complete,
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
  const templateId = getInstrumentTemplateId(instrument);
  const capacity = positiveIdentityNumber(data.identity.capacity);
  const accuracy = positiveIdentityNumber(data.identity.accuracy);
  const calculationInstrument = instrument.weighingScale
    ? { ...instrument, weighingScale: { ...instrument.weighingScale, resolutionKg: accuracy ?? instrument.weighingScale.resolutionKg } }
    : instrument.sphygmomanometer
      ? { ...instrument, sphygmomanometer: { ...instrument.sphygmomanometer, accuracyClass: accuracy ?? instrument.sphygmomanometer.accuracyClass } }
      : instrument;
  const environment = calculateEnvironment(data);
  const weighing = calculateWeighing(calculationInstrument, data.weighing);
  const dpmSerial = instrument.standards.find(([name]) => name.toLowerCase() === 'digital pressure meter')?.[3];
  const selectedDpm = data.selectedDevices?.find((device) => device.name.toLowerCase() === 'digital pressure meter');
  const dpmStandardValid = data.selectedDevices === undefined || selectedDpm?.serial === dpmSerial;
  const pumpAnalyzerSerial = instrument.standards.find(([name]) => name === 'Infusion Device Analyzer')?.[3];
  const selectedPumpAnalyzer = data.selectedDevices?.find((device) => device.name === 'Infusion Device Analyzer');
  const pumpAnalyzerValid = data.selectedDevices === undefined || selectedPumpAnalyzer?.serial === pumpAnalyzerSerial;
  const sphygmomanometer = calculationInstrument.sphygmomanometer
    ? calculateSphygmomanometer(calculationInstrument.sphygmomanometer, data.sphygmomanometer, dpmStandardValid)
    : null;
  const performance = data.performance.map((row) => ({
    ...row,
    result: row.formula === 'infusionFlow'
      ? pumpAnalyzerValid ? calculatePumpFlow(row, data.infusionPump?.channel ?? '') : null
      : calculatePerformanceRow(row, data.references, data.performance),
  }));
  const infusionPump = templateId === 'infusion-pump' || templateId === 'syringe-pump';
  const pumpOcclusion = infusionPump && pumpAnalyzerValid ? calculatePumpOcclusion(data.infusionPump, templateId === 'syringe-pump' ? 21 : 20) : null;
  const suctionDpmSerial = instrument.suctionPump ? dpmSerial : undefined;
  const suctionDpmValid = data.selectedDevices === undefined || Boolean(selectedDpm && selectedDpm.serial === suctionDpmSerial);
  const suctionPump = instrument.suctionPump ? calculateSuctionPump(instrument.suctionPump, data.suctionPump, suctionDpmValid) : null;
  const inspections = data.inspections.map((item) => ({
    ...item,
    complete: Boolean(item.physical && item.function),
    passed: item.physical === 'Baik' && item.function === 'Baik',
  }));
  const inspectionComplete = inspections.every((item) => item.complete);
  const inspectionRate = inspectionComplete
    ? weighing
      ? (inspections.reduce((sum, item) => sum + Number(item.physical === 'Baik') + Number(item.function === 'Baik'), 0) / (inspections.length * 2)) * 100
      : (inspections.filter((item) => item.passed).length / inspections.length) * 100
    : null;
  const physicalScore = inspectionRate === null
    ? null
    : weighing ? (inspectionRate / 100) * instrument.score.physicalWeight : inspectionRate >= 70 ? instrument.score.physicalWeight : 0;
  const safety = instrument.electricalSafety || ['centrifuge', 'infusion-pump', 'syringe-pump', 'suction-pump'].includes(templateId) ? calculateSafety(data.safety) : null;
  const performanceComplete = weighing ? weighing.complete : sphygmomanometer ? sphygmomanometer.complete
    : suctionPump ? suctionPump.complete
      : infusionPump ? performance.length > 0 && performance.every((row) => row.result !== null) && pumpOcclusion !== null
        : performance.length > 0 && performance.every((row) => row.result !== null);
  const scoredPerformance = performance.filter((row) => row.includeInScore !== false);
  const performanceOutcomeCount = scoredPerformance.reduce((sum, row) => sum + (row.result ? 1 + Number(row.result.standardPass !== undefined) : 0), 0);
  const performancePassCount = scoredPerformance.reduce((sum, row) => sum + (row.result
    ? row.result.standardPass === undefined ? Number(row.result.pass) : Number(row.result.uutPass) + Number(row.result.standardPass)
    : 0), 0);
  const performanceRate = weighing
    ? weighing.pass === null ? null : weighing.pass ? 100 : 0
    : sphygmomanometer
      ? sphygmomanometer.complete
        ? ((Number(sphygmomanometer.leakageDrop.pass) * 30
          + Number(sphygmomanometer.rapidDeflationSeconds.pass) * 30
          + sphygmomanometer.pressureReadings.reduce((sum, point) => sum + Number(point.up.pass), 0) * 15 / 6
          + sphygmomanometer.pressureReadings.reduce((sum, point) => sum + Number(point.down.pass), 0) * 15 / 6) / 90) * 100
        : null
      : infusionPump
        ? performanceComplete ? ((performance.filter((row) => row.result?.pass).length / performance.length) * 100 + Number(pumpOcclusion?.pass) * 100) / 2 : null
      : suctionPump
        ? performanceComplete ? (suctionPump.pressureReadings.reduce((sum, point) => sum + Number(point.up?.pass) + Number(point.down?.pass), 0) / (suctionPump.pressureReadings.length * 2)) * 100 : null
    : performanceComplete && performanceOutcomeCount > 0 ? (performancePassCount / performanceOutcomeCount) * 100 : null;
  const performanceScore = weighing
    ? weighing.pass === null ? null : weighing.pass ? instrument.score.performanceWeight : 0
    : sphygmomanometer
      ? performanceRate === null ? null : performanceRate * instrument.score.performanceWeight / 100
    : infusionPump
      ? performanceRate === null ? null : performanceRate >= instrument.score.performanceThreshold ? instrument.score.performanceWeight : 0
    : suctionPump
      ? performanceComplete ? performanceRate === 100 && suctionPump.maximumVacuumPass ? instrument.score.performanceWeight : 0 : null
    : instrument.score.performanceWeight === 0 ? performanceComplete ? 0 : null
      : performanceRate === null ? null : performanceRate >= instrument.score.performanceThreshold ? instrument.score.performanceWeight : 0;
  const safetyScore = safety ? safety.score : 0;
  const score = physicalScore !== null && performanceScore !== null && safetyScore !== null
    ? physicalScore + performanceScore + safetyScore
    : null;

  const missing = [];
  const identity = data.identity;
  if (instrument.weighingScale || instrument.sphygmomanometer) {
    if (capacity === null) missing.push('Kapasitas harus berupa angka lebih dari 0');
    if (accuracy === null) missing.push('Tingkat ketelitian harus berupa angka lebih dari 0');
  }
  for (const [key, label] of [
    ['labelNumber', 'Nomor label'], ['brand', 'Merek'], ['model', 'Tipe/model'],
    ['serial', 'Nomor seri'], ['technician', 'Petugas'], ['testDate', 'Tanggal pelaksanaan'],
    ['room', 'Ruang pelaksanaan'], ['customer', 'Pelanggan'], ['method', 'Metode kerja'],
  ] as [keyof CalibrationData['identity'], string][]) {
    if (!String(identity[key] || '').trim()) missing.push(label);
  }
  if (identity.testDate && !validDate(identity.testDate)) missing.push('Tanggal pelaksanaan harus valid dan berformat YYYY-MM-DD');
  const selectedStandardNames = new Set((data.selectedDevices?.map((device) => device.name) ?? instrument.standards.map(([name]) => name))
    .map((name) => name.trim().toLowerCase()));
  for (const [name] of instrument.standards) {
    if (!selectedStandardNames.has(name.trim().toLowerCase())) missing.push(`Standar wajib: ${name}`);
  }
  if (sphygmomanometer && data.selectedDevices && dpmSerial) {
    if (!selectedDpm) missing.push(`Pilih Digital Pressure Meter dengan nomor seri ${dpmSerial} agar koreksinya sesuai sertifikat.`);
    else if (selectedDpm.serial !== dpmSerial) {
      missing.push(`Digital Pressure Meter ${selectedDpm.serial} tidak cocok dengan kurva sertifikat ${dpmSerial} pada workbook.`);
    }
  }
  if (infusionPump && data.selectedDevices) {
    if (!selectedPumpAnalyzer) missing.push(`Pilih Infusion Device Analyzer dengan nomor seri ${pumpAnalyzerSerial}.`);
    else if (selectedPumpAnalyzer.serial !== pumpAnalyzerSerial) missing.push(`Kurva koreksi hanya tersedia untuk Infusion Device Analyzer ${pumpAnalyzerSerial}.`);
  }
  if (instrument.suctionPump && data.selectedDevices && suctionDpmSerial) {
    if (!selectedDpm) missing.push(`Pilih Digital Pressure Meter dengan nomor seri ${suctionDpmSerial}.`);
    else if (selectedDpm.serial !== suctionDpmSerial) missing.push(`Kurva koreksi hanya tersedia untuk Digital Pressure Meter ${suctionDpmSerial}.`);
  }
  if (!environment.temperature || !environment.humidity) missing.push('Data suhu dan kelembaban ruangan');
  if (environment.errors.length) missing.push(...environment.errors);
  if (!inspectionComplete) missing.push('Pemeriksaan fisik dan fungsi');
  if (weighing) {
    if (weighing.repeatabilityMean === null) missing.push('10 bacaan uji berulang timbangan');
    for (const point of weighing.points) {
      if (!point.standardWeightsComplete) missing.push(`Pilih anak timbangan dengan total ${point.loadKg} kg`);
      if (point.zeroReading === null || point.indication === null) missing.push(`Bacaan nol dan penunjukan untuk beban ${point.loadKg} kg`);
    }
  } else if (sphygmomanometer) {
    if (sphygmomanometer.leakageDrop.value === null) missing.push('Penurunan tekanan pada uji kebocoran');
    if (sphygmomanometer.rapidDeflationSeconds.value === null) missing.push('Waktu deflasi cepat');
    for (const point of sphygmomanometer.pressureReadings) {
      if (!point.up.complete) missing.push(`3 bacaan DPM arah naik pada ${point.setting} mmHg (rentang 0–300 mmHg)`);
      if (!point.down.complete) missing.push(`3 bacaan DPM arah turun pada ${point.setting} mmHg (rentang 0–300 mmHg)`);
    }
  } else if (instrument.suctionPump) {
    if (suctionPump?.maximumVacuumReading === null) missing.push('Bacaan tekanan daya hisap maksimum');
    else if (suctionPump?.maximumVacuumReadingPass === false) missing.push(data.suctionPump?.pressureReadings.some((point) => point.up.length === 3)
      ? 'Daya hisap maksimum harus mencapai minimal 300 mmHg'
      : `Daya hisap maksimum harus berada pada ${instrument.suctionPump.minimumVacuumMmHg}–${instrument.suctionPump.maximumVacuumMmHg} mmHg`);
    if (suctionPump?.maximumVacuumSeconds === null) missing.push('Waktu mencapai vakum maksimum yang valid');
    const legacy = data.suctionPump?.pressureReadings.some((point) => point.up.length === 3) ?? false;
    const repeatCount = legacy ? 3 : 6;
    for (const point of suctionPump?.pressureReadings ?? []) {
      const input = data.suctionPump?.pressureReadings.find((item) => item.setting === point.setting);
      if (!input || input.up.length !== repeatCount || input.up.some((value) => number(value) === null)) missing.push(`${repeatCount} bacaan DPM arah naik pada ${point.setting} mmHg`);
      if (!input || input.down.length !== repeatCount || input.down.some((value) => number(value) === null)) missing.push(`${repeatCount} bacaan DPM arah turun pada ${point.setting} mmHg`);
    }
  } else if (infusionPump) {
    if (!data.infusionPump?.channel) missing.push('Channel Infusion Device Analyzer');
    if (!data.infusionPump?.occlusionReadings.every((value) => number(value) !== null)) missing.push('6 bacaan uji occlusion');
    if (performance.some((row) => row.result === null)) missing.push('Bacaan laju aliran pada seluruh titik ukur');
  } else if (!performanceComplete) missing.push('Titik ukur, bacaan, dan ketidakpastian kinerja');
  if (safety && !safety.complete) missing.push('Semua pemeriksaan keselamatan listrik');
  if (templateId === 'fetal-doppler') {
    const safetyMeasurements: [string, string][] = [
      [data.safety.voltage, 'Tegangan jala-jala'],
      [data.safety.earthResistance, 'Resistansi pembumian protektif'],
      [data.safety.equipmentLeakage, 'Arus bocor peralatan'],
      [data.safety.appliedLeakage, 'Arus bocor bagian yang diaplikasikan'],
      [data.safety.insulationResistance, 'Resistansi isolasi'],
    ];
    safetyMeasurements.forEach(([value, label]) => {
      const valid = label === 'Resistansi isolasi'
        ? value.trim().toUpperCase() === 'OL' || number(value) !== null
        : number(value) !== null;
      if (!valid) missing.push(label);
    });
    if (!data.safety.earthMeets || !data.safety.equipmentLeakageMeets
      || !data.safety.appliedLeakageMeets || !data.safety.insulationMeets) {
      missing.push('Status memenuhi pada pemeriksaan keselamatan listrik');
    }
  }
  const referenceValues = [data.references.calibratorResolution, data.references.calibratorUncertainty, data.references.uutResolution].map(number);
  const validReferenceValues = referenceValues.filter((value): value is number => value !== null);
  if (!weighing && !sphygmomanometer && !infusionPump && !instrument.suctionPump && (validReferenceValues.length !== 3 || validReferenceValues[0] <= 0 || validReferenceValues[1] < 0 || validReferenceValues[2] <= 0)) {
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
    weighing,
    sphygmomanometer,
    pumpOcclusion,
    suctionPump,
    safety,
    safetyScore,
    score,
    missing: [...new Set(missing)],
    complete: missing.length === 0,
    status: missing.length ? 'BELUM LENGKAP' : score !== null && score >= 70 ? 'LAIK PAKAI DAN AMAN UNTUK DIGUNAKAN' : 'TIDAK LAIK PAKAI',
  };
}
