import type { Standard, WeighingScaleConfig, WeighingStandardWeight, WeighingTestPoint } from './types';

export const adultScaleStandardWeights: WeighingStandardWeight[] = [
  { name: 'Anak timbangan', brand: 'Kern & Sohn GmbH', model: 'M1', serial: '(10.1) G2128013', nominalKg: 10, uncertaintyU95G: 0.099, conventionalMass2025G: 10000.2, conventionalMass2026G: 10000.11 },
  { name: 'Anak timbangan', brand: 'Kern & Sohn GmbH', model: 'M1', serial: '(20.1) G2128057', nominalKg: 20, uncertaintyU95G: 0.17, conventionalMass2025G: 20000.35, conventionalMass2026G: 20000.24 },
  { name: 'Anak timbangan', brand: 'Kern & Sohn GmbH', model: 'M1', serial: '(20.2) G2128058', nominalKg: 20, uncertaintyU95G: 0.17, conventionalMass2025G: 20000.1, conventionalMass2026G: 20000.44 },
  { name: 'Anak timbangan', brand: 'Kern & Sohn GmbH', model: 'M1', serial: '(20.3) G2128059', nominalKg: 20, uncertaintyU95G: 0.17, conventionalMass2025G: 20000.2, conventionalMass2026G: 20000.44 },
  { name: 'Anak timbangan', brand: 'Kern & Sohn GmbH', model: 'M1', serial: '(20.4) G2128060', nominalKg: 20, uncertaintyU95G: 0.17, conventionalMass2025G: 20000.6, conventionalMass2026G: 20000.34 },
  { name: 'Anak timbangan', brand: 'Kern & Sohn GmbH', model: 'M1', serial: '(20.5) G2128061', nominalKg: 20, uncertaintyU95G: 0.17, conventionalMass2025G: 20000.1, conventionalMass2026G: 20000.24 },
];

const adultScaleTestPoints: WeighingTestPoint[] = [
  { id: '10', loadKg: 10, defaultStandardWeightSerials: ['(10.1) G2128013'] },
  { id: '20', loadKg: 20, defaultStandardWeightSerials: ['(20.1) G2128057'] },
  { id: '30', loadKg: 30, defaultStandardWeightSerials: ['(10.1) G2128013', '(20.1) G2128057'] },
  { id: '40', loadKg: 40, defaultStandardWeightSerials: ['(20.1) G2128057', '(20.2) G2128058'] },
  { id: '50', loadKg: 50, defaultStandardWeightSerials: ['(10.1) G2128013', '(20.2) G2128058', '(20.3) G2128059'] },
  { id: '60', loadKg: 60, defaultStandardWeightSerials: ['(20.1) G2128057', '(20.2) G2128058', '(20.3) G2128059'] },
  { id: '70', loadKg: 70, defaultStandardWeightSerials: ['(10.1) G2128013', '(20.1) G2128057', '(20.2) G2128058', '(20.3) G2128059'] },
  { id: '80', loadKg: 80, defaultStandardWeightSerials: ['(20.1) G2128057', '(20.2) G2128058', '(20.3) G2128059', '(20.4) G2128060'] },
  { id: '90', loadKg: 90, defaultStandardWeightSerials: ['(10.1) G2128013', '(20.1) G2128057', '(20.2) G2128058', '(20.3) G2128059', '(20.4) G2128060'] },
  { id: '100', loadKg: 100, defaultStandardWeightSerials: ['(20.1) G2128057', '(20.2) G2128058', '(20.3) G2128059', '(20.4) G2128060', '(20.5) G2128061'] },
];

const createScaleConfig = (capacityKg: number, resolutionKg: number, resolutionDivisor: 3 | 6): WeighingScaleConfig => ({
  capacityKg,
  resolutionKg,
  resolutionDivisor,
  repeatabilityLoadKg: 40,
  points: adultScaleTestPoints,
});

export const adultScaleDigital = createScaleConfig(150, 0.1, 3);
export const adultScaleMechanical = createScaleConfig(130, 1, 6);

export const adultScaleStandards: Standard[] = [
  ['Thermohygrometer', 'Elitech', 'GSP-6', 'EFG19BE02496'],
];
