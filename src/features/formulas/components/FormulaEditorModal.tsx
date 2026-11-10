import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PickerField } from '../../../components/picker/PickerField';
import { PickerOption } from '../../../components/picker/PickerOption';
import { SearchPickerModal } from '../../../components/picker/SearchPickerModal';
import { ActionButton, Badge, Card, Choice, ConfirmModal, Field, Heading } from '../../../components/ui';
import { defaultFormulaExpressions, validateFormulaExpressions } from '../../../core/formulaExpressions';
import { instrumentFormulaFields, validateInstrumentFormulaExpressions } from '../../../core/methodFormulas';
import type { Instrument, InstrumentMethodDraft, MethodChangeMetadata, PerformanceFormula } from '../../../core/types';
import { styles } from '../styles/FormulaEditorModalStyles';

const formulaOptions: { value: PerformanceFormula; label: string; detail: string }[] = [
  { value: 'centrifugeSpeed', label: 'Kecepatan putar', detail: 'Koreksi dari rata-rata terhadap setting, dengan ketidakpastian.' },
  { value: 'centrifugeTime', label: 'Waktu putar', detail: 'Koreksi waktu dari rata-rata terhadap setting.' },
  { value: 'fetalHeartRate', label: 'Heart rate', detail: 'Selisih absolut dari nilai setting BPM.' },
  { value: 'flowmeter', label: 'Laju aliran', detail: 'Perbandingan rata-rata aliran dengan setting.' },
  { value: 'infusionFlow', label: 'Laju aliran pompa', detail: 'Koreksi analyzer dan channel infusion/syringe pump.' },
  { value: 'workbookAccuracy', label: 'Akurasi terhadap setting', detail: 'Koreksi, U95, dan toleransi terhadap setting.' },
  { value: 'workbookMinimum', label: 'Batas minimum', detail: 'Nilai keputusan harus sama dengan atau lebih besar dari batas.' },
  { value: 'workbookMaximum', label: 'Batas maksimum', detail: 'Nilai keputusan harus sama dengan atau lebih kecil dari batas.' },
  { value: 'workbookBand', label: 'Rentang batas', detail: 'Nilai harus berada di antara batas bawah dan atas.' },
  { value: 'workbookPairedAccuracy', label: 'Bacaan berpasangan', detail: 'Menghitung rata-rata dari bacaan minimum dan maksimum.' },
  { value: 'workbookComparisonAccuracy', label: 'Perbandingan UUT dan standar', detail: 'Menghitung dan memeriksa bacaan UUT serta bacaan standar.' },
  { value: 'workbookRange', label: 'Variasi rentang', detail: 'Menghitung maksimum dikurangi minimum dari baris sumber.' },
  { value: 'customExpression', label: 'Rumus kustom', detail: 'Atur persamaan koreksi, U95, toleransi, nilai keputusan, dan lulus.' },
];

const expressionLabels = {
  correction: 'Koreksi', uncertainty: 'U95 / ketidakpastian', tolerance: 'Toleransi',
  testValue: 'Nilai keputusan', pass: 'Aturan lulus',
} as const;

