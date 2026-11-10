import { getInstrumentTemplateId, thermohygrometers } from './instruments';
import { evaluateFormulaExpression } from './formulaExpressions';
import { defaultElectricalSafetyConfig, defaultEnvironmentExpressions } from './methodFormulas';
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

function numericFormula(expressions: Record<string, string> | undefined, key: string, fallback: string, variables: Record<string, number>): number | null {
  try {
    const value = evaluateFormulaExpression(expressions?.[key] ?? fallback, variables);
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function booleanFormula(expressions: Record<string, string> | undefined, key: string, fallback: string, variables: Record<string, number>): boolean | null {
  try {
    const value = evaluateFormulaExpression(expressions?.[key] ?? fallback, variables);
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

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
  const expressions = instrument.formulaExpressions;
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
    const sumMass2026G = validWeights.reduce((sum, weight) => sum + weight.conventionalMass2026G, 0);
    const certificateU95G = validWeights.reduce((sum, weight) => sum + weight.uncertaintyU95G, 0);
    const sumDriftDeltaG = validWeights.reduce((sum, weight) => sum + weight.conventionalMass2026G - weight.conventionalMass2025G, 0);
    const referenceMassKg = weightDataComplete ? numericFormula(expressions, 'weighing.referenceMass', 'sumMass2026G / 1000', { sumMass2026G }) : null;
    const uResolution = numericFormula(expressions, 'weighing.uResolution', '(0.5 * d) / sqrt(resolutionDivisor)', { d: config.resolutionKg, resolutionDivisor: config.resolutionDivisor });
    const uRepeatability = numericFormula(expressions, 'weighing.uRepeatability', '(0.5 * d) / 2', { d: config.resolutionKg });
    const uCertificate = numericFormula(expressions, 'weighing.uCertificate', '(sumCertificateU95G / 2) / 1000', { sumCertificateU95G: certificateU95G });
    const uDrift = numericFormula(expressions, 'weighing.uDrift', '(0.5 * sumDriftDeltaG / sqrt(3) / sqrt(3)) / 1000', { sumDriftDeltaG });
    const uncertaintyVariables = { uResolution: uResolution ?? 0, uRepeatability: uRepeatability ?? 0, uCertificate: uCertificate ?? 0, uDrift: uDrift ?? 0 };
    const components = [uResolution, uRepeatability, uCertificate, uDrift];
    const variance = components.reduce<number>((sum, component) => sum + (component ?? 0) ** 2, 0);
  const dofDenominator = components.reduce<number>((sum, component, index) => sum + (component ?? 0) ** 4 / config.degreesOfFreedom[index], 0);
    const effectiveDof = dofDenominator > 0 ? variance ** 2 / dofDenominator : Number.POSITIVE_INFINITY;
    const k95 = studentTCritical95(effectiveDof);
    const uncertaintyU95Kg = weightDataComplete && components.every((value) => value !== null && value >= 0)
      ? numericFormula(expressions, 'weighing.u95', 'sqrt(uResolution^2 + uRepeatability^2 + uCertificate^2 + uDrift^2) * k95', { ...uncertaintyVariables, k95 })
      : null;
    const correction = indication === null || referenceMassKg === null ? null
      : numericFormula(expressions, 'weighing.correction', 'indication - referenceMass', { indication, referenceMass: referenceMassKg });
    const reportCorrection = indication === null || referenceMassKg === null ? null
      : numericFormula(expressions, 'weighing.reportCorrection', 'referenceMass - indication', { indication, referenceMass: referenceMassKg });
    const complete = weightsComplete && zeroReading !== null && indication !== null && correction !== null && reportCorrection !== null && uncertaintyU95Kg !== null && uncertaintyU95Kg >= 0;
    return {
      id: setting.id,
      loadKg: setting.loadKg,
      zeroReading,
      indication,
      standardWeightSerials: validWeights.map((weight) => weight.serial),
      standardWeightsComplete: weightsComplete,
      referenceMassKg,
      correction,
      reportCorrection,
      uncertaintyU95Kg,
      complete,
    };
  });
  const complete = repeatabilityComplete && points.length === config.points.length && points.every((point) => point.complete);
  const maxAbsoluteCorrection = complete ? Math.max(...points.map((point) => Math.abs(point.correction ?? 0))) : null;
  const maxUncertaintyU95 = complete ? Math.max(...points.map((point) => point.uncertaintyU95Kg ?? 0)) : null;
  const rawLop = maxAbsoluteCorrection === null || maxUncertaintyU95 === null ? null
    : numericFormula(expressions, 'weighing.lop', 'maxCorrection + maxU95', { maxCorrection: maxAbsoluteCorrection, maxU95: maxUncertaintyU95 });
  const lop = rawLop !== null && rawLop >= 0 ? rawLop : null;
  const rawLimit = numericFormula(expressions, 'weighing.limit', '10 * d', { d: config.resolutionKg });
  const limit = rawLimit !== null && rawLimit >= 0 ? rawLimit : null;
  const passed = lop === null || limit === null ? null : booleanFormula(expressions, 'weighing.pass', 'lop <= limit', { lop, limit });
  const reportStandardDeviation = numericFormula(expressions, 'weighing.reportSD', 'sqrt(2 / 3) * (0.5 * d)', { d: config.resolutionKg });
  return {
    repeatabilityMean: repeatabilityComplete ? average(validRepeatedReadings) : null,
    repeatabilityStandardDeviation: repeatabilityComplete ? sampleStandardDeviation(validRepeatedReadings) : null,
    reportStandardDeviation,
    repeatabilityReadings,
    points,
    maxAbsoluteCorrection,
    maxUncertaintyU95,
    lop,
    limit,
    pass: passed,
    complete: complete && passed !== null && lop !== null && reportStandardDeviation !== null,
  };
}

function interpolatePressureCorrection(value: number, config: SphygmomanometerConfig, direction: 'up' | 'down', expressions?: Record<string, string>): number | null {
  const table = config.dpmCorrections;
  if (value < table[0].pressure || value > table[table.length - 1].pressure) return null;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (value <= upper.pressure) {
      return numericFormula(expressions, 'sphyg.interpolation', 'c1 + (x - x1) * (c2 - c1) / (x2 - x1)', {
        x: value, x1: lower.pressure, x2: upper.pressure, c1: lower[direction], c2: upper[direction],
      });
    }
  }
  return table[table.length - 1][direction];
}

