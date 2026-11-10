import type { Instrument } from './types';
import { evaluateFormulaExpression } from './formulaExpressions';

export interface FormulaFieldDefinition {
  key: string;
  label: string;
  detail: string;
  expression: string;
}

const weighingFields: FormulaFieldDefinition[] = [
  { key: 'weighing.referenceMass', label: 'Massa acuan (kg)', detail: 'Variabel: sumMass2026G.', expression: 'sumMass2026G / 1000' },
  { key: 'weighing.correction', label: 'Koreksi titik beban', detail: 'Variabel: indication, referenceMass.', expression: 'indication - referenceMass' },
  { key: 'weighing.reportCorrection', label: 'Koreksi yang dicetak pada LK', detail: 'Variabel: indication, referenceMass.', expression: 'referenceMass - indication' },
  { key: 'weighing.uResolution', label: 'Ketidakpastian resolusi', detail: 'Variabel: d, resolutionDivisor.', expression: '(0.5 * d) / sqrt(resolutionDivisor)' },
  { key: 'weighing.uRepeatability', label: 'Ketidakpastian daya ulang', detail: 'Variabel: d.', expression: '(0.5 * d) / 2' },
  { key: 'weighing.uCertificate', label: 'Ketidakpastian sertifikat', detail: 'Variabel: sumCertificateU95G.', expression: '(sumCertificateU95G / 2) / 1000' },
  { key: 'weighing.uDrift', label: 'Ketidakpastian drift', detail: 'Variabel: sumDriftDeltaG.', expression: '(0.5 * sumDriftDeltaG / sqrt(3) / sqrt(3)) / 1000' },
  { key: 'weighing.u95', label: 'Ketidakpastian U95 titik', detail: 'Variabel: uResolution, uRepeatability, uCertificate, uDrift, k95.', expression: 'sqrt(uResolution^2 + uRepeatability^2 + uCertificate^2 + uDrift^2) * k95' },
  { key: 'weighing.reportSD', label: 'Simpangan baku laporan', detail: 'Variabel: d.', expression: 'sqrt(2 / 3) * (0.5 * d)' },
  { key: 'weighing.lop', label: 'LOP', detail: 'Variabel: maxCorrection, maxU95.', expression: 'maxCorrection + maxU95' },
  { key: 'weighing.limit', label: 'Batas LOP', detail: 'Variabel: d.', expression: '10 * d' },
  { key: 'weighing.pass', label: 'Aturan lulus timbangan', detail: 'Variabel: lop, limit.', expression: 'lop <= limit' },
];

const sphygFields: FormulaFieldDefinition[] = [
  { key: 'sphyg.interpolation', label: 'Interpolasi koreksi DPM', detail: 'Variabel: x, x1, x2, c1, c2.', expression: 'c1 + (x - x1) * (c2 - c1) / (x2 - x1)' },
  { key: 'sphyg.correctedReading', label: 'Bacaan terkoreksi', detail: 'Variabel: reading, correction.', expression: 'reading + correction' },
  { key: 'sphyg.uResolution', label: 'Ketidakpastian resolusi', detail: 'Variabel: accuracyClass.', expression: '(0.5 * accuracyClass) / sqrt(6)' },
  { key: 'sphyg.uRepeatability', label: 'Ketidakpastian pengulangan', detail: 'Variabel: standardDeviation.', expression: 'standardDeviation / sqrt(3)' },
  { key: 'sphyg.uDrift', label: 'Ketidakpastian drift', detail: 'Variabel: drift.', expression: 'drift / sqrt(3)' },
  { key: 'sphyg.uDpm', label: 'Ketidakpastian DPM', detail: 'Variabel: dpmU95.', expression: 'dpmU95 / 2' },
  { key: 'sphyg.u95', label: 'Ketidakpastian U95 tekanan', detail: 'Variabel: k95, sumU2, minimumU95.', expression: 'max(k95 * sqrt(sumU2), minimumU95)' },
  { key: 'sphyg.correction', label: 'Koreksi tekanan', detail: 'Variabel: setting, mean.', expression: 'setting - mean' },
  { key: 'sphyg.decision', label: 'Nilai keputusan tekanan', detail: 'Variabel: correction, u95.', expression: 'abs(correction) + u95' },
  { key: 'sphyg.pressurePass', label: 'Aturan lulus tekanan', detail: 'Variabel: decisionValue, pressureTolerance.', expression: 'decisionValue <= pressureTolerance' },
  { key: 'sphyg.leakagePass', label: 'Aturan lulus kebocoran', detail: 'Variabel: leakageDrop, leakageLimit.', expression: 'leakageDrop <= leakageLimit' },
  { key: 'sphyg.deflationPass', label: 'Aturan lulus deflasi', detail: 'Variabel: rapidDeflationSeconds, deflationLimit.', expression: 'rapidDeflationSeconds <= deflationLimit' },
  { key: 'sphyg.performanceRate', label: 'Skor kinerja sphygmomanometer (%)', detail: 'Variabel: leakagePassed, deflationPassed, upPassCount, downPassCount, pressurePointCount.', expression: '((leakagePassed * 30 + deflationPassed * 30 + upPassCount * 15 / pressurePointCount + downPassCount * 15 / pressurePointCount) / 90) * 100' },
];