function cloneInstrument(instrument: Instrument): Instrument {
  return JSON.parse(JSON.stringify(instrument)) as Instrument;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function FormulaEditorModal({ visible, instrument, version, existingDraft, onClose, onSaveDraft, onPublish, onDiscardDraft }: {
  visible: boolean;
  instrument: Instrument;
  version: number;
  existingDraft?: InstrumentMethodDraft;
  onClose: () => void;
  onSaveDraft: (instrument: Instrument, metadata: MethodChangeMetadata) => void;
  onPublish: (instrument: Instrument, metadata: MethodChangeMetadata) => void;
  onDiscardDraft: () => void;
}) {
  const [draft, setDraft] = useState(() => cloneInstrument(existingDraft?.instrument ?? instrument));
  const [metadata, setMetadata] = useState<MethodChangeMetadata>(() => existingDraft ? {
    source: existingDraft.source, reason: existingDraft.reason, verificationNote: existingDraft.verificationNote,
    verifiedBy: existingDraft.verifiedBy, effectiveDate: existingDraft.effectiveDate,
  } : { source: '', reason: '', verificationNote: '', verifiedBy: '', effectiveDate: today() });
  const [formulaPickerRow, setFormulaPickerRow] = useState<string | null>(null);
  const [formulaSearch, setFormulaSearch] = useState('');
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDraftSave, setConfirmDraftSave] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedRow = draft.performanceRows.find((row) => row.id === formulaPickerRow);
  const specialFormulaFields = instrumentFormulaFields(draft);
  const filteredFormulas = formulaOptions.filter((formula) => (!instrument.infusionPump || formula.value === 'infusionFlow')
    && (formula.value !== 'workbookRange'
    || Boolean(selectedRow?.sourceIds?.length))
    && (formula.value !== 'customExpression'
      || !selectedRow || !['workbookPairedAccuracy', 'workbookComparisonAccuracy', 'workbookRange'].includes(selectedRow.formula))
    && (!formulaSearch.trim()
      || `${formula.label} ${formula.detail}`.toLowerCase().includes(formulaSearch.trim().toLowerCase())));

  const updateInstrument = (key: 'references' | 'score', field: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: { ...current[key], [field]: key === 'score' ? Number(value.replace(',', '.')) || 0 : value } }));
  };
  const updateFormulaExpression = (key: string, value: string) => setDraft((current) => ({
    ...current,
    formulaExpressions: { ...current.formulaExpressions, [key]: value },
  }));
  const updateConfigNumber = (section: 'weighingScale' | 'sphygmomanometer' | 'infusionPump' | 'suctionPump' | 'electricalSafetyConfig', key: string, value: string) => {
    const configValue = Number(value.replace(',', '.'));
    setDraft((current) => {
      const config = current[section] as unknown as Record<string, unknown> | undefined;
      return config ? { ...current, [section]: { ...config, [key]: configValue } } as Instrument : current;
    });
  };
  const updateConfigArrayNumber = (section: 'weighingScale' | 'sphygmomanometer' | 'infusionPump' | 'suctionPump' | 'electricalSafetyConfig', key: string, index: number, value: string) => {
    const numeric = Number(value.replace(',', '.'));
    setDraft((current) => {
      const config = current[section] as unknown as Record<string, unknown> | undefined;
      if (!config || !Array.isArray(config[key])) return current;
      const values = [...config[key] as number[]];
      values[index] = numeric;
      return { ...current, [section]: { ...config, [key]: values } } as Instrument;
    });
  };
  const updateConfigPoints = (section: 'sphygmomanometer' | 'suctionPump', value: string) => {
    const points = value.split(',').map((item) => Number(item.trim().replace(',', '.'))).filter(Number.isFinite);
    setDraft((current) => {
      const config = current[section] as unknown as Record<string, unknown> | undefined;
      if (!config) return current;
      if (section === 'sphygmomanometer') {
        const sphyg = current.sphygmomanometer!;
        const drift = points.map((pressure) => sphyg.drift.find((item) => item.pressure === pressure) ?? { pressure, up: 0, down: 0 });
        return { ...current, sphygmomanometer: { ...sphyg, pressurePoints: points, drift } };
      }
      return { ...current, suctionPump: { ...current.suctionPump!, pressurePoints: points } };
    });
  };
  const updateConfigTableNumber = (
    section: 'weighingScale' | 'sphygmomanometer' | 'infusionPump' | 'suctionPump',
    table: string,
    index: number,
    field: string | number,
    value: string,
    channelIndex?: number,
  ) => {
    const numeric = Number(value.replace(',', '.'));
    setDraft((current) => {
      const config = current[section] as unknown as Record<string, unknown> | undefined;
      if (!config) return current;
      if (section === 'infusionPump' && table === 'channels') {
        const channels = [...(config.channels as Record<string, unknown>[])];
        channels[index] = { ...channels[index], [field]: numeric };
        return { ...current, infusionPump: { ...current.infusionPump!, channels: channels as unknown as NonNullable<Instrument['infusionPump']>['channels'] } };
      }
      if (section === 'infusionPump' && table === 'channelFlowDrift') {
        const channels = [...(config.channels as Record<string, unknown>[])];
        const channel = { ...channels[channelIndex ?? 0] };
        const drift = [...(channel.flowDrift as number[][])];
        drift[index] = [...drift[index]];
        drift[index][Number(field)] = numeric;
        channel.flowDrift = drift;
        channels[channelIndex ?? 0] = channel;
        return { ...current, infusionPump: { ...current.infusionPump!, channels: channels as unknown as NonNullable<Instrument['infusionPump']>['channels'] } };
      }
      const values = [...(config[table] as unknown[])];
      const item = values[index];
      if (Array.isArray(item)) {
        const tuple = [...item];
        tuple[Number(field)] = numeric;
        values[index] = tuple;
      } else if (item && typeof item === 'object') values[index] = { ...item, [field]: numeric };
      return { ...current, [section]: { ...config, [table]: values } } as Instrument;
    });
  };
  const updateWeighingPoint = (index: number, load: string) => {
    const loadKg = Number(load.replace(',', '.'));
    setDraft((current) => current.weighingScale ? {
      ...current,
      weighingScale: { ...current.weighingScale, points: current.weighingScale.points.map((point, itemIndex) => itemIndex === index ? { ...point, loadKg } : point) },
    } : current);
  };
  const addWeighingPoint = () => setDraft((current) => current.weighingScale ? {
    ...current,
    weighingScale: { ...current.weighingScale, points: [...current.weighingScale.points, { id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, loadKg: 0, defaultStandardWeightSerials: [] }] },
  } : current);
  const removeWeighingPoint = (id: string) => setDraft((current) => current.weighingScale ? {
    ...current,
    weighingScale: { ...current.weighingScale, points: current.weighingScale.points.filter((point) => point.id !== id) },
  } : current);
  const appendConfigTableRow = (section: 'sphygmomanometer' | 'infusionPump' | 'suctionPump', table: string, channelIndex?: number) => setDraft((current) => {
    if (section === 'sphygmomanometer' && current.sphygmomanometer) {
      const config = current.sphygmomanometer;
      const row = { pressure: 0, up: 0, down: 0 };
      return { ...current, sphygmomanometer: { ...config, [table]: [...config[table as 'drift' | 'dpmCorrections'], row] } };
    }
    if (section === 'infusionPump' && current.infusionPump) {
      const config = current.infusionPump;
      if (table === 'channelFlowDrift') {
        const channels = [...config.channels];
        const channel = channels[channelIndex ?? 0];
        channels[channelIndex ?? 0] = { ...channel, flowDrift: [...channel.flowDrift, [0, 0]] };
        return { ...current, infusionPump: { ...config, channels } };
      }
      return { ...current, infusionPump: { ...config, flowCertificateU95: [...config.flowCertificateU95, [0, 0]] } };
    }
    if (section === 'suctionPump' && current.suctionPump) {
      const config = current.suctionPump;
      const curve = table === 'driftUp' ? config.driftUp : config.driftDown;
      return { ...current, suctionPump: { ...config, [table]: [...curve, [0, 0]] } };
    }
    return current;
  });
  const removeConfigTableRow = (section: 'sphygmomanometer' | 'infusionPump' | 'suctionPump', table: string, index: number, channelIndex?: number) => setDraft((current) => {
    if (section === 'sphygmomanometer' && current.sphygmomanometer) {
      const config = current.sphygmomanometer;
      return { ...current, sphygmomanometer: { ...config, [table]: config[table as 'drift' | 'dpmCorrections'].filter((_, rowIndex) => rowIndex !== index) } };
    }
    if (section === 'infusionPump' && current.infusionPump) {
      const config = current.infusionPump;
      if (table === 'channelFlowDrift') {
        const channels = [...config.channels];
        const channel = channels[channelIndex ?? 0];
        channels[channelIndex ?? 0] = { ...channel, flowDrift: channel.flowDrift.filter((_, rowIndex) => rowIndex !== index) };
        return { ...current, infusionPump: { ...config, channels } };
      }
      return { ...current, infusionPump: { ...config, flowCertificateU95: config.flowCertificateU95.filter((_, rowIndex) => rowIndex !== index) } };
    }
    if (section === 'suctionPump' && current.suctionPump) {
      const config = current.suctionPump;
      const curve = table === 'driftUp' ? config.driftUp : config.driftDown;
      return { ...current, suctionPump: { ...config, [table]: curve.filter((_, rowIndex) => rowIndex !== index) } };
    }
    return current;
  });
  const updateRow = (id: string, key: string, value: string | boolean | PerformanceFormula) => {
    setDraft((current) => ({
      ...current,
      performanceRows: current.performanceRows.map((row) => {
        if (row.id !== id) return row;
        if (key === 'formula') {
          const formula = value as PerformanceFormula;
          return { ...row, formula, ...(formula === 'customExpression' ? { customExpressions: row.customExpressions ?? { ...defaultFormulaExpressions } } : {}) };
        }
        if (key === 'count') return { ...row, count: Math.max(0, Math.floor(Number(value) || 0)) };
        if (key === 'includeUncertainty') return { ...row, includeUncertainty: value === 'Ya' || value === true };
        if (key === 'uncertaintyRule') return { ...row, uncertaintyRule: value as 'signed' | 'absolute' };
        if (key.startsWith('customExpressions.')) {
          const expressionKey = key.slice('customExpressions.'.length) as keyof NonNullable<typeof row.customExpressions>;
          return { ...row, customExpressions: { ...(row.customExpressions ?? defaultFormulaExpressions), [expressionKey]: String(value) } };
        }
        return { ...row, [key]: String(value) };
      }),
    }));
  };
  const addRow = () => setDraft((current) => ({
    ...current,
    performanceRows: [...current.performanceRows, {
      id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, label: 'Titik pengujian baru', setting: '', unit: '', count: 5,
      tolerancePercent: '10', formula: 'workbookAccuracy',
    }],
  }));
  const removeRow = (id: string) => setDraft((current) => ({ ...current, performanceRows: current.performanceRows.filter((row) => row.id !== id) }));
  const chooseFormula = (formula: PerformanceFormula) => {
    if (!formulaPickerRow) return;
    updateRow(formulaPickerRow, 'formula', formula);
    setFormulaPickerRow(null);
  };
  const validateDraft = () => {
    if (!draft.performanceRows.length && !specialFormulaFields.length) return 'Alat ini belum memiliki konfigurasi rumus yang dapat diedit.';
    const numeric = (value: string) => Number(value.replace(',', '.'));
    for (const [label, value, minimum] of [
      ['Resolusi kalibrator', draft.references.calibratorResolution, 0],
      ['Ketidakpastian kalibrator', draft.references.calibratorUncertainty, 0],
      ['Resolusi UUT', draft.references.uutResolution, 0],
    ] as const) {
      if (!value.trim() || !Number.isFinite(numeric(value)) || numeric(value) < minimum
        || label !== 'Ketidakpastian kalibrator' && numeric(value) === 0) return `${label} harus berupa angka ${label === 'Ketidakpastian kalibrator' ? 'nol atau lebih' : 'lebih dari nol'}.`;
    }
    if (Object.values(draft.score).some((value) => value !== undefined && (!Number.isFinite(value) || value < 0 || value > 100))) return 'Bobot dan ambang skor harus berada di antara 0 dan 100.';
    if (specialFormulaFields.length) {
      if (Object.values(draft.formulaExpressions ?? {}).some((expression) => expression.length > 512)) return 'Rumus khusus maksimal 512 karakter per persamaan.';
      const error = validateInstrumentFormulaExpressions(draft, draft.formulaExpressions ?? {});
      if (error) return `Rumus kalkulator khusus: ${error}`;
    }
    const validCurve = (points: number[][], minimum = 2) => points.length >= minimum
      && points.every(([setting, value]) => Number.isFinite(setting) && Number.isFinite(value))
      && points.every(([setting], index) => index === 0 || setting > points[index - 1][0]);
    const validPositiveValues = (values: number[]) => values.length > 0 && values.every((value) => Number.isFinite(value) && value > 0);
    const validSettings = (values: number[]) => values.length > 0 && new Set(values).size === values.length
      && values.every(Number.isFinite)
      && (values.length < 2 || values.every((value, index) => index === 0 || value > values[index - 1])
        || values.every((value, index) => index === 0 || value < values[index - 1]));
    if (draft.weighingScale) {
      const config = draft.weighingScale;
      if (![config.capacityKg, config.resolutionKg, config.repeatabilityLoadKg].every(Number.isFinite)
        || config.capacityKg <= 0 || config.resolutionKg <= 0 || config.repeatabilityLoadKg <= 0 || !config.points.length
        || config.degreesOfFreedom.length !== 4 || !validPositiveValues(config.degreesOfFreedom)
        || new Set(config.points.map((point) => point.id)).size !== config.points.length
        || config.points.some((point) => !Number.isFinite(point.loadKg) || point.loadKg <= 0 || point.loadKg > config.capacityKg)) return 'Kapasitas, ketelitian, beban daya ulang, dan titik beban timbangan harus valid.';
    }
    if (draft.sphygmomanometer) {
      const config = draft.sphygmomanometer;
      if (![config.capacityMmHg, config.accuracyClass, config.dpmU95, config.minimumPressureU95MmHg, config.leakageLimitMmHg, config.deflationLimitSeconds, config.pressureToleranceMmHg].every(Number.isFinite)
        || config.capacityMmHg <= 0 || config.accuracyClass <= 0 || !validSettings(config.pressurePoints)
        || !validCurve(config.dpmCorrections.map((point) => [point.pressure, point.up]))
        || config.dpmCorrections.some((point) => !Number.isFinite(point.down))
        || config.pressurePoints.some((pressure) => !config.drift.some((point) => point.pressure === pressure))
        || !validCurve(config.drift.map((point) => [point.pressure, point.up]))
        || config.drift.some((point) => !Number.isFinite(point.down) || point.up < 0 || point.down < 0)
        || config.dpmCorrections.some((point) => point.up < 0 || point.down < 0)
        || config.dpmU95 < 0 || config.minimumPressureU95MmHg <= 0 || config.leakageLimitMmHg <= 0
        || config.deflationLimitSeconds <= 0 || config.pressureToleranceMmHg <= 0
        || config.degreesOfFreedom.length !== 4 || !validPositiveValues(config.degreesOfFreedom)) return 'Titik tekanan, kurva DPM, drift, dan batas sphygmomanometer harus valid.';
    }
    if (draft.infusionPump) {
      const config = draft.infusionPump;
      if (!config.channels.length || new Set(config.channels.map((channel) => channel.channel)).size !== config.channels.length
        || config.channels.some((channel) => ![channel.flowSlope, channel.flowIntercept, channel.occlusionSlope, channel.occlusionIntercept].every(Number.isFinite)
          || !validCurve(channel.flowDrift) || channel.flowDrift.some(([, value]) => value < 0))
        || !validCurve(config.flowCertificateU95) || config.flowCertificateU95.some(([, value]) => value < 0)
        || ![config.flowResolution, config.occlusionResolution, config.occlusionDpmU95, config.flowToleranceRatio, config.occlusionLimit].every(Number.isFinite)
        || config.flowResolution <= 0 || config.occlusionResolution <= 0 || config.occlusionDpmU95 < 0
        || config.flowToleranceRatio <= 0 || config.occlusionLimit <= 0
        || config.flowDegreesOfFreedom.length !== 4 || config.occlusionDegreesOfFreedom.length !== 3
        || !validPositiveValues([...config.flowDegreesOfFreedom, ...config.occlusionDegreesOfFreedom])) return 'Channel, kurva analyzer, nilai U95, dan batas pump harus valid.';
    }
    if (draft.suctionPump) {
      const config = draft.suctionPump;
      if (![config.minimumVacuumMmHg, config.maximumVacuumMmHg, config.legacyMinimumVacuumMmHg, config.maximumVacuumSeconds, config.pressureToleranceRatio, config.meterResolution, config.meterU95, config.slopeUp, config.interceptUp, config.slopeDown, config.interceptDown].every(Number.isFinite)
        || !validSettings(config.pressurePoints) || config.minimumVacuumMmHg <= 0 || config.maximumVacuumMmHg < config.minimumVacuumMmHg
        || config.legacyMinimumVacuumMmHg <= 0 || config.maximumVacuumSeconds <= 0 || config.pressureToleranceRatio <= 0
        || config.meterResolution <= 0 || config.meterU95 < 0
        || !validCurve(config.driftUp) || !validCurve(config.driftDown)
        || [...config.driftUp, ...config.driftDown].some(([, drift]) => drift < 0)
        || config.degreesOfFreedom.length !== 4 || !validPositiveValues(config.degreesOfFreedom)) return 'Titik vakum, kurva drift, koreksi DPM, dan batas suction pump harus valid.';
    }
    if (draft.electricalSafetyConfig) {
      const config = draft.electricalSafetyConfig;
      if (![config.voltageMinimumV, config.voltageMaximumV, config.appliedLeakageLimitMa, config.insulationMinimumMOhm, config.scorePerPassedCheck].every(Number.isFinite)
        || config.voltageMinimumV < 0 || config.voltageMaximumV <= config.voltageMinimumV
        || config.earthResistanceLimitsOhm.length !== 4 || config.leakageCurrentLimitsMa.length !== 4
        || [...config.earthResistanceLimitsOhm, ...config.leakageCurrentLimitsMa].some((value) => !Number.isFinite(value) || value <= 0)
        || config.appliedLeakageLimitMa <= 0 || config.insulationMinimumMOhm <= 0
        || config.scorePerPassedCheck < 0 || config.scorePerPassedCheck > 20) return 'Batas dan skor keselamatan listrik harus valid.';
    }
    const ids = draft.performanceRows.map((row) => row.id);
    if (new Set(ids).size !== ids.length) return 'ID titik uji tidak boleh sama.';
    for (const [index, row] of draft.performanceRows.entries()) {
      if (!row.label.trim() || !row.unit.trim() || !row.setting.trim() || !Number.isFinite(numeric(row.setting))) return `Nama, setting, dan satuan titik ${index + 1} wajib valid.`;
      if (!Number.isInteger(row.count) || row.count < 0 || row.count > 100 || row.count === 0 && row.formula !== 'workbookRange') return `Jumlah bacaan titik ${index + 1} harus antara satu dan 100.`;
      if (!row.tolerancePercent.trim() || !Number.isFinite(numeric(row.tolerancePercent)) || numeric(row.tolerancePercent) < 0) return `Toleransi titik ${index + 1} harus berupa angka nol atau lebih.`;
      if (row.absoluteTolerance?.trim() && (!Number.isFinite(numeric(row.absoluteTolerance)) || numeric(row.absoluteTolerance) < 0)) return `Toleransi absolut titik ${index + 1} harus berupa angka nol atau lebih.`;
      if (row.formula === 'workbookBand') {
        const minimum = numeric(row.minimumSetting ?? '');
        const maximum = numeric(row.maximumSetting ?? '');
        if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) return `Batas bawah dan atas titik ${index + 1} tidak valid.`;
      }
      if (row.formula === 'customExpression') {
        if (['workbookPairedAccuracy', 'workbookComparisonAccuracy', 'workbookRange'].includes(instrument.performanceRows.find((item) => item.id === row.id)?.formula ?? '')) return `Titik ${index + 1} memakai pola kompleks yang belum mendukung rumus kustom.`;
        if (Object.values(row.customExpressions ?? {}).some((expression) => expression.length > 512)) return `Rumus kustom titik ${index + 1} terlalu panjang (maksimal 512 karakter per persamaan).`;
        const error = validateFormulaExpressions(row.customExpressions ?? defaultFormulaExpressions);
        if (error) return `Rumus kustom pada titik ${index + 1}: ${error}`;
      }
    }
    return null;
  };
  const requestPublish = () => {
    const error = validateDraft();
    if (error) { Alert.alert('Metode belum valid', error); return; }
    if (!metadata.source.trim() || !metadata.reason.trim() || !metadata.verificationNote.trim() || !metadata.verifiedBy.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.effectiveDate)) {
      Alert.alert('Data verifikasi belum lengkap', 'Isi sumber acuan, alasan perubahan, catatan hasil pembanding, nama pemeriksa, dan tanggal berlaku sebelum mengaktifkan metode.');
      return;
    }
    setConfirmPublish(true);
  };
  const saveDraft = () => {
    setSaving(true);
    onSaveDraft(draft, metadata);
    setSaving(false);
    setConfirmDraftSave(false);
    onClose();
  };
  const publish = () => {
    setSaving(true);
    onPublish(draft, metadata);
    setSaving(false);
    setConfirmPublish(false);
    onClose();
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>{existingDraft ? 'Lanjutkan draft metode' : 'Edit draft metode'}</Text><Text style={styles.headerSubtitle}>{instrument.name} · aktif v{version || 1} · draft v{(version || 1) + 1}</Text></View>
          <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.close}>Tutup</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Heading title="Metode dan acuan" hint="Perubahan disimpan di perangkat dan dipakai pekerjaan baru. Draft lama tetap memakai snapshot metode saat dibuat." />
            <Field label="Nomor / keterangan metode kerja" value={draft.subtitle} onChange={(value) => setDraft((current) => ({ ...current, subtitle: value }))} />
            <View style={styles.sectionTitle}><Text style={styles.sectionName}>Sumber dan verifikasi</Text><Badge text="WAJIB SEBELUM AKTIF" tone="wait" /></View>
            <Field label="Sumber acuan / versi dokumen" value={metadata.source} onChange={(value) => setMetadata((current) => ({ ...current, source: value }))} placeholder="Contoh: LK Timbangan Digital 2026, sheet Uji" />
            <Field label="Alasan perubahan" value={metadata.reason} onChange={(value) => setMetadata((current) => ({ ...current, reason: value }))} multiline placeholder="Apa yang berubah dan kenapa?" />
            <Field label="Catatan pembanding Excel / acuan" value={metadata.verificationNote} onChange={(value) => setMetadata((current) => ({ ...current, verificationNote: value }))} multiline placeholder="Tulis kasus uji dan hasil Excel vs aplikasi" />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Diperiksa oleh" value={metadata.verifiedBy} onChange={(value) => setMetadata((current) => ({ ...current, verifiedBy: value }))} /></View>
              <View style={styles.column}><Field label="Tanggal berlaku (YYYY-MM-DD)" value={metadata.effectiveDate} onChange={(value) => setMetadata((current) => ({ ...current, effectiveDate: value }))} /></View>
            </View>
            <Text style={styles.formulaHint}>Pemeriksaan otomatis mengecek rumus dan konfigurasi. Catatan pembanding wajib diisi berdasarkan Excel atau metode yang disetujui. Tanpa login, nama pemeriksa hanya tercatat lokal.</Text>
            <View style={styles.sectionTitle}><Text style={styles.sectionName}>Bobot skor</Text><Badge text="EDITABLE" /></View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Ambang lulus kinerja (%)" value={draft.score.performanceThreshold} keyboard="decimal-pad" onChange={(value) => updateInstrument('score', 'performanceThreshold', value)} /></View>
              <View style={styles.column}><Field label="Bobot kinerja" value={draft.score.performanceWeight} keyboard="decimal-pad" onChange={(value) => updateInstrument('score', 'performanceWeight', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Bobot fisik dan fungsi" value={draft.score.physicalWeight} keyboard="decimal-pad" onChange={(value) => updateInstrument('score', 'physicalWeight', value)} /></View>
              <View style={styles.column}><Field label="Ambang lulus fisik (%)" value={draft.score.physicalThreshold ?? 70} keyboard="decimal-pad" onChange={(value) => updateInstrument('score', 'physicalThreshold', value)} /></View>
            </View>
            <Field label="Ambang status laik pakai (%)" value={draft.score.overallPassThreshold ?? 70} keyboard="decimal-pad" onChange={(value) => updateInstrument('score', 'overallPassThreshold', value)} />
            <View style={styles.sectionTitle}><Text style={styles.sectionName}>Nilai acuan bawaan</Text></View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Resolusi kalibrator" value={draft.references.calibratorResolution} keyboard="decimal-pad" onChange={(value) => updateInstrument('references', 'calibratorResolution', value)} /></View>
              <View style={styles.column}><Field label="Ketidakpastian kalibrator" value={draft.references.calibratorUncertainty} keyboard="decimal-pad" onChange={(value) => updateInstrument('references', 'calibratorUncertainty', value)} /></View>
            </View>
            <Field label="Resolusi UUT" value={draft.references.uutResolution} keyboard="decimal-pad" onChange={(value) => updateInstrument('references', 'uutResolution', value)} />
          </Card>
          {specialFormulaFields.length ? <Card>
            <Heading title="Rumus kalkulator khusus" hint="Persamaan di bawah ini digunakan langsung oleh kalkulator alat. Variabel yang tersedia tercantum pada keterangan tiap persamaan." />
            {specialFormulaFields.map((field) => <View key={field.key}>
              <Field label={field.label} value={draft.formulaExpressions?.[field.key] ?? field.expression} onChange={(value) => updateFormulaExpression(field.key, value)} multiline />
              <Text style={styles.formulaHint}>{field.detail}</Text>
            </View>)}
          </Card> : null}
          {draft.weighingScale ? <Card>
            <Heading title="Konfigurasi timbangan" hint="Parameter dan titik beban ini dipakai pekerjaan timbangan berikutnya." />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Kapasitas (kg)" value={draft.weighingScale.capacityKg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('weighingScale', 'capacityKg', value)} /></View>
              <View style={styles.column}><Field label="Ketelitian d (kg)" value={draft.weighingScale.resolutionKg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('weighingScale', 'resolutionKg', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Beban daya ulang (kg)" value={draft.weighingScale.repeatabilityLoadKg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('weighingScale', 'repeatabilityLoadKg', value)} /></View>
              <View style={styles.column}><Choice label="Pembagi resolusi" value={String(draft.weighingScale.resolutionDivisor)} options={[{ value: '3', label: '√3' }, { value: '6', label: '√6' }]} onChange={(value) => updateConfigNumber('weighingScale', 'resolutionDivisor', value)} /></View>
            </View>
            <Text style={styles.sectionName}>Derajat kebebasan (ν) komponen U95</Text>
            <View style={styles.twoColumns}>{['Resolusi', 'Daya ulang', 'Sertifikat', 'Drift'].map((label, index) => <View style={styles.column} key={label}><Field label={`ν ${label}`} value={draft.weighingScale!.degreesOfFreedom[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('weighingScale', 'degreesOfFreedom', index, value)} /></View>)}</View>
            {draft.weighingScale.points.map((point, index) => <View key={point.id}>
              <View style={styles.sectionTitle}><Text style={styles.sectionName}>Titik beban {index + 1}</Text><Pressable accessibilityRole="button" onPress={() => removeWeighingPoint(point.id)}><Text style={styles.delete}>Hapus</Text></Pressable></View>
              <Field label="Beban acuan (kg)" value={point.loadKg} keyboard="decimal-pad" onChange={(value) => updateWeighingPoint(index, value)} />
            </View>)}
            <ActionButton title="Tambah titik beban" secondary onPress={addWeighingPoint} />
          </Card> : null}
          {draft.sphygmomanometer ? <Card>
            <Heading title="Konfigurasi sphygmomanometer" hint="Atur titik uji, data koreksi DPM, drift, dan batas uji." />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Kapasitas (mmHg)" value={draft.sphygmomanometer.capacityMmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'capacityMmHg', value)} /></View>
              <View style={styles.column}><Field label="Kelas ketelitian" value={draft.sphygmomanometer.accuracyClass} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'accuracyClass', value)} /></View>
            </View>
            <Field label="Titik tekanan (mmHg, pisahkan dengan koma)" value={draft.sphygmomanometer.pressurePoints.join(', ')} keyboard="decimal-pad" onChange={(value) => updateConfigPoints('sphygmomanometer', value)} />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="U95 DPM (mmHg)" value={draft.sphygmomanometer.dpmU95} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'dpmU95', value)} /></View>
              <View style={styles.column}><Field label="U95 tekanan minimum" value={draft.sphygmomanometer.minimumPressureU95MmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'minimumPressureU95MmHg', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Batas kebocoran (mmHg)" value={draft.sphygmomanometer.leakageLimitMmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'leakageLimitMmHg', value)} /></View>
              <View style={styles.column}><Field label="Batas deflasi (detik)" value={draft.sphygmomanometer.deflationLimitSeconds} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'deflationLimitSeconds', value)} /></View>
            </View>
            <Field label="Batas kesalahan tekanan (mmHg)" value={draft.sphygmomanometer.pressureToleranceMmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('sphygmomanometer', 'pressureToleranceMmHg', value)} />
            <Text style={styles.sectionName}>Derajat kebebasan (ν) komponen U95</Text>
            <View style={styles.twoColumns}>{['Resolusi', 'Pengulangan', 'Drift', 'DPM'].map((label, index) => <View style={styles.column} key={label}><Field label={`ν ${label}`} value={draft.sphygmomanometer!.degreesOfFreedom[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('sphygmomanometer', 'degreesOfFreedom', index, value)} /></View>)}</View>
            <Text style={styles.sectionName}>Kurva koreksi DPM</Text>
            {draft.sphygmomanometer.dpmCorrections.map((point, index) => <View key={`dpm-${index}`}>
              <View style={styles.sectionTitle}><Text style={styles.formulaHint}>Titik kurva {index + 1}</Text><Pressable accessibilityRole="button" onPress={() => removeConfigTableRow('sphygmomanometer', 'dpmCorrections', index)}><Text style={styles.delete}>Hapus</Text></Pressable></View>
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Tekanan" value={point.pressure} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('sphygmomanometer', 'dpmCorrections', index, 'pressure', value)} /></View>
                <View style={styles.column}><Field label="Koreksi naik" value={point.up} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('sphygmomanometer', 'dpmCorrections', index, 'up', value)} /></View>
                <View style={styles.column}><Field label="Koreksi turun" value={point.down} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('sphygmomanometer', 'dpmCorrections', index, 'down', value)} /></View>
              </View>
            </View>)}
            <ActionButton title="Tambah titik kurva DPM" secondary onPress={() => appendConfigTableRow('sphygmomanometer', 'dpmCorrections')} />
            <Text style={styles.sectionName}>Drift per titik uji</Text>
            {draft.sphygmomanometer.drift.map((point, index) => <View key={`drift-${index}`}>
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Tekanan" value={point.pressure} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('sphygmomanometer', 'drift', index, 'pressure', value)} /></View>
                <View style={styles.column}><Field label="Drift naik" value={point.up} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('sphygmomanometer', 'drift', index, 'up', value)} /></View>
                <View style={styles.column}><Field label="Drift turun" value={point.down} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('sphygmomanometer', 'drift', index, 'down', value)} /></View>
              </View>
            </View>)}
          </Card> : null}
          {draft.infusionPump ? <Card>
            <Heading title="Konfigurasi infusion/syringe pump" hint="Koefisien tiap channel, kurva drift, sertifikat analyzer, dan batas occlusion." />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Resolusi analyzer flow" value={draft.infusionPump.flowResolution} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('infusionPump', 'flowResolution', value)} /></View>
              <View style={styles.column}><Field label="Batas relatif flow" value={draft.infusionPump.flowToleranceRatio} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('infusionPump', 'flowToleranceRatio', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Resolusi analyzer occlusion" value={draft.infusionPump.occlusionResolution} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('infusionPump', 'occlusionResolution', value)} /></View>
              <View style={styles.column}><Field label="U95 analyzer occlusion" value={draft.infusionPump.occlusionDpmU95} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('infusionPump', 'occlusionDpmU95', value)} /></View>
            </View>
            <Field label="Batas occlusion" value={draft.infusionPump.occlusionLimit} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('infusionPump', 'occlusionLimit', value)} />
            <Text style={styles.sectionName}>Derajat kebebasan (ν) U95 aliran</Text>
            <View style={styles.twoColumns}>{['Resolusi', 'Pengulangan', 'Drift', 'Sertifikat'].map((label, index) => <View style={styles.column} key={label}><Field label={`ν ${label}`} value={draft.infusionPump!.flowDegreesOfFreedom[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('infusionPump', 'flowDegreesOfFreedom', index, value)} /></View>)}</View>
            <Text style={styles.sectionName}>Derajat kebebasan (ν) U95 occlusion</Text>
            <View style={styles.twoColumns}>{['Resolusi', 'Pengulangan', 'DPM'].map((label, index) => <View style={styles.column} key={label}><Field label={`ν ${label}`} value={draft.infusionPump!.occlusionDegreesOfFreedom[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('infusionPump', 'occlusionDegreesOfFreedom', index, value)} /></View>)}</View>
            {draft.infusionPump.channels.map((channel, index) => <View key={channel.channel}>
              <View style={styles.sectionTitle}><Text style={styles.sectionName}>{channel.channel}</Text></View>
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Slope flow" value={channel.flowSlope} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'channels', index, 'flowSlope', value)} /></View>
                <View style={styles.column}><Field label="Intercept flow" value={channel.flowIntercept} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'channels', index, 'flowIntercept', value)} /></View>
              </View>
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Slope occlusion" value={channel.occlusionSlope} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'channels', index, 'occlusionSlope', value)} /></View>
                <View style={styles.column}><Field label="Intercept occlusion" value={channel.occlusionIntercept} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'channels', index, 'occlusionIntercept', value)} /></View>
              </View>
              <Text style={styles.formulaHint}>Kurva drift flow {channel.channel}</Text>
              {channel.flowDrift.map(([setting, drift], pointIndex) => <View key={`${channel.channel}-${pointIndex}`} style={styles.twoColumns}>
                <View style={styles.column}><Field label="Setting" value={setting} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'channelFlowDrift', pointIndex, 0, value, index)} /></View>
                <View style={styles.column}><Field label="Drift" value={drift} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'channelFlowDrift', pointIndex, 1, value, index)} /></View>
                <Pressable accessibilityRole="button" onPress={() => removeConfigTableRow('infusionPump', 'channelFlowDrift', pointIndex, index)}><Text style={styles.delete}>Hapus</Text></Pressable>
              </View>)}
              <ActionButton title="Tambah titik drift channel" secondary onPress={() => appendConfigTableRow('infusionPump', 'channelFlowDrift', index)} />
            </View>)}
            <Text style={styles.sectionName}>U95 sertifikat analyzer per setting</Text>
            {draft.infusionPump.flowCertificateU95.map(([setting, u95], index) => <View key={`flow-u95-${index}`} style={styles.twoColumns}>
              <View style={styles.column}><Field label="Setting" value={setting} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'flowCertificateU95', index, 0, value)} /></View>
              <View style={styles.column}><Field label="U95" value={u95} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('infusionPump', 'flowCertificateU95', index, 1, value)} /></View>
              <Pressable accessibilityRole="button" onPress={() => removeConfigTableRow('infusionPump', 'flowCertificateU95', index)}><Text style={styles.delete}>Hapus</Text></Pressable>
            </View>)}
            <ActionButton title="Tambah titik U95 analyzer" secondary onPress={() => appendConfigTableRow('infusionPump', 'flowCertificateU95')} />
          </Card> : null}
          {draft.suctionPump ? <Card>
            <Heading title="Konfigurasi suction pump" hint="Atur titik tekanan, batas vakum, koreksi DPM, dan kurva drift." />
            <Field label="Titik tekanan (mmHg, pisahkan dengan koma)" value={draft.suctionPump.pressurePoints.join(', ')} keyboard="decimal-pad" onChange={(value) => updateConfigPoints('suctionPump', value)} />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Vakum minimum" value={draft.suctionPump.minimumVacuumMmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'minimumVacuumMmHg', value)} /></View>
              <View style={styles.column}><Field label="Vakum maksimum" value={draft.suctionPump.maximumVacuumMmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'maximumVacuumMmHg', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Ambang vakum data lama" value={draft.suctionPump.legacyMinimumVacuumMmHg} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'legacyMinimumVacuumMmHg', value)} /></View>
              <View style={styles.column}><Field label="Batas waktu maksimum (detik)" value={draft.suctionPump.maximumVacuumSeconds} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'maximumVacuumSeconds', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Toleransi tekanan relatif" value={draft.suctionPump.pressureToleranceRatio} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'pressureToleranceRatio', value)} /></View>
              <View style={styles.column}><Field label="Resolusi DPM" value={draft.suctionPump.meterResolution} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'meterResolution', value)} /></View>
            </View>
            <Field label="U95 DPM" value={draft.suctionPump.meterU95} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'meterU95', value)} />
            <Text style={styles.sectionName}>Derajat kebebasan (ν) komponen U95</Text>
            <View style={styles.twoColumns}>{['Resolusi', 'Pengulangan', 'Drift', 'DPM'].map((label, index) => <View style={styles.column} key={label}><Field label={`ν ${label}`} value={draft.suctionPump!.degreesOfFreedom[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('suctionPump', 'degreesOfFreedom', index, value)} /></View>)}</View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Slope naik" value={draft.suctionPump.slopeUp} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'slopeUp', value)} /></View>
              <View style={styles.column}><Field label="Intercept naik" value={draft.suctionPump.interceptUp} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'interceptUp', value)} /></View>
            </View>
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Slope turun" value={draft.suctionPump.slopeDown} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'slopeDown', value)} /></View>
              <View style={styles.column}><Field label="Intercept turun" value={draft.suctionPump.interceptDown} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('suctionPump', 'interceptDown', value)} /></View>
            </View>
            {(['driftUp', 'driftDown'] as const).map((table) => <View key={table}>
              <Text style={styles.sectionName}>Drift tekanan {table === 'driftUp' ? 'naik' : 'turun'}</Text>
              {draft.suctionPump![table].map(([setting, drift], index) => <View key={`${table}-${index}`} style={styles.twoColumns}>
                <View style={styles.column}><Field label="Tekanan" value={setting} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('suctionPump', table, index, 0, value)} /></View>
                <View style={styles.column}><Field label="Drift" value={drift} keyboard="decimal-pad" onChange={(value) => updateConfigTableNumber('suctionPump', table, index, 1, value)} /></View>
                <Pressable accessibilityRole="button" onPress={() => removeConfigTableRow('suctionPump', table, index)}><Text style={styles.delete}>Hapus</Text></Pressable>
              </View>)}
              <ActionButton title="Tambah titik drift" secondary onPress={() => appendConfigTableRow('suctionPump', table)} />
            </View>)}
          </Card> : null}
          {draft.electricalSafetyConfig ? <Card>
            <Heading title="Konfigurasi keselamatan listrik" hint="Batas ini dipakai pada semua pemeriksaan keselamatan alat tersebut." />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Tegangan minimum (V)" value={draft.electricalSafetyConfig.voltageMinimumV} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('electricalSafetyConfig', 'voltageMinimumV', value)} /></View>
              <View style={styles.column}><Field label="Tegangan maksimum (V)" value={draft.electricalSafetyConfig.voltageMaximumV} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('electricalSafetyConfig', 'voltageMaximumV', value)} /></View>
            </View>
            {['Kelas I', 'Kelas II', 'Kelas III', 'Kelas IV'].map((label, index) => <View key={label} style={styles.twoColumns}>
              <View style={styles.column}><Field label={`Batas pembumian ${label} (Ω)`} value={draft.electricalSafetyConfig!.earthResistanceLimitsOhm[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('electricalSafetyConfig', 'earthResistanceLimitsOhm', index, value)} /></View>
              <View style={styles.column}><Field label={`Batas arus bocor ${label} (mA)`} value={draft.electricalSafetyConfig!.leakageCurrentLimitsMa[index]} keyboard="decimal-pad" onChange={(value) => updateConfigArrayNumber('electricalSafetyConfig', 'leakageCurrentLimitsMa', index, value)} /></View>
            </View>)}
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Batas arus bagian diaplikasikan (mA)" value={draft.electricalSafetyConfig.appliedLeakageLimitMa} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('electricalSafetyConfig', 'appliedLeakageLimitMa', value)} /></View>
              <View style={styles.column}><Field label="Minimum isolasi (MΩ)" value={draft.electricalSafetyConfig.insulationMinimumMOhm} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('electricalSafetyConfig', 'insulationMinimumMOhm', value)} /></View>
            </View>
            <Field label="Poin per pemeriksaan yang lulus" value={draft.electricalSafetyConfig.scorePerPassedCheck} keyboard="decimal-pad" onChange={(value) => updateConfigNumber('electricalSafetyConfig', 'scorePerPassedCheck', value)} />
          </Card> : null}
          <View style={styles.listHeading}><Text style={styles.sectionName}>Titik ukur dan rumus</Text><Badge text={`${draft.performanceRows.length} titik`} tone="good" /></View>
          {draft.performanceRows.map((row, index) => {
            const formula = formulaOptions.find((item) => item.value === row.formula);
            return <Card key={row.id}>
              <View style={styles.sectionTitle}><Text style={styles.sectionName}>Titik {index + 1}</Text><Pressable accessibilityRole="button" onPress={() => removeRow(row.id)}><Text style={styles.delete}>Hapus</Text></Pressable></View>
              <Field label="Nama pengujian" value={row.label} onChange={(value) => updateRow(row.id, 'label', value)} />
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Setting / batas" value={row.setting} keyboard="decimal-pad" onChange={(value) => updateRow(row.id, 'setting', value)} /></View>
                <View style={styles.column}><Field label="Satuan" value={row.unit} onChange={(value) => updateRow(row.id, 'unit', value)} /></View>
              </View>
              <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Jumlah bacaan" value={row.count} keyboard="number-pad" onChange={(value) => updateRow(row.id, 'count', value)} /></View>
                <View style={styles.column}><Field label="Toleransi (%)" value={row.tolerancePercent} keyboard="decimal-pad" onChange={(value) => updateRow(row.id, 'tolerancePercent', value)} /></View>
              </View>
              <PickerField label="Pola perhitungan" value={formula?.label} placeholder="Pilih pola rumus" onPress={() => { setFormulaSearch(''); setFormulaPickerRow(row.id); }} />
              {formula ? <Text style={styles.formulaHint}>{formula.detail}</Text> : null}
              {row.formula !== 'workbookRange' ? <Field label="Toleransi absolut (opsional)" value={row.absoluteTolerance ?? ''} keyboard="decimal-pad" onChange={(value) => updateRow(row.id, 'absoluteTolerance', value)} placeholder="Kosongkan jika hanya memakai toleransi persen" /> : null}
              {row.formula === 'workbookBand' ? <View style={styles.twoColumns}>
                <View style={styles.column}><Field label="Batas bawah" value={row.minimumSetting ?? ''} keyboard="decimal-pad" onChange={(value) => updateRow(row.id, 'minimumSetting', value)} /></View>
                <View style={styles.column}><Field label="Batas atas" value={row.maximumSetting ?? ''} keyboard="decimal-pad" onChange={(value) => updateRow(row.id, 'maximumSetting', value)} /></View>
              </View> : null}
              {row.formula === 'customExpression' ? <>
                <Text style={styles.variables}>Variabel: mean, setting, sd, n, ua, uCal, resCal, resUut, tolerancePercent, absoluteTolerance, correction, u95, tolerance, testValue. Operator: + - * / ^, perbandingan, &&, ||; fungsi: abs, sqrt, min, max, pow. Desimal pakai titik.</Text>
                {Object.entries(expressionLabels).map(([key, label]) => <Field key={key} label={label} value={row.customExpressions?.[key as keyof typeof expressionLabels] ?? ''} onChange={(value) => updateRow(row.id, `customExpressions.${key}`, value)} multiline />)}
                <Text style={styles.formulaHint}>Rumus diperiksa dengan contoh angka sebelum disimpan. Contoh dasar tersedia saat memilih pola Rumus kustom.</Text>
              </> : null}
              {row.formula.startsWith('workbook') ? <Choice label="Masukkan ketidakpastian ke keputusan lulus" value={row.includeUncertainty === false ? 'Tidak' : 'Ya'} options={[{ value: 'Ya', label: 'Ya' }, { value: 'Tidak', label: 'Tidak' }]} onChange={(value) => updateRow(row.id, 'includeUncertainty', value)} /> : null}
              {row.includeInScore === false ? <Badge text="Tidak masuk skor" tone="wait" /> : null}
            </Card>;
          })}
          <View style={styles.actions}>
            <ActionButton title="Tambah titik ukur" secondary onPress={addRow} />
            <ActionButton title="Simpan sebagai draft" secondary onPress={() => setConfirmDraftSave(true)} disabled={saving} />
            <ActionButton title="Aktifkan versi terverifikasi" onPress={requestPublish} disabled={saving} />
            {existingDraft ? <ActionButton title="Hapus draft" secondary onPress={() => setConfirmDiscard(true)} /> : null}
            <ActionButton title="Batal" secondary onPress={onClose} />
          </View>
          <Text style={styles.footerNote}>Persamaan kustom hanya mendukung operasi matematika dan variabel yang tercantum. Periksa hasil terhadap Excel sebelum versi dipakai untuk pekerjaan resmi.</Text>
        </ScrollView>
        <SearchPickerModal visible={Boolean(selectedRow)} title="Pilih pola perhitungan" search={formulaSearch} placeholder="Cari nama pola rumus" onSearch={setFormulaSearch} onClose={() => setFormulaPickerRow(null)}>
          {filteredFormulas.map((item, index) => <PickerOption key={item.value} index={index + 1} label={item.label} detail={item.detail} selected={selectedRow?.formula === item.value} status={selectedRow?.formula === item.value ? 'Dipilih' : 'Pilih'} statusTone={selectedRow?.formula === item.value ? 'good' : 'neutral'} onPress={() => chooseFormula(item.value)} />)}
        </SearchPickerModal>
        <ConfirmModal visible={confirmPublish} title="Aktifkan versi metode?" message={`${instrument.name} v${version + 1} akan dipakai untuk pekerjaan baru. Sumber: ${metadata.source}. Pembanding: ${metadata.verificationNote}. Pemeriksa: ${metadata.verifiedBy}.`} confirmLabel="Aktifkan" onCancel={() => setConfirmPublish(false)} onConfirm={publish} />
        <ConfirmModal visible={confirmDraftSave} title="Simpan draft metode?" message={`Versi aktif ${version || 1} tidak berubah. Draft ${instrument.name} hanya tersimpan di perangkat dan belum dipakai pekerjaan baru.`} confirmLabel="Simpan draft" onCancel={() => setConfirmDraftSave(false)} onConfirm={saveDraft} />
        <ConfirmModal visible={confirmDiscard} title="Hapus draft metode?" message="Draft ini akan dihapus. Versi aktif dan pekerjaan yang sudah dibuat tetap aman." confirmLabel="Hapus draft" onCancel={() => setConfirmDiscard(false)} onConfirm={() => { onDiscardDraft(); setConfirmDiscard(false); onClose(); }} />
      </KeyboardAvoidingView>
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}
