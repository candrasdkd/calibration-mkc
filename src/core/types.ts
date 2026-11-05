export type PerformanceFormula = 'centrifugeSpeed' | 'centrifugeTime' | 'fetalHeartRate' | 'flowmeter';
export type InspectionChoice = '' | 'Baik' | 'Tidak baik';
export type DocumentKind = 'report' | 'certificate';

export interface ThermohygrometerPoint {
  value: number;
  correction: number;
}

export interface Thermohygrometer {
  id: string;
  serial: string;
  temperature: ThermohygrometerPoint[];
  humidity: ThermohygrometerPoint[];
  temperatureU95: number;
  humidityU95: number;
}

export interface MeasurementReferences {
  calibratorResolution: string;
  calibratorUncertainty: string;
  uutResolution: string;
}

export interface InstrumentScore {
  performanceThreshold: number;
  performanceWeight: number;
  physicalWeight: number;
}

export interface WeighingStandardWeight {
  name: string;
  brand: string;
  model: string;
  serial: string;
  nominalKg: number;
  uncertaintyU95G: number;
  conventionalMass2025G: number;
  conventionalMass2026G: number;
}

export interface WeighingTestPoint {
  id: string;
  loadKg: number;
  defaultStandardWeightSerials: string[];
}

export interface WeighingScaleConfig {
  capacityKg: number;
  resolutionKg: number;
  resolutionDivisor: 3 | 6;
  repeatabilityLoadKg: number;
  points: WeighingTestPoint[];
}

export interface SphygmomanometerPoint {
  pressure: number;
  up: number;
  down: number;
}

export interface SphygmomanometerConfig {
  capacityMmHg: number;
  accuracyClass: number;
  pressurePoints: number[];
  dpmCorrections: SphygmomanometerPoint[];
  dpmU95: number;
  drift: SphygmomanometerPoint[];
}

export interface SphygmomanometerPressureInput {
  setting: number;
  up: string[];
  down: string[];
}

export interface SphygmomanometerData {
  leakageDrop: string;
  rapidDeflationSeconds: string;
  pressureReadings: SphygmomanometerPressureInput[];
}

export interface PerformanceSetting {
  id: string;
  label: string;
  setting: string;
  unit: string;
  count: number;
  tolerancePercent: string;
  formula: PerformanceFormula;
}

export type Standard = [name: string, brand: string, model: string, serial: string];

export interface Instrument {
  id: string;
  name: string;
  subtitle: string;
  standards: Standard[];
  inspectionItems: string[];
  performanceRows: PerformanceSetting[];
  references: MeasurementReferences;
  score: InstrumentScore;
  weighingScale?: WeighingScaleConfig;
  sphygmomanometer?: SphygmomanometerConfig;
}

export interface IdentityData {
  customerId: string;
  documentNumber: string;
  labelNumber: string;
  brand: string;
  model: string;
  serial: string;
  capacity: string;
  accuracy: string;
  technician: string;
  receivedDate: string;
  testDate: string;
  issueDate: string;
  room: string;
  customer: string;
  address: string;
  city: string;
  method: string;
}

export interface EnvironmentData {
  standardId: string;
  reference?: Thermohygrometer | null;
  temperatureStart: string;
  temperatureEnd: string;
  humidityStart: string;
  humidityEnd: string;
}

export interface InspectionEntry {
  label: string;
  physical: InspectionChoice;
  function: InspectionChoice;
  note: string;
}

export interface PerformanceEntry extends PerformanceSetting {
  readings: string[];
}

export interface WeighingPointInput {
  id: string;
  zeroReading: string;
  indication: string;
  standardWeights: WeighingStandardWeight[];
}

export interface WeighingRepeatabilityInput {
  zeroReading: string;
  indication: string;
}

export interface WeighingData {
  repeatabilityReadings: WeighingRepeatabilityInput[];
  points: WeighingPointInput[];
  standardsInitialized: boolean;
}