function calculateSphygmomanometer(config: SphygmomanometerConfig, data: SphygmomanometerData | undefined, standardValid: boolean, expressions?: Record<string, string>): SphygmomanometerResult {
  const leakageDrop = number(data?.leakageDrop);
  const rapidDeflationSeconds = number(data?.rapidDeflationSeconds);
  const pressureReadings = config.pressurePoints.map((setting) => {
    const input = data?.pressureReadings.find((item) => item.setting === setting);
    const calculateDirection = (direction: 'up' | 'down'): SphygmomanometerDirectionResult => {
      const readings = (input?.[direction] ?? []).map(number);
      const corrections = readings.map((reading) => reading === null ? null : interpolatePressureCorrection(reading, config, direction, expressions));
      const correctedReadings = readings.map((reading, index) => reading === null || corrections[index] === null ? null
        : numericFormula(expressions, 'sphyg.correctedReading', 'reading + correction', { reading, correction: corrections[index]! }));
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
      const uResolution = numericFormula(expressions, 'sphyg.uResolution', '(0.5 * accuracyClass) / sqrt(6)', { accuracyClass: config.accuracyClass });
      const uRepeatability = numericFormula(expressions, 'sphyg.uRepeatability', 'standardDeviation / sqrt(3)', { standardDeviation });
      const uDrift = numericFormula(expressions, 'sphyg.uDrift', 'drift / sqrt(3)', { drift });
      const uDpm = numericFormula(expressions, 'sphyg.uDpm', 'dpmU95 / 2', { dpmU95: config.dpmU95 });
      const components = [uResolution, uRepeatability, uDrift, uDpm];
      if (components.some((component) => component === null || component < 0)) return {
        readings, correctedReadings, mean: null, standardDeviation: null, correction: null,
        uncertaintyU95: null, decisionValue: null, complete: false, pass: null,
      };
      const variance = components.reduce<number>((sum, component) => sum + (component ?? 0) ** 2, 0);
      const dofDenominator = components.reduce<number>((sum, component, index) => sum + (component ?? 0) ** 4 / config.degreesOfFreedom[index], 0);
      const effectiveDof = variance ** 2 / dofDenominator;
      const k95 = studentTCritical95(effectiveDof);
      const sumU2 = variance;
      const uncertaintyU95 = numericFormula(expressions, 'sphyg.u95', 'max(k95 * sqrt(sumU2), minimumU95)', { k95, sumU2, minimumU95: config.minimumPressureU95MmHg });
      const correction = numericFormula(expressions, 'sphyg.correction', 'setting - mean', { setting, mean });
      const decisionValue = correction === null || uncertaintyU95 === null ? null
        : numericFormula(expressions, 'sphyg.decision', 'abs(correction) + u95', { correction, u95: uncertaintyU95 });
      const pass = decisionValue === null ? null : booleanFormula(expressions, 'sphyg.pressurePass', 'decisionValue <= pressureTolerance', {
        decisionValue, pressureTolerance: config.pressureToleranceMmHg,
      });
      if (decisionValue === null || pass === null || uncertaintyU95 === null || uncertaintyU95 < 0) return {
        readings, correctedReadings, mean: null, standardDeviation: null, correction: null,
        uncertaintyU95: null, decisionValue: null, complete: false, pass: null,
      };
      return {
        readings, correctedReadings, mean, standardDeviation, correction, uncertaintyU95,
        decisionValue, complete: true, pass,
      };
    };
    return { setting, up: calculateDirection('up'), down: calculateDirection('down') };
  });
  const leakagePass = leakageDrop === null ? null : booleanFormula(expressions, 'sphyg.leakagePass', 'leakageDrop <= leakageLimit', {
    leakageDrop, leakageLimit: config.leakageLimitMmHg,
  });
  const deflationPass = rapidDeflationSeconds === null ? null : booleanFormula(expressions, 'sphyg.deflationPass', 'rapidDeflationSeconds <= deflationLimit', {
    rapidDeflationSeconds, deflationLimit: config.deflationLimitSeconds,
  });
  const complete = leakageDrop !== null && rapidDeflationSeconds !== null && leakagePass !== null && deflationPass !== null
    && pressureReadings.length === config.pressurePoints.length
    && pressureReadings.every((point) => point.up.complete && point.down.complete) && standardValid;
  return {
    leakageDrop: { value: leakageDrop, pass: leakagePass },
    rapidDeflationSeconds: { value: rapidDeflationSeconds, pass: deflationPass },
    pressureReadings,
    complete,
  };
}

