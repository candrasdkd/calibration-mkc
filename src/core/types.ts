export type PerformanceFormula =
  | 'centrifugeSpeed' | 'centrifugeTime' | 'fetalHeartRate' | 'flowmeter' | 'infusionFlow'
  | 'workbookAccuracy' | 'workbookMinimum' | 'workbookMaximum' | 'workbookBand'
  | 'workbookPairedAccuracy' | 'workbookComparisonAccuracy' | 'workbookRange' | 'customExpression';
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
  physicalThreshold?: number;
  overallPassThreshold?: number;
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
  degreesOfFreedom: [number, number, number, number];
  points: WeighingTestPoint[];
}

export interface ElectricalSafetyConfig {
  voltageMinimumV: number;
  voltageMaximumV: number;
  earthResistanceLimitsOhm: [number, number, number, number];
  leakageCurrentLimitsMa: [number, number, number, number];
  appliedLeakageLimitMa: number;
  insulationMinimumMOhm: number;
  scorePerPassedCheck: number;
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
  leakageLimitMmHg: number;
  deflationLimitSeconds: number;
  pressureToleranceMmHg: number;
  minimumPressureU95MmHg: number;
  degreesOfFreedom: [number, number, number, number];
}

export type NumericCurvePoint = [setting: number, value: number];

export interface InfusionPumpChannelConfig {
  channel: string;
  flowSlope: number;
  flowIntercept: number;
  flowDrift: NumericCurvePoint[];
  occlusionSlope: number;
  occlusionIntercept: number;
}

export interface InfusionPumpMethodConfig {
  channels: InfusionPumpChannelConfig[];
  flowCertificateU95: NumericCurvePoint[];
  flowDegreesOfFreedom: [number, number, number, number];
  occlusionDegreesOfFreedom: [number, number, number];
  flowResolution: number;
  occlusionResolution: number;
  occlusionDpmU95: number;
  flowToleranceRatio: number;
  occlusionLimit: number;
}

