import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Badge, Card, Field, Heading, ValueLine } from '../../../components/ui';
import { ScreenPage } from '../../../components/ScreenPage';
import { getInstrument, instruments } from '../../../core/instruments';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { styles } from '../styles/FormulasScreenStyles';

import type { MeasurementReferences, PerformanceFormula } from '../../../core/types';
import type { FormulaDisplay } from '../types/FormulaDisplay';

const formulaDisplay: Record<PerformanceFormula, FormulaDisplay> = {
  centrifugeSpeed: { title: 'Kecepatan putar', correction: 'C = x̄ − setting', repeatability: 'UA = s / √n', acceptance: '|C + U95| ≤ MPE' },
  centrifugeTime: { title: 'Waktu putar', correction: 'C = x̄ − setting', repeatability: 'UA = s / √n', acceptance: '|C + U95| ≤ MPE' },
  fetalHeartRate: { title: 'Heart rate', correction: 'C = |x̄| − |setting|', repeatability: 'UA = s / √n', acceptance: '|C| + U95 ≤ 5 BPM' },
  flowmeter: { title: 'Laju aliran', correction: 'C = |setting| − |x̄|', repeatability: 'UA = s / √n', acceptance: '|C| + U95 ≤ 20% × setting' },
  infusionFlow: { title: 'Laju aliran pompa', correction: 'C = interceptChannel + slopeChannel × x̄; x̄corr = x̄ + C', repeatability: 'UA = s / √3', acceptance: '|x̄corr − setting| / setting ≤ 10%' },
};

const excelQuestions = [
  'Thermohygrometer: koreksi RH pada 50% untuk Thermohygro 4 tertulis +10,1%. Angka ini benar atau tanda koreksinya keliru?',
  'Timbangan digital: laporan memakai batas minimum U95 0,75 kg, sementara hitungan anggaran sekitar 0,076 kg. Apakah 0,75 memang disengaja atau seharusnya 0,075 kg?',
  'Timbangan mekanik: rumus U95 laporan pada titik 50 kg merujuk sel N92 dan N74. Apakah ini salah salin dan seharusnya memakai hasil titik 50 kg?',
  'Kedua timbangan: rumus U95 pada titik 70 kg merujuk rentang G81:G84 tanpa SUM. Apakah ketidakpastian empat anak timbangan harus dijumlah seperti yang dilakukan aplikasi?',
  'Thermohygrometer: tabel menyebut nilai sertifikat sebagai U95, lalu nilai itu masuk ke uc sebelum dikalikan k=2. Apakah nilai sertifikat perlu dibagi k terlebih dahulu?',
  'Sphygmomanometer: batas kesalahan tekanan pada OLAH DATA tertulis ±4,5 mmHg, sedangkan SCORING menghitung dengan 4 mmHg. Batas mana yang harus dipakai?',
  'Sphygmomanometer: batas penurunan kebocoran tertulis <15 mmHg pada OLAH DATA, tetapi SCORING menerima nilai ≤15 mmHg. Apakah nilai tepat 15 mmHg lulus?',
  'Sphygmomanometer: ada 12 bagian pemeriksaan fisik, tetapi rumus skor SCORING hanya menjumlahkan 10 baris pertama. Apakah seluruh 12 bagian harus dihitung?',
  'Infusion/Syringe Pump: Excel menghitung U95 aliran, tetapi lulus hanya dari |galat / setting| ≤ 10%. U95 tetap untuk laporan saja atau perlu ikut keputusan lulus?',
  'Infusion/Syringe Pump: skor kinerja 50 poin diberikan saat skor blok flow + occlusion minimal 170% dari maksimum 200%. Apakah ambang 170% ini benar?',
  'Suction Pump: MK-24 masih berupa draf dan menetapkan rentang 150–450 mmHg, sedangkan Excel memakai titik −200 sampai −600 mmHg dan batas hisap maksimum ≥300 mmHg. Aplikasi mengikuti rentang MK-24 untuk pekerjaan baru; pastikan acuan final sebelum hasil resmi.',
  'Suction Pump: Excel menghitung U95 tekanan, tetapi keputusan lulus memakai |galat / setting| ≤ 10% tanpa U95. U95 memang hanya untuk pelaporan?',
  'Suction Pump: Laporan Hasil menampilkan −4,5 di baris “Vacuum (mmHg)”, padahal nilainya terhubung ke waktu 4,5 detik dan batas ≤ 10 detik. Apakah satuan di workbook salah?',
];