function interpolate(value: number, table: ThermohygrometerPoint[], expressions?: Record<string, string>): number | null {
  if (value < table[0].value || value > table[table.length - 1].value) return null;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (value <= upper.value) {
      return numericFormula(expressions, 'interpolation', defaultEnvironmentExpressions.interpolation, {
        x: value, x1: lower.value, x2: upper.value, c1: lower.correction, c2: upper.correction,
      });
    }
  }
  return table[table.length - 1].correction;
}

function calculateEnvironment(data: CalibrationData): EnvironmentResult {
  const reference = data.environment.reference ?? thermohygrometers.find((item) => item.id === data.environment.standardId);
  if (!reference) return { reference: null, temperature: null, humidity: null, errors: ['Pilih thermohygrometer acuan.'] };
  const errors: string[] = [];
  const formulaMethod = data.environment.formulaMethod;
  const expressions = formulaMethod?.expressions;
  const resolution = formulaMethod?.resolution ?? 0.1;
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
    const startCorrection = interpolate(start, points, expressions);
    const endCorrection = interpolate(end, points, expressions);
    if (startCorrection === null || endCorrection === null) {
      errors.push(kind === 'suhu'
        ? 'Suhu harus berada pada rentang sertifikat thermohygrometer 15–37 °C.'
        : 'Kelembaban harus berada pada rentang sertifikat thermohygrometer 30–80%.');
      return null;
    }
    const correctedStart = numericFormula(expressions, 'correctedReading', defaultEnvironmentExpressions.correctedReading, { reading: start, correction: startCorrection });
    const correctedEnd = numericFormula(expressions, 'correctedReading', defaultEnvironmentExpressions.correctedReading, { reading: end, correction: endCorrection });
    if (correctedStart === null || correctedEnd === null) {
      errors.push('Rumus kondisi lingkungan tidak valid. Periksa konfigurasi rumus admin.');
      return null;
    }
    const standardDeviation = sampleStandardDeviation([start, end]);
    const ua = numericFormula(expressions, 'ua', defaultEnvironmentExpressions.ua, { standardDeviation });
    const uResolution = numericFormula(expressions, 'uResolution', defaultEnvironmentExpressions.uResolution, { resolution });
    const mean = numericFormula(expressions, 'mean', defaultEnvironmentExpressions.mean, { correctedStart, correctedEnd });
    const range = numericFormula(expressions, 'range', defaultEnvironmentExpressions.range, { correctedStart, correctedEnd });
    if (ua === null || uResolution === null || mean === null || range === null) {
      errors.push('Rumus kondisi lingkungan tidak valid. Periksa konfigurasi rumus admin.');
      return null;
    }
    const u95 = numericFormula(expressions, 'u95', defaultEnvironmentExpressions.u95, { ua, certificateU95, uResolution });
    if (u95 === null || u95 < 0) {
      errors.push('Rumus kondisi lingkungan tidak valid. Periksa konfigurasi rumus admin.');
      return null;
    }
    return {
      start,
      end,
      startCorrection,
      endCorrection,
      correctedStart,
      correctedEnd,
      mean,
      range,
      u95,
    };
  };

  const temperature = calculatePair('suhu', 'temperatureStart', 'temperatureEnd', reference.temperature, reference.temperatureU95);
  const humidity = calculatePair('kelembaban', 'humidityStart', 'humidityEnd', reference.humidity, reference.humidityU95);
  return { reference, temperature, humidity, errors };
}