export interface SuctionPumpConfig {
  pressurePoints: number[];
  minimumVacuumMmHg: number;
  maximumVacuumMmHg: number;
  legacyMinimumVacuumMmHg: number;
  maximumVacuumSeconds: number;
  pressureToleranceRatio: number;
  meterResolution: number;
  meterU95: number;
  degreesOfFreedom: [number, number, number, number];
  slopeUp: number;
  interceptUp: number;
  slopeDown: number;
  interceptDown: number;
  driftUp: NumericCurvePoint[];
  driftDown: NumericCurvePoint[];
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

export interface InfusionPumpData {
  channel: string;
  occlusionReadings: string[];
}

export interface SuctionPumpPressureInput {
  setting: number;
  up: string[];
  down: string[];
}

export interface SuctionPumpData {
  pressureReadings: SuctionPumpPressureInput[];
  maximumVacuumReading: string;
  maximumVacuumSeconds: string;
}

export interface PerformanceSetting {
  id: string;
  label: string;
  setting: string;
  unit: string;
  count: number;
  tolerancePercent: string;
  formula: PerformanceFormula;
  absoluteTolerance?: string;
  minimumSetting?: string;
  maximumSetting?: string;
  toleranceBySetting?: { setting: string; tolerance: string }[];
  references?: MeasurementReferences;
  includeUncertainty?: boolean;
  includeInScore?: boolean;
  uncertaintyRule?: 'signed' | 'absolute';
  sourceIds?: string[];
  customExpressions?: {
    correction: string;
    uncertainty: string;
    tolerance: string;
    testValue: string;
    pass: string;
  };
}

export type Standard = [name: string, brand: string, model: string, serial: string];

export interface Instrument {
  id: string;
  templateId?: string;
  name: string;
  subtitle: string;
  standards: Standard[];
  inspectionItems: string[];
  performanceRows: PerformanceSetting[];
  references: MeasurementReferences;
  score: InstrumentScore;
  electricalSafety?: boolean;
  methodVersion?: number;
  formulaExpressions?: Record<string, string>;
  electricalSafetyConfig?: ElectricalSafetyConfig;
  weighingScale?: WeighingScaleConfig;
  sphygmomanometer?: SphygmomanometerConfig;
  infusionPump?: InfusionPumpMethodConfig;
  suctionPump?: SuctionPumpConfig;
}

export interface VersionedFormulaMethod {
  version: number;
  resolution: number;
  expressions: Record<string, string>;
}

export interface MethodChangeMetadata {
  source: string;
  reason: string;
  verificationNote: string;
  verifiedBy: string;
  effectiveDate: string;
}

export interface InstrumentMethodRevision extends Partial<MethodChangeMetadata> {
  instrumentId: string;
  version: number;
  updatedAt: string;
  instrument: Instrument;
}

export interface InstrumentMethodDraft extends MethodChangeMetadata {
  instrumentId: string;
  updatedAt: string;
  instrument: Instrument;
}

export type EnvironmentMethodDraft = Omit<VersionedFormulaMethod, 'version'> & MethodChangeMetadata & { updatedAt: string };
export type EnvironmentMethodRevision = VersionedFormulaMethod & Partial<MethodChangeMetadata> & { updatedAt: string };

export interface CustomEquipment {
  id: string;
  templateId: string;
  name: string;
  method: string;
  standardNames: string[];
}

export interface IdentityData {
  customerId: string;
  documentNumber: string;
  orderNumber: string;
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
  formulaMethod?: VersionedFormulaMethod;
}

export interface InspectionEntry {
  label: string;
  physical: InspectionChoice;
  function: InspectionChoice;
  note: string;
}

export interface PerformanceEntry extends PerformanceSetting {
  readings: string[];
  standardReadings?: string[];
  pairedReadings?: string[];
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
  earthMeets?: '' | 'Ya' | 'Tidak';
  leakageType: string;
  equipmentLeakage: string;
  equipmentLeakageMeets?: '' | 'Ya' | 'Tidak';
  appliedLeakage: string;
  appliedLeakageMeets?: '' | 'Ya' | 'Tidak';
  appliedLeakageNA: boolean;
  insulationResistance: string;
  insulationMeets?: '' | 'Ya' | 'Tidak';
}

export interface CalibrationData {
  identity: IdentityData;
  orderGroupId?: string;
  equipmentPhotos?: EquipmentPhotos;
  equipmentPhotoPaths?: EquipmentPhotos;
  selectedDevices?: SelectedMeasurementDevice[];
  environment: EnvironmentData;
  references: MeasurementReferences;
  inspections: InspectionEntry[];
  performance: PerformanceEntry[];
  weighing?: WeighingData;
  sphygmomanometer?: SphygmomanometerData;
  infusionPump?: InfusionPumpData;
  suctionPump?: SuctionPumpData;
  safety: SafetyData;
}

export interface EquipmentPhotos {
  front: string;
  back: string;
  left: string;
  right: string;
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
  instrumentSnapshot?: Instrument;
  createdAt: string;
  updatedAt: string;
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
  correctedMean?: number;
  error?: number;
  standardMean?: number;
  standardU95?: number;
  standardPass?: boolean;
  uutPass?: boolean;
}

export interface PumpOcclusionResult {
  mean: number;
  correction: number;
  correctedMean: number;
  uncertaintyU95: number;
  limit: number;
  pass: boolean;
  readings: number[];
}

export interface SuctionDirectionResult {
  readings: number[];
  mean: number;
  correction: number;
  correctedMean: number;
  error: number;
  uncertaintyU95: number;
  pass: boolean;
}

export interface SuctionPressureResult {
  setting: number;
  up: SuctionDirectionResult | null;
  down: SuctionDirectionResult | null;
}

export interface SuctionPumpResult {
  pressureReadings: SuctionPressureResult[];
  maximumVacuumReading: number | null;
  maximumVacuumReadingPass: boolean | null;
  maximumVacuumSeconds: number | null;
  maximumVacuumPass: boolean | null;
  complete: boolean;
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
  reportCorrection: number | null;
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
  reportStandardDeviation: number | null;
  repeatabilityReadings: WeighingRepeatabilityResult[];
  points: WeighingPointResult[];
  maxAbsoluteCorrection: number | null;
  maxUncertaintyU95: number | null;
  lop: number | null;
  limit: number | null;
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
  pumpOcclusion: PumpOcclusionResult | null;
  suctionPump: SuctionPumpResult | null;
  safety: SafetyResult | null;
  safetyScore: number | null;
  score: number | null;
  missing: string[];
  complete: boolean;
  status: string;
}