export interface SafetyData {
  voltage: string;
  earthType: string;
  earthResistance: string;
  leakageType: string;
  equipmentLeakage: string;
  appliedLeakage: string;
  appliedLeakageNA: boolean;
  insulationResistance: string;
}

export interface CalibrationData {
  identity: IdentityData;
  selectedDevices?: SelectedMeasurementDevice[];
  environment: EnvironmentData;
  references: MeasurementReferences;
  inspections: InspectionEntry[];
  performance: PerformanceEntry[];
  weighing?: WeighingData;
  sphygmomanometer?: SphygmomanometerData;
  safety: SafetyData;
}

export interface SelectedMeasurementDevice {
  id: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
}

export interface CalibrationRecord {
  id: string;
  instrumentId: string;
  createdAt: string;
  updatedAt: string;
  isDemo?: boolean;
  data: CalibrationData;
}

export interface EnvironmentMeasurement {
  start: number;
  end: number;
  startCorrection: number;
  endCorrection: number;
  correctedStart: number;
  correctedEnd: number;
  mean: number;
  range: number;
  u95: number;
}

export interface EnvironmentResult {
  reference: Thermohygrometer | null;
  temperature: EnvironmentMeasurement | null;
  humidity: EnvironmentMeasurement | null;
  errors: string[];
}

export interface CalculatedPerformance {
  setting: number;
  mean: number;
  correction: number;
  ua: number;
  u95: number;
  tolerance: number;
  testValue: number;
  pass: boolean;
  readings: number[];
}

export interface PerformanceResultRow extends PerformanceEntry {
  result: CalculatedPerformance | null;
}

export interface WeighingPointResult {
  id: string;
  loadKg: number;
  zeroReading: number | null;
  indication: number | null;
  standardWeightSerials: string[];
  standardWeightsComplete: boolean;
  referenceMassKg: number | null;
  correction: number | null;
  uncertaintyU95Kg: number | null;
  complete: boolean;
}

export interface WeighingRepeatabilityResult {
  zeroReading: number | null;
  indication: number | null;
  difference: number | null;
}

export interface WeighingResult {
  repeatabilityMean: number | null;
  repeatabilityStandardDeviation: number | null;
  reportStandardDeviation: number;
  repeatabilityReadings: WeighingRepeatabilityResult[];
  points: WeighingPointResult[];
  maxAbsoluteCorrection: number | null;
  maxUncertaintyU95: number | null;
  lop: number | null;
  limit: number;
  pass: boolean | null;
  complete: boolean;
}

export interface SphygmomanometerDirectionResult {
  readings: (number | null)[];
  correctedReadings: (number | null)[];
  mean: number | null;
  standardDeviation: number | null;
  correction: number | null;
  uncertaintyU95: number | null;
  decisionValue: number | null;
  complete: boolean;
  pass: boolean | null;
}

export interface SphygmomanometerPressureResult {
  setting: number;
  up: SphygmomanometerDirectionResult;
  down: SphygmomanometerDirectionResult;
}

export interface SphygmomanometerResult {
  leakageDrop: { value: number | null; pass: boolean | null };
  rapidDeflationSeconds: { value: number | null; pass: boolean | null };
  pressureReadings: SphygmomanometerPressureResult[];
  complete: boolean;
}

export interface InspectionResult extends InspectionEntry {
  complete: boolean;
  passed: boolean;
}

export interface SafetyCheck {
  label: string;
  result: boolean | null;
  measured: string;
  limit: string;
}

export interface SafetyResult {
  checks: SafetyCheck[];
  complete: boolean;
  score: number | null;
}

export interface CalculationResult {
  environment: EnvironmentResult;
  inspections: InspectionResult[];
  inspectionRate: number | null;
  physicalScore: number | null;
  performance: PerformanceResultRow[];
  performanceRate: number | null;
  performanceScore: number | null;
  weighing: WeighingResult | null;
  sphygmomanometer: SphygmomanometerResult | null;
  safety: SafetyResult | null;
  safetyScore: number | null;
  score: number | null;
  missing: string[];
  complete: boolean;
  status: string;
}