function calculateCustomExpressionRow(row: PerformanceEntry, defaults: MeasurementReferences): CalculatedPerformance | null {
  const expressions = row.customExpressions;
  const setting = number(row.setting);
  const readings = row.readings.map(number);
  const references = [row.references ?? defaults].flatMap((item) => [item.calibratorResolution, item.calibratorUncertainty, item.uutResolution]).map(number);
  const tolerancePercent = number(row.tolerancePercent);
  const absoluteTolerance = number(row.absoluteTolerance ?? '0');
  if (!expressions || setting === null || row.count < 1 || row.readings.length !== row.count
    || readings.some((value) => value === null) || references.some((value) => value === null)
    || tolerancePercent === null || absoluteTolerance === null) return null;
  const values = readings as number[];
  const [resCal, uCal, resUut] = references as number[];
  if (resCal <= 0 || uCal < 0 || resUut <= 0 || tolerancePercent < 0 || absoluteTolerance < 0) return null;
  const mean = average(values);
  const sd = values.length > 1 ? sampleStandardDeviation(values) : 0;
  const ua = sd / Math.sqrt(values.length);
  const variables: Record<string, number> = {
    mean, setting, sd, n: values.length, ua, uCal, resCal, resUut,
    tolerancePercent, absoluteTolerance,
  };
  try {
    const numericResult = (expression: string) => {
      const result = evaluateFormulaExpression(expression, variables);
      if (typeof result !== 'number') throw new Error('Rumus angka menghasilkan nilai logika.');
      return result;
    };
    const correction = numericResult(expressions.correction);
    variables.correction = correction;
    const u95 = numericResult(expressions.uncertainty);
    variables.u95 = u95;
    const tolerance = numericResult(expressions.tolerance);
    variables.tolerance = tolerance;
    const testValue = numericResult(expressions.testValue);
    variables.testValue = testValue;
    const pass = evaluateFormulaExpression(expressions.pass, variables);
    if (typeof pass !== 'boolean' || u95 < 0 || tolerance < 0) return null;
    return { setting, mean, correction, ua, u95, tolerance, testValue, pass, readings: values };
  } catch {
    return null;
  }
}