const pumpFields: FormulaFieldDefinition[] = [
  { key: 'pump.flowCorrection', label: 'Koreksi aliran', detail: 'Variabel: intercept, slope, mean.', expression: 'intercept + slope * mean' },
  { key: 'pump.correctedMean', label: 'Rata-rata terkoreksi', detail: 'Variabel: mean, correction.', expression: 'mean + correction' },
  { key: 'pump.error', label: 'Galat aliran', detail: 'Variabel: correctedMean, setting.', expression: 'correctedMean - setting' },
  { key: 'pump.ua', label: 'UA aliran', detail: 'Variabel: standardDeviation.', expression: 'standardDeviation / sqrt(3)' },
  { key: 'pump.flowUResolution', label: 'Komponen resolusi aliran', detail: 'Variabel: flowResolution.', expression: 'flowResolution / sqrt(3)' },
  { key: 'pump.flowUDrift', label: 'Komponen drift aliran', detail: 'Variabel: drift.', expression: 'drift / sqrt(3)' },
  { key: 'pump.flowUCertificate', label: 'Komponen sertifikat aliran', detail: 'Variabel: certificateU95.', expression: 'certificateU95 / 2' },
  { key: 'pump.u95', label: 'U95 aliran', detail: 'Variabel: uResolution, ua, uDrift, uCertificate, k95.', expression: 'sqrt(uResolution^2 + ua^2 + uDrift^2 + uCertificate^2) * k95' },
  { key: 'pump.flowTolerance', label: 'Batas relatif aliran', detail: 'Variabel: flowToleranceRatio. Nilai 0.1 berarti 10%.', expression: 'flowToleranceRatio' },
  { key: 'pump.flowTestValue', label: 'Nilai keputusan aliran', detail: 'Variabel: error, setting.', expression: 'abs(error / setting)' },
  { key: 'pump.flowPass', label: 'Aturan lulus aliran', detail: 'Variabel: testValue, tolerance.', expression: 'testValue <= tolerance' },
  { key: 'pump.occlusionCorrection', label: 'Koreksi occlusion', detail: 'Variabel: intercept, slope, mean.', expression: 'intercept + slope * mean' },
  { key: 'pump.occlusionCorrectedMean', label: 'Rata-rata occlusion terkoreksi', detail: 'Variabel: mean, correction.', expression: 'mean + correction' },
  { key: 'pump.occlusionUResolution', label: 'Komponen resolusi occlusion', detail: 'Variabel: occlusionResolution.', expression: 'occlusionResolution / sqrt(3)' },
  { key: 'pump.occlusionUa', label: 'UA occlusion', detail: 'Variabel: standardDeviation.', expression: 'standardDeviation / sqrt(3)' },
  { key: 'pump.occlusionUDpm', label: 'Komponen DPM occlusion', detail: 'Variabel: occlusionDpmU95.', expression: 'occlusionDpmU95 / 2' },
  { key: 'pump.occlusionU95', label: 'U95 occlusion', detail: 'Variabel: uResolution, ua, uDpm, k95.', expression: 'sqrt(uResolution^2 + ua^2 + uDpm^2) * k95' },
  { key: 'pump.occlusionPass', label: 'Aturan lulus occlusion', detail: 'Variabel: mean, limit.', expression: 'mean <= limit' },
  { key: 'pump.performanceRate', label: 'Skor kinerja pump (%)', detail: 'Variabel: flowPassRate, occlusionPassed (0 atau 1).', expression: '(flowPassRate + occlusionPassed * 100) / 2' },
];

