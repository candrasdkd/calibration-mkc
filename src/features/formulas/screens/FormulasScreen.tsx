import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card, Field, Heading, ValueLine } from '../../../components/ui';
import { ScreenPage } from '../../../components/ScreenPage';
import { getInstrument, instruments } from '../../../core/instruments';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { styles } from '../styles/FormulasScreenStyles';

import type { MeasurementReferences, PerformanceFormula } from '../../../core/types';
import type { FormulaDisplay } from '../types/FormulaDisplay';


const formulaDisplay: Record<PerformanceFormula, FormulaDisplay> = {
  centrifugeSpeed: { title: 'Kecepatan putar', correction: 'C = x̄ − setting', repeatability: 'UA = s / √3', acceptance: '|C + U95| ≤ MPE' },
  centrifugeTime: { title: 'Waktu putar', correction: 'C = x̄ − setting', repeatability: 'UA = s / √3', acceptance: '|C + U95| ≤ MPE' },
  fetalHeartRate: { title: 'Heart rate', correction: 'C = |x̄| − |setting|', repeatability: 'UA = s / √6', acceptance: '|C| + U95 ≤ MPE' },
  flowmeter: { title: 'Laju aliran', correction: 'C = |setting| − |x̄|', repeatability: 'UA = s / √5', acceptance: '|C| + U95 ≤ MPE' },
};

function FormulaCard({ instrument }: { instrument: (typeof instruments)[number] }) {
  const [expanded, setExpanded] = useState(false);
  const formulaRows = instrument.performanceRows.filter((row, index, rows) => rows.findIndex((item) => item.formula === row.formula) === index);
  return <Card style={styles.formulaCard}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.formulaToggle}>
      <View style={styles.formulaTitleWrap}><Text style={styles.formulaTitle}>{instrument.name}</Text><Text style={styles.formulaSubtitle}>{instrument.subtitle}</Text></View>
      <Text style={styles.formulaChevron}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded ? <View style={styles.formulaBody}>
      {instrument.weighingScale ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Uji berulang · beban {instrument.weighingScale.repeatabilityLoadKg} kg · 10 bacaan</Text>
          <Text style={styles.equation}>ri = mi − zi; x̄ = Σri / 10; s = √[Σ(ri − x̄)² / 9]</Text>
          <Text style={styles.equation}>Nilai simpangan baku pada laporan Excel = √(2/3) × (0,5 × d)</Text>
          <Text style={styles.equation}>Komponen daya ulang dalam anggaran U = (0,5 × d) / 2</Text>
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi dan ketidakpastian · standar massa 2026</Text>
          <Text style={styles.equation}>Massa acuan = Σ massa konvensional 2026; C = bacaan berbeban − massa acuan</Text>
          <Text style={styles.equation}>u resolusi = (0,5 × d) / √{instrument.weighingScale.resolutionDivisor}</Text>
          <Text style={styles.equation}>u sertifikat = (Σ U95 anak timbangan / 2) / 1000</Text>
          <Text style={styles.equation}>Drift per anak = 0,5 × (massa 2026 − massa 2025) / √3</Text>
          <Text style={styles.equation}>u drift = (Σ drift / √3) / 1000</Text>
          <Text style={styles.equation}>uc = √(u resolusi² + u ulang² + u sertifikat² + u drift²)</Text>
          <Text style={styles.equation}>νeff = uc⁴ / Σ(ui⁴ / 50); k = t(0,975; νeff); U95 = k × uc</Text>
          <Text style={styles.equation}>LOP = maksimum |C| + maksimum U95</Text>
          <Text style={styles.equationStrong}>Laik jika LOP ≤ 10 × d = {10 * instrument.weighingScale.resolutionKg} kg</Text>
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Komposisi beban standar dari Excel</Text>
          {instrument.weighingScale.points.map((point) => <Text key={point.id} style={styles.equation}>{point.loadKg} kg · default: {point.defaultStandardWeightSerials.join(' + ')}</Text>)}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Parameter alat</Text>
          <ValueLine label="Kapasitas" value={`${instrument.weighingScale.capacityKg} kg`} />
          <ValueLine label="Resolusi d" value={`${instrument.weighingScale.resolutionKg} kg`} />
          <ValueLine label="Pembagi resolusi" value={`√${instrument.weighingScale.resolutionDivisor}`} />
        </View>
        <Text style={styles.formulaWarning}>Catatan workbook: pengujian berulang tetap 40 kg dan titik beban 10–100 kg. Di titik 70 kg, aplikasi menjumlahkan semua anak timbangan; laporan menampilkan U95 hitungan asli, bukan nilai tampilan minimum 0,75 kg pada Excel.</Text>
      </> : <>
      {formulaRows.map((row) => {
        const formula = formulaDisplay[row.formula];
        return <View key={row.formula} style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>{formula.title} · {row.count} bacaan · toleransi {row.tolerancePercent}%</Text>
          <Text style={styles.equation}>x̄ = Σxi / n</Text>
          <Text style={styles.equation}>s = √[Σ(xi − x̄)² / (n − 1)]</Text>
          <Text style={styles.equation}>{formula.correction}</Text>
          <Text style={styles.equation}>{formula.repeatability}</Text>
          <Text style={styles.equation}>U95 = 2 × √[UA² + (Usertifikat / 2)² + (resUUT / (2√3))² + (resKal / (2√3))²]</Text>
          <Text style={styles.equationStrong}>Lulus jika {formula.acceptance}, MPE = setting × {row.tolerancePercent}%</Text>
        </View>;
      })}
      <View style={styles.formulaGroup}>
        <Text style={styles.formulaGroupTitle}>Nilai standar dan resolusi · default Excel</Text>
        <ValueLine label="Resolusi kalibrator" value={instrument.references.calibratorResolution} />
        <ValueLine label="Ketidakpastian kalibrator (U)" value={instrument.references.calibratorUncertainty} />
        <ValueLine label="Resolusi alat yang diuji (UUT)" value={instrument.references.uutResolution} />
      </View>
      {instrument.id === 'flowmeter' ? <Text style={styles.formulaWarning}>Workbook menampilkan label ±20%, tetapi rumus batas di sheet Olah Data menggunakan 10%.</Text> : null}
      </>}
      <Text style={styles.readOnlyNote}>Rumus hanya untuk dibaca. Nilai dan aturan hitung mengikuti template Excel.</Text>
    </View> : null}
  </Card>;
}