function calculatePerformanceRow(row: PerformanceEntry, references: MeasurementReferences, allRows: PerformanceEntry[]): CalculatedPerformance | null {
  if (row.formula === 'customExpression') return calculateCustomExpressionRow(row, references);
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

function interpolateTable(value: number, table: readonly (readonly [number, number])[]): number | null {
  if (value < table[0][0] || value > table[table.length - 1][0]) return null;
  for (let index = 1; index < table.length; index += 1) {
    const upper = table[index];
    const lower = table[index - 1];
    if (value <= upper[0]) return lower[1] + ((value - lower[0]) / (upper[0] - lower[0])) * (upper[1] - lower[1]);
  }
  return table[table.length - 1][1];
}

function calculatePumpFlow(row: PerformanceEntry, channel: string, config: NonNullable<Instrument['infusionPump']>, expressions?: Record<string, string>): CalculatedPerformance | null {
  const setting = number(row.setting);
  const readings = row.readings.map(number);
  const profile = config.channels.find((item) => item.channel === channel);
  if (!profile || setting === null || setting <= 0 || readings.length !== row.count || row.count < 1 || readings.some((reading) => reading === null)) return null;
  const values = readings as number[];
  const mean = average(values);
  const drift = interpolateTable(setting, profile.flowDrift);
  const certificateU95 = interpolateTable(setting, config.flowCertificateU95);
  if (drift === null || certificateU95 === null) return null;
  const correction = numericFormula(expressions, 'pump.flowCorrection', 'intercept + slope * mean', { intercept: profile.flowIntercept, slope: profile.flowSlope, mean });
  const correctedMean = correction === null ? null : numericFormula(expressions, 'pump.correctedMean', 'mean + correction', { mean, correction });
  const error = correctedMean === null ? null : numericFormula(expressions, 'pump.error', 'correctedMean - setting', { correctedMean, setting });
  const standardDeviation = sampleStandardDeviation(values);
  const ua = numericFormula(expressions, 'pump.ua', 'standardDeviation / sqrt(3)', { standardDeviation });
  const uResolution = numericFormula(expressions, 'pump.flowUResolution', 'flowResolution / sqrt(3)', { flowResolution: config.flowResolution });
  const uDrift = numericFormula(expressions, 'pump.flowUDrift', 'drift / sqrt(3)', { drift });
  const uCertificate = numericFormula(expressions, 'pump.flowUCertificate', 'certificateU95 / 2', { certificateU95 });
  if (correction === null || correctedMean === null || error === null || ua === null || uResolution === null || uDrift === null || uCertificate === null) return null;
  const components = [uResolution, ua, uDrift, uCertificate];
  if (components.some((value) => value < 0)) return null;
  const variance = components.reduce((sum, value) => sum + value ** 2, 0);
  const denominator = components.reduce((sum, value, index) => sum + value ** 4 / config.flowDegreesOfFreedom[index], 0);
  const k95 = studentTCritical95(denominator ? variance ** 2 / denominator : Number.POSITIVE_INFINITY);
  const u95 = numericFormula(expressions, 'pump.u95', 'sqrt(uResolution^2 + ua^2 + uDrift^2 + uCertificate^2) * k95', { uResolution, ua, uDrift, uCertificate, k95 });
  const tolerance = numericFormula(expressions, 'pump.flowTolerance', 'flowToleranceRatio', { flowToleranceRatio: config.flowToleranceRatio });
  const testValue = numericFormula(expressions, 'pump.flowTestValue', 'abs(error / setting)', { error, setting });
  if (u95 === null || tolerance === null || testValue === null || u95 < 0 || tolerance < 0) return null;
  const pass = booleanFormula(expressions, 'pump.flowPass', 'testValue <= tolerance', { testValue, tolerance });
  return pass === null ? null : { setting, mean, correction, correctedMean, error, ua, u95, tolerance, testValue, pass, readings: values };
}

function calculatePumpOcclusion(input: InfusionPumpData | undefined, config: NonNullable<Instrument['infusionPump']>, expressions?: Record<string, string>): CalculationResult['pumpOcclusion'] {
  if (!input || input.occlusionReadings.length !== 6) return null;
  const profile = config.channels.find((item) => item.channel === input.channel);
  const readings = input.occlusionReadings.map(number);
  if (!profile || readings.some((reading) => reading === null)) return null;
  const values = readings as number[];
  const mean = average(values);
  const correction = numericFormula(expressions, 'pump.occlusionCorrection', 'intercept + slope * mean', { intercept: profile.occlusionIntercept, slope: profile.occlusionSlope, mean });
  const correctedMean = correction === null ? null : numericFormula(expressions, 'pump.occlusionCorrectedMean', 'mean + correction', { mean, correction });
  const standardDeviation = sampleStandardDeviation(values);
  const ua = numericFormula(expressions, 'pump.occlusionUa', 'standardDeviation / sqrt(3)', { standardDeviation });
  const uResolution = numericFormula(expressions, 'pump.occlusionUResolution', 'occlusionResolution / sqrt(3)', { occlusionResolution: config.occlusionResolution });
  const uDpm = numericFormula(expressions, 'pump.occlusionUDpm', 'occlusionDpmU95 / 2', { occlusionDpmU95: config.occlusionDpmU95 });
  if (correction === null || correctedMean === null || ua === null || uResolution === null || uDpm === null) return null;
  const components = [uResolution, ua, uDpm];
  if (components.some((value) => value < 0)) return null;
  const variance = components.reduce((sum, value) => sum + value ** 2, 0);
  const denominator = components.reduce((sum, value, index) => sum + value ** 4 / config.occlusionDegreesOfFreedom[index], 0);
  const k95 = studentTCritical95(denominator ? variance ** 2 / denominator : Number.POSITIVE_INFINITY);
  const uncertaintyU95 = numericFormula(expressions, 'pump.occlusionU95', 'sqrt(uResolution^2 + ua^2 + uDpm^2) * k95', { uResolution, ua, uDpm, k95 });
  const pass = booleanFormula(expressions, 'pump.occlusionPass', 'mean <= limit', { mean, limit: config.occlusionLimit });
  if (uncertaintyU95 === null || uncertaintyU95 < 0 || pass === null) return null;
  return { mean, correction, correctedMean, uncertaintyU95, limit: config.occlusionLimit, pass, readings: values };
}

function calculateSuctionPump(config: NonNullable<Instrument['suctionPump']>, data: SuctionPumpData | undefined, standardValid: boolean, expressions?: Record<string, string>): SuctionPumpResult {
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
      const signedMean = numericFormula(expressions, 'suction.signedMean', '-mean', { mean });
      const drift = interpolateTable(Math.abs(setting), direction === 'up' ? config.driftUp : config.driftDown);
      if (drift === null) return null;
      if (signedMean === null) return null;
      const slope = direction === 'up' ? config.slopeUp : config.slopeDown;
      const intercept = direction === 'up' ? config.interceptUp : config.interceptDown;
      const correction = numericFormula(expressions, 'suction.correction', 'intercept + slope * signedMean', { intercept, slope, signedMean });
      const correctedMean = correction === null ? null : numericFormula(expressions, 'suction.correctedMean', 'signedMean + correction', { signedMean, correction });
      const error = correctedMean === null ? null : numericFormula(expressions, 'suction.error', 'correctedMean - setting', { correctedMean, setting });
      const standardDeviation = sampleStandardDeviation(values);
      const ua = numericFormula(expressions, 'suction.ua', 'standardDeviation / sqrt(n)', { standardDeviation, n: values.length });
      const uResolution = numericFormula(expressions, 'suction.uResolution', '(meterResolution * 0.5 / 3) / sqrt(6)', { meterResolution: config.meterResolution });
      const uDrift = numericFormula(expressions, 'suction.uDrift', 'drift / sqrt(3)', { drift });
      const uDpm = numericFormula(expressions, 'suction.uDpm', 'meterU95 / 2', { meterU95: config.meterU95 });
      if (correction === null || correctedMean === null || error === null || ua === null || uResolution === null || uDrift === null || uDpm === null) return null;
      const components = [uResolution, ua, uDrift, uDpm];
      if (components.some((value) => value < 0)) return null;
      const variance = components.reduce((sum, value) => sum + value ** 2, 0);
      const denominator = components.reduce((sum, value, index) => sum + value ** 4 / config.degreesOfFreedom[index], 0);
      const k95 = studentTCritical95(denominator ? variance ** 2 / denominator : Number.POSITIVE_INFINITY);
      const uncertaintyU95 = numericFormula(expressions, 'suction.u95', 'sqrt(uResolution^2 + ua^2 + uDrift^2 + uDpm^2) * k95', { uResolution, ua, uDrift, uDpm, k95 });
      const pass = booleanFormula(expressions, 'suction.pressurePass', 'abs(error / setting) <= toleranceRatio', { error, setting, toleranceRatio: config.pressureToleranceRatio });
      if (uncertaintyU95 === null || uncertaintyU95 < 0 || pass === null) return null;
      return { readings: values, mean, correction, correctedMean, error, uncertaintyU95, pass };
    };
    return { setting, up: calculateDirection('up'), down: calculateDirection('down') };
  });
  const maximumVacuumReading = number(data?.maximumVacuumReading);
  const maximumVacuumSeconds = number(data?.maximumVacuumSeconds);
  const maximumVacuumMagnitude = maximumVacuumReading === null ? null : Math.abs(maximumVacuumReading);
  const maximumVacuumReadingPass = maximumVacuumMagnitude === null ? null : legacy
    ? booleanFormula(expressions, 'suction.legacyVacuumPass', 'vacuumMagnitude >= legacyMinimumVacuum', {
      vacuumMagnitude: maximumVacuumMagnitude, legacyMinimumVacuum: config.legacyMinimumVacuumMmHg,
    })
    : booleanFormula(expressions, 'suction.maximumVacuumPass', 'vacuumMagnitude >= minimumVacuum && vacuumMagnitude <= maximumVacuum', {
      vacuumMagnitude: maximumVacuumMagnitude, minimumVacuum: config.minimumVacuumMmHg, maximumVacuum: config.maximumVacuumMmHg,
    });
  const maximumVacuumPass = maximumVacuumSeconds === null ? null : booleanFormula(expressions, 'suction.maximumTimePass', 'seconds <= maximumSeconds', {
    seconds: maximumVacuumSeconds, maximumSeconds: config.maximumVacuumSeconds,
  });
  const complete = standardValid && maximumVacuumReading !== null && maximumVacuumReadingPass !== null
    && maximumVacuumSeconds !== null && maximumVacuumPass !== null
    && pressureReadings.every((point) => point.up !== null && point.down !== null);
  return {
    pressureReadings,
    maximumVacuumReading,
    maximumVacuumReadingPass,
    maximumVacuumSeconds,
    maximumVacuumPass,
    complete,
  };
}