const suctionFields: FormulaFieldDefinition[] = [
  { key: 'suction.signedMean', label: 'Tanda bacaan vakum', detail: 'Variabel: mean.', expression: '-mean' },
  { key: 'suction.correction', label: 'Koreksi tekanan', detail: 'Variabel: intercept, slope, signedMean.', expression: 'intercept + slope * signedMean' },
  { key: 'suction.correctedMean', label: 'Rata-rata terkoreksi', detail: 'Variabel: signedMean, correction.', expression: 'signedMean + correction' },
  { key: 'suction.error', label: 'Galat tekanan', detail: 'Variabel: correctedMean, setting.', expression: 'correctedMean - setting' },
  { key: 'suction.ua', label: 'UA tekanan', detail: 'Variabel: standardDeviation, n.', expression: 'standardDeviation / sqrt(n)' },
  { key: 'suction.uResolution', label: 'Komponen resolusi DPM', detail: 'Variabel: meterResolution.', expression: '(meterResolution * 0.5 / 3) / sqrt(6)' },
  { key: 'suction.uDrift', label: 'Komponen drift', detail: 'Variabel: drift.', expression: 'drift / sqrt(3)' },
  { key: 'suction.uDpm', label: 'Komponen sertifikat DPM', detail: 'Variabel: meterU95.', expression: 'meterU95 / 2' },
  { key: 'suction.u95', label: 'U95 tekanan', detail: 'Variabel: uResolution, ua, uDrift, uDpm, k95.', expression: 'sqrt(uResolution^2 + ua^2 + uDrift^2 + uDpm^2) * k95' },
  { key: 'suction.pressurePass', label: 'Aturan lulus tekanan', detail: 'Variabel: error, setting, toleranceRatio.', expression: 'abs(error / setting) <= toleranceRatio' },
  { key: 'suction.maximumVacuumPass', label: 'Aturan lulus vakum maksimum', detail: 'Variabel: vacuumMagnitude, minimumVacuum, maximumVacuum.', expression: 'vacuumMagnitude >= minimumVacuum && vacuumMagnitude <= maximumVacuum' },
  { key: 'suction.maximumTimePass', label: 'Aturan lulus waktu maksimum', detail: 'Variabel: seconds, maximumSeconds.', expression: 'seconds <= maximumSeconds' },
  { key: 'suction.legacyVacuumPass', label: 'Aturan lulus data vakum lama', detail: 'Variabel: vacuumMagnitude, legacyMinimumVacuum.', expression: 'vacuumMagnitude >= legacyMinimumVacuum' },
  { key: 'suction.performanceRate', label: 'Skor titik tekanan (%)', detail: 'Variabel: pressurePassCount, pressurePointCount.', expression: 'pressurePassCount / (pressurePointCount * 2) * 100' },
  { key: 'suction.performancePass', label: 'Aturan lulus kinerja suction', detail: 'Variabel: pressureRate, vacuumReadingPassed, vacuumTimePassed (0 atau 1).', expression: 'pressureRate == 100 && vacuumReadingPassed == 1 && vacuumTimePassed == 1' },
];

export const defaultElectricalSafetyConfig = {
  voltageMinimumV: 198,
  voltageMaximumV: 242,
  earthResistanceLimitsOhm: [0.3, 0.2, 0.3, 0.5] as [number, number, number, number],
  leakageCurrentLimitsMa: [1000, 500, 500, 100] as [number, number, number, number],
  appliedLeakageLimitMa: 50,
  insulationMinimumMOhm: 2,
  scorePerPassedCheck: 8,
};

const safetyFields: FormulaFieldDefinition[] = [
  { key: 'safety.voltagePass', label: 'Aturan lulus tegangan', detail: 'Variabel: voltage, voltageMinimum, voltageMaximum.', expression: 'voltage >= voltageMinimum && voltage <= voltageMaximum' },
  { key: 'safety.earthPass', label: 'Aturan lulus resistansi pembumian', detail: 'Variabel: earth, earthLimit.', expression: 'earth <= earthLimit' },
  { key: 'safety.equipmentLeakagePass', label: 'Aturan lulus arus bocor peralatan', detail: 'Variabel: equipmentLeakage, leakageLimit.', expression: 'equipmentLeakage <= leakageLimit' },
  { key: 'safety.appliedLeakagePass', label: 'Aturan lulus arus bocor bagian diaplikasikan', detail: 'Variabel: appliedLeakageNA (0 atau 1), appliedLeakage, appliedLeakageLimit.', expression: 'appliedLeakageNA == 1 || appliedLeakage <= appliedLeakageLimit' },
  { key: 'safety.insulationPass', label: 'Aturan lulus resistansi isolasi', detail: 'Variabel: insulationResistance, insulationMinimum.', expression: 'insulationResistance >= insulationMinimum' },
  { key: 'safety.score', label: 'Skor keselamatan listrik', detail: 'Variabel: passedCount, scorePerCheck.', expression: 'passedCount * scorePerCheck' },
];