export function FormulasScreen() {
  const { recordId: rawRecordId } = useLocalSearchParams<{ recordId?: string }>();
  const recordId = Array.isArray(rawRecordId) ? rawRecordId[0] : rawRecordId;
  const { records, updateRecord } = useRecords();
  const record = records.find((item) => item.id === recordId);
  const instrument = record ? getInstrument(record.instrumentId) : undefined;
  const updateReference = (key: keyof MeasurementReferences, value: string) => {
    if (!record) return;
    updateRecord(record.id, { data: { ...record.data, references: { ...record.data.references, [key]: value } } });
  };
  return <ScreenPage title="Rumus" backLabel={record ? 'Pengerjaan' : 'Menu utama'} hint={record && instrument ? `Nilai standar bisa disesuaikan untuk pekerjaan ${instrument.name} ini.` : 'Rumus alat, standar, dan kondisi lingkungan ada di satu tempat. Tampilan rumus hanya baca.'}>
    <Card>
      <Heading title="Kondisi lingkungan · thermohygrometer" hint="Koreksi suhu dan kelembaban menggunakan tabel sertifikat acuan, lalu dihitung untuk kondisi ruangan." />
      <Text style={styles.equation}>C(x) = C1 + (x − x1) × (C2 − C1) / (x2 − x1)</Text>
      <Text style={styles.equation}>Nilai terkoreksi = bacaan + C(bacaan)</Text>
      <Text style={styles.equation}>Rata-rata = (awal terkoreksi + akhir terkoreksi) / 2</Text>
      <Text style={styles.equation}>Rentang = |awal terkoreksi − akhir terkoreksi|</Text>
      <Text style={styles.equation}>UA = s / √2; ures = (0,5 × 0,1) / √3</Text>
      <Text style={styles.equation}>U95 = 2 × √[UA² + U95 sertifikat² + ures²]</Text>
      <Text style={styles.readOnlyNote}>Perhitungan dilakukan terpisah untuk suhu dan kelembaban.</Text>
    </Card>
    {record && instrument && !instrument.weighingScale ? <Card>
      <Heading title={`Standar pengukuran · ${instrument.name}`} hint="Perubahan disimpan ke pekerjaan ini saja dan langsung digunakan dalam hitungan U95." />
      <Field label="Resolusi kalibrator" value={record.data.references.calibratorResolution} keyboard="decimal-pad" onChange={(value) => updateReference('calibratorResolution', value)} />
      <Field label="Ketidakpastian kalibrator (U)" value={record.data.references.calibratorUncertainty} keyboard="decimal-pad" onChange={(value) => updateReference('calibratorUncertainty', value)} />
      <Field label="Resolusi alat yang diuji (UUT)" value={record.data.references.uutResolution} keyboard="decimal-pad" onChange={(value) => updateReference('uutResolution', value)} />
    </Card> : null}
    {instruments.map((instrument) => <FormulaCard key={instrument.id} instrument={instrument} />)}
  </ScreenPage>;
}