function FormulaStep({ number, title, equation, detail }: { number: string; title: string; equation: string; detail: string }) {
  return <View style={styles.formulaStep}>
    <Text style={styles.stepNumber}>{number}</Text>
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>{title}</Text>
      <Text style={styles.stepEquation}>{equation}</Text>
      <Text style={styles.stepDetail}>{detail}</Text>
    </View>
  </View>;
}

function ExcelQuestionsCard() {
  const [expanded, setExpanded] = useState(false);
  return <Card style={styles.questionCard}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.questionToggle}>
      <View style={styles.questionTitleWrap}>
        <Text style={styles.questionTitle}>Catatan Excel · perlu konfirmasi</Text>
        <Text style={styles.questionSubtitle}>{excelQuestions.length} hal yang perlu dipastikan sebelum template jadi acuan final</Text>
      </View>
      <Text style={styles.formulaChevron}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded ? <View style={styles.questionList}>
      {excelQuestions.map((question, index) => <View key={question} style={styles.questionRow}>
        <Text style={styles.questionNumber}>{index + 1}</Text>
        <Text style={styles.questionText}>{question}</Text>
      </View>)}
    </View> : null}
  </Card>;
}

function FormulaCard({
  instrument,
  activeReferences,
  onReferenceChange,
}: {
  instrument: (typeof instruments)[number];
  activeReferences?: MeasurementReferences;
  onReferenceChange?: (key: keyof MeasurementReferences, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const formulaRows = instrument.performanceRows.filter((row, index, rows) => rows.findIndex((item) => item.formula === row.formula) === index);
  const isActiveWork = Boolean(activeReferences && onReferenceChange);
  const readingCounts = [...new Set(instrument.performanceRows.map((row) => row.count))].sort((a, b) => a - b);
  const occlusionLimit = instrument.id === 'syringe-pump' ? 21 : 20;
  const methodSource = ['centrifuge', 'fetal-doppler', 'flowmeter', 'infusion-pump', 'syringe-pump', 'suction-pump'].includes(instrument.id)
    ? { label: 'Metode Kerja Kemenkes 2024 · MK-24 (draf)', tone: 'wait' as const }
    : instrument.sphygmomanometer
      ? { label: 'Excel 2026 · metode Kemenkes belum dikonfirmasi', tone: 'wait' as const }
      : instrument.weighingScale
        ? { label: 'Excel 2026 · belum dibahas di MK-24', tone: 'neutral' as const }
        : { label: 'Acuan metode belum dipetakan', tone: 'neutral' as const };
  const summary = instrument.sphygmomanometer
    ? `${instrument.sphygmomanometer.pressurePoints.length} titik tekanan · 3 bacaan per arah`
    : instrument.suctionPump
      ? `${instrument.suctionPump.pressurePoints.length} titik vakum · 6 bacaan per arah + uji waktu maksimum`
    : instrument.id === 'infusion-pump' || instrument.id === 'syringe-pump'
      ? `${instrument.performanceRows.length} titik laju aliran · 6 bacaan + uji occlusion`
    : instrument.weighingScale
      ? `${instrument.weighingScale.points.length} titik beban · uji daya ulang ${instrument.weighingScale.repeatabilityLoadKg} kg`
    : `${instrument.performanceRows.length} titik uji · ${readingCounts.length === 1 ? `${readingCounts[0]} bacaan per titik` : `${readingCounts[0]}–${readingCounts[readingCounts.length - 1]} bacaan per titik`}`;

  return <Card style={styles.formulaCard}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.formulaToggle}>
      <View style={styles.formulaTitleWrap}>
        <Text style={styles.formulaTitle}>{instrument.name}</Text>
        <Text style={styles.formulaSubtitle}>{instrument.subtitle}</Text>
        <Text style={styles.formulaMeta}>{summary}</Text>
        <View style={{ marginTop: 8 }}><Badge text={methodSource.label} tone={methodSource.tone} /></View>
      </View>
      <Text style={styles.formulaChevron}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded ? <View style={styles.formulaBody}>
      {instrument.suctionPump ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik dan langkah pengukuran</Text>
          {instrument.suctionPump.pressurePoints.map((setting) => <ValueLine key={setting} label={`${Math.abs(setting)} mmHg vakum`} value="6 bacaan arah naik · 6 bacaan arah turun" />)}
          <ValueLine label="Daya hisap maksimum" value={`Tekanan vakum ${instrument.suctionPump.minimumVacuumMmHg}–${instrument.suctionPump.maximumVacuumMmHg} mmHg · waktu ≤ 10 detik`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi Digital Pressure Meter</Text>
          <FormulaStep number="1" title="Tanda bacaan" equation="x̄ = −rata-rata(bacaan DPM)" detail="Bacaan diisi tanpa tanda minus di form; aplikasi mengubahnya menjadi tekanan bertanda negatif seperti tabel scoring Excel." />
          <FormulaStep number="2" title="Koreksi regresi drift" equation="Naik: C = 0,2940837 + 0,003441824 × x̄; Turun: C = 0,3211573 + 0,003504638 × x̄" detail={`Koefisien mengikuti lembar DRIFT untuk DPM nomor seri ${instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3]}.`} />
          <FormulaStep number="3" title="Ketidakpastian" equation="UA = s / √n; U95 = t(0,975; νeff) × √Σui²" detail="Komponen: resolusi DPM 20 mmHg, simpangan baku enam bacaan, drift sesuai setting/arah, dan U95 sertifikat DPM maksimum 0,31 mmHg; dibagi reliabilitas workbook." />
          <FormulaStep number="4" title="Keputusan" equation="Galat = x̄ + C − setting; lulus jika |Galat / setting| ≤ 10%" detail="Workbook menghitung U95 untuk dilaporkan, tetapi kriteria lulus tekanan memakai persentase galat tanpa menambahkan U95." />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Bobot skor</Text>
          <ValueLine label="Keselamatan listrik" value="40 poin" />
          <ValueLine label="Pemeriksaan fisik dan fungsi" value="10 poin · ambang 70%" />
          <ValueLine label="Kinerja" value="50 poin jika semua tekanan dan waktu maksimum lulus" />
        </View>
      </> : instrument.id === 'infusion-pump' || instrument.id === 'syringe-pump' ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik ukur laju aliran</Text>
          {instrument.performanceRows.map((row) => <ValueLine key={row.id} label={`${row.setting} ${row.unit}`} value="6 bacaan · toleransi 10%" />)}
          <ValueLine label="Occlusion" value={`Setting 100 mL/h · 6 bacaan · batas rata-rata ≤ ${occlusionLimit} psi`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi analyzer dan ketidakpastian</Text>
          <FormulaStep number="1" title="Koreksi laju aliran" equation="C = interceptChannel + slopeChannel × x̄; x̄corr = x̄ + C" detail="Koefisien intercept dan slope berbeda pada Channel 1, 2, dan 3; dipilih di form pengerjaan." />
          {(['Channel 1', 'Channel 2', 'Channel 3'] as const).map((channel, index) => {
            const coefficients = [
              [-0.0044382464, -0.6893402185, 0.0007131475, -0.3227629185],
              [-0.0084894465, -0.9974586655, 0.0007349966, -0.1939037013],
              [-0.0216394107, 0.0314763681, 0.0008032538, -0.0241376844],
            ][index];
            return <ValueLine key={channel} label={channel} value={`Flow b=${coefficients[0]} · a=${coefficients[1]} | Occlusion b=${coefficients[2]} · a=${coefficients[3]}`} />;
          })}
          <FormulaStep number="2" title="U95 tiap titik" equation="uc = √[(0,01/√3)² + (s/√3)² + (drift/√3)² + (U95 standar/2)²]; U95 = t × uc" detail="Drift dan U95 standar diinterpolasi dari tabel workbook pada setting uji. Derajat bebas efektif mengikuti reliabilitas 50, 2, 50, 50." />
          <FormulaStep number="3" title="Keputusan laju aliran" equation="Galat = x̄corr − setting; lulus jika |Galat / setting| ≤ 10%" detail="U95 ditampilkan di hasil dan laporan. Rumus skor Excel menentukan lulus dari persentase galat terhadap setting." />
          <FormulaStep number="4" title="Koreksi occlusion" equation="C = interceptChannel + slopeChannel × x̄; U95 dari resolusi 0,01 psi, bacaan berulang, dan sertifikat" detail={instrument.id === 'syringe-pump' ? 'Aplikasi membandingkan rata-rata enam bacaan mentah dengan batas 21 psi dari MK-24; Excel memakai 20 psi.' : 'Aplikasi membandingkan rata-rata enam bacaan mentah dengan batas 20 psi.'} />
          <ValueLine label="Bobot skor" value="Keselamatan listrik 40 · fisik/fungsi 10 · kinerja 50 (nilai blok flow + occlusion minimal 170%)" />
        </View>
      </> : instrument.sphygmomanometer ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Alur dan batas pengujian</Text>
          <FormulaStep number="1" title="Kebocoran" equation="Pompa 250 mmHg; ukur penurunan setelah 1 menit" detail="Batas pada rumus yang dipakai aplikasi: ≤ 15 mmHg." />
          <FormulaStep number="2" title="Deflasi cepat" equation="Pompa 260 mmHg; ukur waktu deflasi" detail="Batas waktu: ≤ 10 detik." />
          <FormulaStep number="3" title="Ketepatan tekanan" equation={`Setting ${instrument.sphygmomanometer.pressurePoints.join(', ')} mmHg · 3 bacaan DPM saat tekanan naik dan turun`} detail={`Sphygmomanometer ${instrument.sphygmomanometer.accuracyClass === 1 ? 'digital' : 'analog'} · kelas akurasi ${instrument.sphygmomanometer.accuracyClass}.`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi Digital Pressure Meter</Text>
          <FormulaStep number="1" title="Interpolasi sertifikat" equation="C(x) = C1 + (x − x1) × (C2 − C1) / (x2 − x1)" detail="Koreksi dihitung terpisah untuk pembacaan naik dan turun." />
          <FormulaStep number="2" title="Bacaan terkoreksi" equation="xi terkoreksi = xi DPM + C(xi DPM)" detail={`U95 sertifikat DPM = ${instrument.sphygmomanometer.dpmU95} mmHg. Kurva di bawah mengikuti nomor seri pada workbook.`} />
          {instrument.sphygmomanometer.dpmCorrections.map((point) => <ValueLine key={point.pressure} label={`${point.pressure} mmHg`} value={`Naik ${point.up} · Turun ${point.down} mmHg`} />)}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi, U95, dan keputusan</Text>
          <FormulaStep number="1" title="Rata-rata dan koreksi" equation="x̄ = Σxi terkoreksi / 3; C = setting − x̄" detail="Simpangan baku s dihitung dari tiga bacaan DPM yang sudah dikoreksi." />
          <FormulaStep number="2" title="Komponen ketidakpastian" equation={`u resolusi = (0,5 × kelas akurasi) / √6; u ulang = s / √3; u drift = drift / √3; u DPM = U95 sertifikat / 2`} detail="Nilai drift mengikuti tabel pada workbook dan arah tekanan." />
          <FormulaStep number="3" title="U95 dan kelulusan" equation="uc = √Σui²; νeff = uc⁴ / Σ(ui⁴ / νi); U95 = max[t(0,975; νeff) × uc, 0,99 mmHg]" detail="Satu arah lulus jika |C| + U95 ≤ 4 mmHg." />
          {instrument.sphygmomanometer.drift.map((point) => <ValueLine key={point.pressure} label={`Drift ${point.pressure} mmHg`} value={`Naik ${point.up} · Turun ${point.down} mmHg`} />)}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Bobot skor</Text>
          <ValueLine label="Pemeriksaan fisik" value="10 poin · lulus jika minimal 70% bagian baik" />
          <ValueLine label="Uji kebocoran" value="30 poin" />
          <ValueLine label="Deflasi cepat" value="30 poin" />
          <ValueLine label="Tekanan naik" value="15 poin · proporsional dari 6 titik lulus" />
          <ValueLine label="Tekanan turun" value="15 poin · proporsional dari 6 titik lulus" />
        </View>
      </> : instrument.weighingScale ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik pemeriksaan</Text>
          <Text style={styles.groupHint}>Uji daya ulang dilakukan pada beban {instrument.weighingScale.repeatabilityLoadKg} kg dengan 10 bacaan. Pengujian beban memakai titik berikut:</Text>
          <View style={styles.pointList}>
            {instrument.weighingScale.points.map((point) => <View key={point.id} style={styles.pointRow}>
              <Text style={styles.pointValue}>{point.loadKg} kg</Text>
              <Text style={styles.pointDescription}>{point.defaultStandardWeightSerials.join(' + ')}</Text>
            </View>)}
          </View>
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Urutan perhitungan</Text>
          <FormulaStep number="1" title="Daya ulang" equation="ri = indikasi − nol; x̄ = Σri / 10; s = √[Σ(ri − x̄)² / 9]" detail={`Simpangan baku yang dilaporkan di Excel = √(2/3) × (0,5 × d). Komponen u daya ulang = (0,5 × d) / 2.`} />
          <FormulaStep number="2" title="Koreksi di tiap titik beban" equation="Massa acuan = Σ massa konvensional 2026; C = indikasi − massa acuan" detail="Aplikasi menjumlahkan massa acuan dari anak timbangan yang dipilih untuk titik tersebut." />
          <FormulaStep number="3" title="Ketidakpastian baku gabungan" equation="uc = √(u resolusi² + u ulang² + u sertifikat² + u drift²)" detail={`u resolusi = (0,5 × d) / √${instrument.weighingScale.resolutionDivisor}; u sertifikat = (Σ U95 anak timbangan / 2) / 1000.`} />
          <FormulaStep number="4" title="U95 dan keputusan" equation="νeff = uc⁴ / Σ(ui⁴ / 50); U95 = t(0,975; νeff) × uc" detail={`LOP = maksimum |C| + maksimum U95. Lulus jika LOP ≤ 10 × d = ${10 * instrument.weighingScale.resolutionKg} kg.`} />
          <Text style={styles.subEquation}>u drift = [Σ{`{0,5 × (massa 2026 − massa 2025) / √3}`} / √3] / 1000</Text>
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Parameter alat</Text>
          <ValueLine label="Kapasitas" value={`${instrument.weighingScale.capacityKg} kg`} />
          <ValueLine label="Resolusi d" value={`${instrument.weighingScale.resolutionKg} kg`} />
          <ValueLine label="Pembagi u resolusi" value={`√${instrument.weighingScale.resolutionDivisor}`} />
        </View>
      </> : <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik pemeriksaan</Text>
          {instrument.performanceRows.map((row) => <ValueLine key={row.id} label={`${row.setting} ${row.unit}`} value={`${row.count} bacaan · toleransi ${row.tolerancePercent}%`} />)}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Urutan perhitungan</Text>
          {formulaRows.map((row, index) => {
            const formula = formulaDisplay[row.formula];
            return <View key={row.formula} style={styles.methodGroup}>
              <Text style={styles.methodTitle}>{formula.title} · {row.count} bacaan</Text>
              <FormulaStep number="1" title="Rata-rata dan simpangan baku" equation="x̄ = Σxi / n; s = √[Σ(xi − x̄)² / (n − 1)]" detail={`n adalah jumlah bacaan pada tiap titik (${row.count}).`} />
              <FormulaStep number="2" title="Koreksi" equation={formula.correction} detail="Bandingkan rata-rata bacaan alat dengan nilai setting pada titik uji." />
              <FormulaStep number="3" title="Ketidakpastian dari bacaan berulang" equation={formula.repeatability} detail="s adalah simpangan baku sampel dari bacaan pada titik tersebut." />
              <FormulaStep number="4" title="Ketidakpastian bentangan 95%" equation="U95 = 2 × √[UA² + (U sertifikat / 2)² + (res UUT / 2√3)² + (res kalibrator / 2√3)²]" detail="Komponen UA, sertifikat standar, resolusi alat yang diuji, dan resolusi kalibrator digabungkan." />
              <FormulaStep number="5" title="Batas toleransi" equation={`MPE = setting × ${row.tolerancePercent}%; lulus jika ${formula.acceptance}`} detail={row.formula === 'flowmeter' ? 'MK-24 menetapkan ±20%, sedangkan Excel menghitung 10%. Aplikasi mengikuti metode MK-24.' : 'MPE adalah batas kesalahan maksimum yang diizinkan pada titik uji.'} />
            </View>;
          })}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>{isActiveWork ? 'Nilai acuan pekerjaan ini' : 'Nilai acuan default Excel'}</Text>
          {isActiveWork && activeReferences ? <>
            <Text style={styles.groupHint}>Nilai ini dipakai di rumus U95 dan hanya berlaku untuk pekerjaan yang sedang dibuka.</Text>
            <Field label="Resolusi kalibrator" value={activeReferences.calibratorResolution} keyboard="decimal-pad" onChange={(value) => onReferenceChange?.('calibratorResolution', value)} />
            <Field label="Ketidakpastian kalibrator (U)" value={activeReferences.calibratorUncertainty} keyboard="decimal-pad" onChange={(value) => onReferenceChange?.('calibratorUncertainty', value)} />
            <Field label="Resolusi alat yang diuji (UUT)" value={activeReferences.uutResolution} keyboard="decimal-pad" onChange={(value) => onReferenceChange?.('uutResolution', value)} />
          </> : <>
            <ValueLine label="Resolusi kalibrator" value={instrument.references.calibratorResolution} />
            <ValueLine label="Ketidakpastian kalibrator (U)" value={instrument.references.calibratorUncertainty} />
            <ValueLine label="Resolusi alat yang diuji (UUT)" value={instrument.references.uutResolution} />
          </>}
        </View>
      </>}
      <Text style={styles.readOnlyNote}>{instrument.suctionPump
        ? `Regresi koreksi dan drift/U95 terkunci pada Digital Pressure Meter ${instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3] ?? 'yang tercantum di workbook'}.`
        : instrument.id === 'infusion-pump' || instrument.id === 'syringe-pump'
          ? `Koefisien koreksi dan U95 mengikuti sertifikat Infusion Device Analyzer ${instrument.standards.find(([name]) => name === 'Infusion Device Analyzer')?.[3] ?? 'yang tercantum di workbook'}; Channel dipilih pada form pengerjaan.`
        : instrument.sphygmomanometer
        ? `Kurva dan U95 DPM terikat pada nomor seri ${instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3] ?? 'yang tercantum di workbook'}. Standar dengan nomor seri lain belum bisa dihitung memakai kurva ini.`
        : 'Rumus dan aturan hitung hanya untuk dibaca. Nilai acuan di atas bisa diedit khusus pada pekerjaan yang sedang dibuka.'}</Text>
    </View> : null}
  </Card>;
}

export function FormulasScreen() {
  const { recordId: rawRecordId } = useLocalSearchParams<{ recordId?: string }>();
  const recordId = Array.isArray(rawRecordId) ? rawRecordId[0] : rawRecordId;
  const { records, updateRecord } = useRecords();
  const record = records.find((item) => item.id === recordId);
  const activeInstrument = record ? getInstrument(record.instrumentId) : undefined;
  const updateReference = (key: keyof MeasurementReferences, value: string) => {
    if (!record) return;
    updateRecord(record.id, { data: { ...record.data, references: { ...record.data.references, [key]: value } } });
  };

  return <ScreenPage title="Rumus" backLabel={record ? 'Pengerjaan' : 'Menu utama'} hint={record && activeInstrument ? `Rumus ${activeInstrument.name} dan alat lain bisa dibuka di bawah. Nilai acuan pekerjaan ada di rumus alat terkait.` : 'Pilih alat untuk melihat titik uji, urutan hitung, nilai acuan, dan batas lulusnya.'}>
    <Card>
      <Heading title="Kondisi lingkungan" hint="Suhu dan kelembapan ruangan dihitung terpisah memakai koreksi thermohygrometer acuan." />
      <Badge text="Excel + sertifikat thermohygrometer" />
      <FormulaStep number="1" title="Cari koreksi dari sertifikat" equation="C(x) = C1 + (x − x1) × (C2 − C1) / (x2 − x1)" detail="Interpolasi di antara dua titik sertifikat yang mengapit bacaan." />
      <FormulaStep number="2" title="Koreksi bacaan awal dan akhir" equation="Nilai terkoreksi = bacaan + C(bacaan)" detail="Koreksi awal dan akhir dicari masing-masing dari tabel sertifikat." />
      <FormulaStep number="3" title="Ringkas kondisi ruangan" equation="Rata-rata = (awal terkoreksi + akhir terkoreksi) / 2; rentang = |awal − akhir|" detail="Rata-rata terkoreksi dicatat sebagai hasil suhu atau kelembapan ruangan." />
      <FormulaStep number="4" title="Hitung ketidakpastian" equation="UA = s / √2; ures = (0,5 × 0,1) / √3; U95 = 2 × √(UA² + U sertifikat² + ures²)" detail="s dihitung dari bacaan awal dan akhir sebelum koreksi." />
    </Card>
    <ExcelQuestionsCard />
    {instruments.map((instrument) => <FormulaCard
      key={instrument.id}
      instrument={instrument}
      activeReferences={activeInstrument?.id === instrument.id ? record?.data.references : undefined}
      onReferenceChange={activeInstrument?.id === instrument.id ? updateReference : undefined}
    />)}
  </ScreenPage>;
}