export const defaultInstrumentFormulaExpressions: Record<string, Record<string, string>> = {
  'adult-scale-digital': Object.fromEntries(weighingFields.map(({ key, expression }) => [key, expression])),
  'adult-scale-mechanical': Object.fromEntries(weighingFields.map(({ key, expression }) => [key, expression])),
  'sphygmomanometer-analog': Object.fromEntries(sphygFields.map(({ key, expression }) => [key, expression])),
  'sphygmomanometer-digital': Object.fromEntries(sphygFields.map(({ key, expression }) => [key, expression])),
  'infusion-pump': Object.fromEntries(pumpFields.map(({ key, expression }) => [key, expression])),
  'syringe-pump': Object.fromEntries(pumpFields.map(({ key, expression }) => [key, expression])),
  'suction-pump': Object.fromEntries(suctionFields.map(({ key, expression }) => [key, expression])),
};

export const instrumentFormulaFields = (instrument: Instrument): FormulaFieldDefinition[] => instrument.weighingScale
  ? weighingFields.concat(instrumentHasElectricalSafety(instrument) ? safetyFields : [])
  : instrument.sphygmomanometer ? sphygFields.concat(instrumentHasElectricalSafety(instrument) ? safetyFields : [])
    : instrument.suctionPump || ['infusion-pump', 'syringe-pump'].includes(instrument.templateId ?? instrument.id)
      ? (instrument.suctionPump ? suctionFields : pumpFields).concat(instrumentHasElectricalSafety(instrument) ? safetyFields : [])
      : instrumentHasElectricalSafety(instrument) ? safetyFields : [];

function instrumentHasElectricalSafety(instrument: Instrument) {
  return Boolean(instrument.electricalSafety || instrument.electricalSafetyConfig
    || ['centrifuge', 'infusion-pump', 'syringe-pump', 'suction-pump'].includes(instrument.templateId ?? instrument.id));
}