function calculateSafety(safety: SafetyData, config = defaultElectricalSafetyConfig, expressions?: Record<string, string>): SafetyResult {
  const voltage = number(safety.voltage);
  const earth = number(safety.earthResistance);
  const equipmentLeakage = number(safety.equipmentLeakage);
  const appliedLeakage = number(safety.appliedLeakage);
  const rawInsulation = String(safety.insulationResistance ?? '').trim();
  const insulationMatch = rawInsulation.match(/^>\s*(\d+(?:[.,]\d+)?)$/);
  const insulationResistance = number(rawInsulation) ?? (insulationMatch ? Number(insulationMatch[1].replace(',', '.')) : /^ol$/i.test(rawInsulation) ? Number.MAX_SAFE_INTEGER : null);
  const earthType = Number(safety.earthType) - 1;
  const leakageType = Number(safety.leakageType) - 1;
  const earthLimit = config.earthResistanceLimitsOhm[earthType];
  const leakageLimit = config.leakageCurrentLimitsMa[leakageType];
  const checks: SafetyCheck[] = [
    { label: 'Tegangan jala-jala', result: voltage === null ? null : booleanFormula(expressions, 'safety.voltagePass', 'voltage >= voltageMinimum && voltage <= voltageMaximum', { voltage, voltageMinimum: config.voltageMinimumV, voltageMaximum: config.voltageMaximumV }), measured: safety.voltage, limit: `${config.voltageMinimumV}–${config.voltageMaximumV} V` },
    { label: 'Resistansi pembumian protektif', result: earth === null ? null : booleanFormula(expressions, 'safety.earthPass', 'earth <= earthLimit', { earth, earthLimit }), measured: safety.earthResistance, limit: `${earthLimit} Ω` },
    { label: 'Arus bocor peralatan', result: equipmentLeakage === null ? null : booleanFormula(expressions, 'safety.equipmentLeakagePass', 'equipmentLeakage <= leakageLimit', { equipmentLeakage, leakageLimit }), measured: safety.equipmentLeakage, limit: `${leakageLimit} mA` },
    { label: 'Arus bocor bagian diaplikasikan', result: safety.appliedLeakageNA ? booleanFormula(expressions, 'safety.appliedLeakagePass', 'appliedLeakageNA == 1 || appliedLeakage <= appliedLeakageLimit', { appliedLeakageNA: 1, appliedLeakage: appliedLeakage ?? 0, appliedLeakageLimit: config.appliedLeakageLimitMa }) : appliedLeakage === null ? null : booleanFormula(expressions, 'safety.appliedLeakagePass', 'appliedLeakageNA == 1 || appliedLeakage <= appliedLeakageLimit', { appliedLeakageNA: 0, appliedLeakage, appliedLeakageLimit: config.appliedLeakageLimitMa }), measured: safety.appliedLeakageNA ? 'Tidak berlaku' : safety.appliedLeakage, limit: `${config.appliedLeakageLimitMa} mA` },
    { label: 'Resistansi isolasi', result: insulationResistance === null ? null : booleanFormula(expressions, 'safety.insulationPass', 'insulationResistance >= insulationMinimum', { insulationResistance, insulationMinimum: config.insulationMinimumMOhm }), measured: safety.insulationResistance, limit: `≥ ${config.insulationMinimumMOhm} MΩ` },
  ];
  const complete = checks.every((check) => check.result !== null);
  const passed = checks.filter((check) => check.result === true).length;
  const score = complete ? numericFormula(expressions, 'safety.score', 'passedCount * scorePerCheck', { passedCount: passed, scorePerCheck: config.scorePerPassedCheck }) : null;
  return {
    checks,
    complete: complete && score !== null && score >= 0 && score <= 100,
    score: score !== null && score >= 0 && score <= 100 ? score : null,
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
    ? calculateSphygmomanometer(calculationInstrument.sphygmomanometer, data.sphygmomanometer, dpmStandardValid, calculationInstrument.formulaExpressions)
    : null;
  const performance = data.performance.map((row) => ({
    ...row,
    result: row.formula === 'infusionFlow'
      ? pumpAnalyzerValid && calculationInstrument.infusionPump
        ? calculatePumpFlow(row, data.infusionPump?.channel ?? '', calculationInstrument.infusionPump, calculationInstrument.formulaExpressions)
        : null
      : calculatePerformanceRow(row, data.references, data.performance),
  }));
  const infusionPump = templateId === 'infusion-pump' || templateId === 'syringe-pump';
  const pumpOcclusion = infusionPump && pumpAnalyzerValid && calculationInstrument.infusionPump
    ? calculatePumpOcclusion(data.infusionPump, calculationInstrument.infusionPump, calculationInstrument.formulaExpressions)
    : null;
  const suctionDpmSerial = instrument.suctionPump ? dpmSerial : undefined;
  const suctionDpmValid = data.selectedDevices === undefined || Boolean(selectedDpm && selectedDpm.serial === suctionDpmSerial);
  const suctionPump = instrument.suctionPump ? calculateSuctionPump(instrument.suctionPump, data.suctionPump, suctionDpmValid, instrument.formulaExpressions) : null;
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
    : weighing ? (inspectionRate / 100) * instrument.score.physicalWeight
      : inspectionRate >= (instrument.score.physicalThreshold ?? 70) ? instrument.score.physicalWeight : 0;
  const safety = instrument.electricalSafety || instrument.electricalSafetyConfig || ['centrifuge', 'infusion-pump', 'syringe-pump', 'suction-pump'].includes(templateId)
    ? calculateSafety(data.safety, instrument.electricalSafetyConfig, instrument.formulaExpressions) : null;
  const performanceInputsComplete = weighing ? weighing.complete : sphygmomanometer ? sphygmomanometer.complete
    : suctionPump ? suctionPump.complete
      : infusionPump ? performance.length > 0 && performance.every((row) => row.result !== null) && pumpOcclusion !== null
        : performance.length > 0 && performance.every((row) => row.result !== null);
  const scoredPerformance = performance.filter((row) => row.includeInScore !== false);
  const performanceOutcomeCount = scoredPerformance.reduce((sum, row) => sum + (row.result ? 1 + Number(row.result.standardPass !== undefined) : 0), 0);
  const performancePassCount = scoredPerformance.reduce((sum, row) => sum + (row.result
    ? row.result.standardPass === undefined ? Number(row.result.pass) : Number(row.result.uutPass) + Number(row.result.standardPass)
    : 0), 0);
  const sphygPerformanceRate = sphygmomanometer?.complete ? numericFormula(instrument.formulaExpressions, 'sphyg.performanceRate', '((leakagePassed * 30 + deflationPassed * 30 + upPassCount * 15 / pressurePointCount + downPassCount * 15 / pressurePointCount) / 90) * 100', {
    leakagePassed: Number(sphygmomanometer.leakageDrop.pass),
    deflationPassed: Number(sphygmomanometer.rapidDeflationSeconds.pass),
    upPassCount: sphygmomanometer.pressureReadings.reduce((sum, point) => sum + Number(point.up.pass), 0),
    downPassCount: sphygmomanometer.pressureReadings.reduce((sum, point) => sum + Number(point.down.pass), 0),
    pressurePointCount: sphygmomanometer.pressureReadings.length,
  }) : null;
  const pumpFlowRate = performanceInputsComplete && infusionPump ? performance.filter((row) => row.result?.pass).length / performance.length * 100 : null;
  const pumpPerformanceRate = pumpFlowRate === null || pumpOcclusion?.pass === null || pumpOcclusion?.pass === undefined ? null
    : numericFormula(instrument.formulaExpressions, 'pump.performanceRate', '(flowPassRate + occlusionPassed * 100) / 2', { flowPassRate: pumpFlowRate, occlusionPassed: Number(pumpOcclusion.pass) });
  const suctionPressurePassCount = suctionPump?.pressureReadings.reduce((sum, point) => sum + Number(point.up?.pass) + Number(point.down?.pass), 0) ?? 0;
  const suctionPerformanceRate = performanceInputsComplete && suctionPump ? numericFormula(instrument.formulaExpressions, 'suction.performanceRate', 'pressurePassCount / (pressurePointCount * 2) * 100', {
    pressurePassCount: suctionPressurePassCount, pressurePointCount: suctionPump.pressureReadings.length,
  }) : null;
  const suctionPerformancePass = performanceInputsComplete && suctionPump && suctionPerformanceRate !== null
    ? booleanFormula(instrument.formulaExpressions, 'suction.performancePass', 'pressureRate == 100 && vacuumReadingPassed == 1 && vacuumTimePassed == 1', {
      pressureRate: suctionPerformanceRate,
      vacuumReadingPassed: Number(suctionPump.maximumVacuumReadingPass),
      vacuumTimePassed: Number(suctionPump.maximumVacuumPass),
    }) : null;
  const performanceComplete = performanceInputsComplete && (sphygmomanometer ? sphygPerformanceRate !== null
    : infusionPump ? pumpPerformanceRate !== null
      : suctionPump ? suctionPerformanceRate !== null && suctionPerformancePass !== null
        : true);
  const performanceRate = weighing
    ? weighing.pass === null ? null : weighing.pass ? 100 : 0
    : sphygmomanometer ? sphygPerformanceRate
      : infusionPump
        ? pumpPerformanceRate
      : suctionPump ? suctionPerformanceRate
    : performanceComplete && performanceOutcomeCount > 0 ? (performancePassCount / performanceOutcomeCount) * 100 : null;
  const performanceScore = weighing
    ? weighing.pass === null ? null : weighing.pass ? instrument.score.performanceWeight : 0
    : sphygmomanometer
      ? performanceRate === null ? null : performanceRate * instrument.score.performanceWeight / 100
    : infusionPump
      ? performanceRate === null ? null : performanceRate >= instrument.score.performanceThreshold ? instrument.score.performanceWeight : 0
    : suctionPump
      ? suctionPerformancePass === null ? null : suctionPerformancePass ? instrument.score.performanceWeight : 0
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
    status: missing.length ? 'BELUM LENGKAP' : score !== null && score >= (instrument.score.overallPassThreshold ?? 70) ? 'LAIK PAKAI DAN AMAN UNTUK DIGUNAKAN' : 'TIDAK LAIK PAKAI',
  };
}