export function validateInstrumentFormulaExpressions(instrument: Instrument, expressions: Record<string, string>): string | null {
  const variables: Record<string, number> = instrument.weighingScale
    ? { sumMass2026G: 1000, indication: 1.01, d: 0.1, resolutionDivisor: 3, sumCertificateU95G: 0.2, sumDriftDeltaG: 0.1, k95: 2, maxCorrection: 0.1, maxU95: 0.2 }
    : instrument.sphygmomanometer
      ? { x: 50, x1: 0, x2: 100, c1: -0.2, c2: -0.1, reading: 50, accuracyClass: 1, standardDeviation: 0.1, drift: 0.2, dpmU95: 0.3, k95: 2, sumU2: 0.5, minimumU95: 0.99, setting: 50, mean: 50, pressureTolerance: 4, decisionValue: 1, leakageDrop: 5, leakageLimit: 15, rapidDeflationSeconds: 5, deflationLimit: 10 }
      : instrument.suctionPump
        ? { mean: 150, setting: -150, intercept: 0.3, slope: 0.0034, signedMean: 150, correction: 0.1, correctedMean: -149.9, standardDeviation: 0.2, n: 6, meterResolution: 20, meterU95: 0.31, drift: 0.2, uResolution: 1, ua: 0.1, uDrift: 0.1, uDpm: 0.15, k95: 2, error: 0.1, toleranceRatio: 0.1, vacuumMagnitude: 300, minimumVacuum: 150, maximumVacuum: 450, legacyMinimumVacuum: 300, seconds: 5, maximumSeconds: 10, pressurePassCount: 10, pressurePointCount: 5, pressureRate: 100, vacuumReadingPassed: 1, vacuumTimePassed: 1 }
        : { intercept: 0.1, slope: 0.01, mean: 20, setting: 20, standardDeviation: 0.2, flowResolution: 0.01, drift: 0.2, certificateU95: 0.2, k95: 2, flowToleranceRatio: 0.1, error: 0.1, testValue: 0.005, tolerance: 0.1, occlusionResolution: 0.01, ua: 0.1, occlusionDpmU95: 0.012, limit: 20, flowPassRate: 90, occlusionPassed: 1, leakagePassed: 1, deflationPassed: 1, upPassCount: 5, downPassCount: 4 }
  Object.assign(variables, {
    voltage: 220, voltageMinimum: 198, voltageMaximum: 242, earth: 0.1, earthLimit: 0.3,
    equipmentLeakage: 20, leakageLimit: 1000, appliedLeakage: 10, appliedLeakageLimit: 50,
    appliedLeakageNA: 0, insulationResistance: 5, insulationMinimum: 2, passedCount: 4, scorePerCheck: 8,
  });
  try {
    for (const field of instrumentFormulaFields(instrument)) {
      const result = evaluateFormulaExpression(expressions[field.key] ?? field.expression, variables);
      const key = field.key.split('.').at(-1) ?? field.key;
      if (typeof result === 'number' && Number.isFinite(result)) {
        if (key.toLowerCase().includes('pass')) throw new Error(`${field.label} harus menghasilkan aturan lulus.`);
        if ((key.toLowerCase().startsWith('u') || key.toLowerCase().includes('u95')) && result < 0) throw new Error(`${field.label} tidak boleh negatif.`);
        if (key === 'score' && (result < 0 || result > 100)) throw new Error(`${field.label} harus berada di antara 0 dan 100.`);
        variables[key] = result;
        if (key === 'interpolation' || key === 'flowCorrection' || key === 'occlusionCorrection') variables.correction = result;
        if (key === 'flowUResolution' || key === 'occlusionUResolution') variables.uResolution = result;
        if (key === 'flowUDrift') variables.uDrift = result;
        if (key === 'flowUCertificate') variables.uCertificate = result;
        if (key === 'flowTolerance') variables.tolerance = result;
        if (key === 'flowTestValue') variables.testValue = result;
        if (key === 'occlusionUa') variables.ua = result;
        if (key === 'occlusionUDpm') variables.uDpm = result;
        if (key === 'signedMean') variables.signedMean = result;
        if (key === 'correctedMean') variables.correctedMean = result;
        if (key === 'error') variables.error = result;
        if (key === 'performanceRate') variables.pressureRate = result;
      } else if (typeof result === 'boolean') {
        if (!key.toLowerCase().includes('pass')) throw new Error(`${field.label} harus menghasilkan angka.`);
      } else throw new Error(`${field.label} harus menghasilkan angka atau aturan lulus.`);
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Rumus tidak valid.';
  }
}

export const defaultElectricalSafetyExpressions = Object.fromEntries(safetyFields.map(({ key, expression }) => [key, expression]));

export const defaultEnvironmentExpressions = {
  interpolation: 'c1 + (x - x1) * (c2 - c1) / (x2 - x1)',
  correctedReading: 'reading + correction',
  mean: '(correctedStart + correctedEnd) / 2',
  range: 'abs(correctedStart - correctedEnd)',
  ua: 'standardDeviation / sqrt(2)',
  uResolution: '(0.5 * resolution) / sqrt(3)',
  u95: '2 * sqrt(ua^2 + certificateU95^2 + uResolution^2)',
};

export const environmentFormulaFields: FormulaFieldDefinition[] = [
  { key: 'interpolation', label: 'Interpolasi koreksi sertifikat', detail: 'Variabel: x, x1, x2, c1, c2.', expression: defaultEnvironmentExpressions.interpolation },
  { key: 'correctedReading', label: 'Bacaan terkoreksi', detail: 'Variabel: reading, correction.', expression: defaultEnvironmentExpressions.correctedReading },
  { key: 'mean', label: 'Rata-rata kondisi', detail: 'Variabel: correctedStart, correctedEnd.', expression: defaultEnvironmentExpressions.mean },
  { key: 'range', label: 'Rentang kondisi', detail: 'Variabel: correctedStart, correctedEnd.', expression: defaultEnvironmentExpressions.range },
  { key: 'ua', label: 'UA pengulangan', detail: 'Variabel: standardDeviation.', expression: defaultEnvironmentExpressions.ua },
  { key: 'uResolution', label: 'Ketidakpastian resolusi', detail: 'Variabel: resolution.', expression: defaultEnvironmentExpressions.uResolution },
  { key: 'u95', label: 'U95 kondisi lingkungan', detail: 'Variabel: ua, certificateU95, uResolution.', expression: defaultEnvironmentExpressions.u95 },
];

export function validateEnvironmentFormulaExpressions(expressions: Record<string, string>): string | null {
  const variables: Record<string, number> = {
    x: 25, x1: 20, x2: 30, c1: 0.1, c2: 0.2, reading: 25, correction: 0.15,
    correctedStart: 25.15, correctedEnd: 25.25, standardDeviation: 0.1, resolution: 0.1,
    ua: 0.1, certificateU95: 0.5, uResolution: 0.03,
  };
  try {
    for (const field of environmentFormulaFields) {
      const result = evaluateFormulaExpression(expressions[field.key] ?? field.expression, variables);
      if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error(`${field.label} harus menghasilkan angka.`);
      variables[field.key] = result;
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Rumus kondisi lingkungan tidak valid.';
  }
}
