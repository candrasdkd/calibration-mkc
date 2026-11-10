import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Badge, Card, Field, Heading, ValueLine } from '../../../components/ui';
import { ScreenPage } from '../../../components/ScreenPage';
import { getConfiguredInstruments, getInstrumentTemplateId, getRecordInstrument } from '../../../core/instruments';
import type { Instrument, InstrumentMethodDraft, InstrumentMethodRevision, MeasurementReferences, PerformanceFormula, PerformanceSetting } from '../../../core/types';
import { StorageMessage } from '../../admin/components/StorageMessage';
import { useAdminData } from '../../admin/hooks/useAdminData';
import { useRole } from '../../home/hooks/useRole';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { instrumentFormulaFields } from '../../../core/methodFormulas';
import { EnvironmentFormulaModal } from '../components/EnvironmentFormulaModal';
import { FormulaEditorModal } from '../components/FormulaEditorModal';
import { styles } from '../styles/FormulasScreenStyles';
import type { FormulaDisplay } from '../types/FormulaDisplay';

const formulaDisplay: Record<PerformanceFormula, FormulaDisplay> = {
  centrifugeSpeed: { title: 'Kecepatan putar', correction: 'C = x̄ − setting', repeatability: 'UA = s / √n', acceptance: '|C + U95| ≤ MPE' },
  centrifugeTime: { title: 'Waktu putar', correction: 'C = x̄ − setting', repeatability: 'UA = s / √n', acceptance: '|C + U95| ≤ MPE' },
  fetalHeartRate: { title: 'Heart rate', correction: 'C = |x̄| − |setting|', repeatability: 'UA = s / √n', acceptance: '|C| + U95 ≤ 5 BPM' },
  flowmeter: { title: 'Laju aliran', correction: 'C = |setting| − |x̄|', repeatability: 'UA = s / √n', acceptance: '|C| + U95 ≤ 20% × setting' },
  infusionFlow: { title: 'Laju aliran pompa', correction: 'C = interceptChannel + slopeChannel × x̄; x̄corr = x̄ + C', repeatability: 'UA = s / √3', acceptance: '|x̄corr − setting| / setting ≤ 10%' },
  workbookAccuracy: { title: 'Akurasi terhadap setting Excel', correction: 'C = x̄ − setting', repeatability: 'UA = s / √n', acceptance: '|C| + U95 ≤ toleransi Excel' },
  workbookMinimum: { title: 'Batas minimum Excel', correction: 'Batas keputusan = x̄ − U95', repeatability: 'UA = s / √n', acceptance: 'x̄ − U95 ≥ batas minimum' },
  workbookMaximum: { title: 'Batas maksimum Excel', correction: 'Batas keputusan = x̄ + U95', repeatability: 'UA = s / √n', acceptance: 'x̄ + U95 ≤ batas maksimum' },
  workbookBand: { title: 'Rentang Excel', correction: 'Cek x̄ di antara batas bawah dan batas atas', repeatability: 'Satu bacaan sesuai lembar Excel', acceptance: 'batas bawah ≤ x̄ ≤ batas atas' },
  workbookPairedAccuracy: { title: 'Rata-rata pasangan minimum/maksimum', correction: 'xi = (min_i + maks_i) / 2; C = x̄pasangan − setting', repeatability: 'UA = s pasangan / √n', acceptance: '|C| + U95 ≤ toleransi Excel' },
  workbookComparisonAccuracy: { title: 'Perbandingan UUT dan standar', correction: 'CUUT = x̄UUT − setting; Cstd = x̄std − setting', repeatability: 'UA dihitung terpisah untuk UUT dan standar', acceptance: 'Keduanya memenuhi toleransi Excel' },
  workbookRange: { title: 'Variasi rentang pengukuran', correction: 'R = nilai maksimum − nilai minimum', repeatability: 'Rentang seluruh bacaan min/maks', acceptance: 'R ≤ batas variasi Excel' },
  customExpression: { title: 'Rumus kustom admin', correction: 'Mengikuti persamaan koreksi yang disimpan admin', repeatability: 'Mengikuti persamaan U95 yang disimpan admin', acceptance: 'Mengikuti aturan lulus yang disimpan admin' },
};

function performanceAcceptance(row: PerformanceSetting) {
  if (row.formula === 'workbookMinimum') return `${row.includeUncertainty === false ? 'x̄' : 'x̄ − U95'} ≥ ${row.setting} ${row.unit}`;
  if (row.formula === 'workbookMaximum') return `${row.includeUncertainty === false ? 'x̄' : 'x̄ + U95'} ≤ ${row.setting} ${row.unit}`;
  if (row.formula === 'workbookBand') return `${row.minimumSetting} ≤ x̄ ≤ ${row.maximumSetting} ${row.unit}`;
  if (row.formula === 'workbookRange') return `maks(bacaan) − min(bacaan) ≤ ${row.absoluteTolerance} ${row.unit}`;
  if (row.formula === 'customExpression') return `Lulus jika ${row.customExpressions?.pass ?? 'aturan belum diatur'}`;
  const fixedTolerance = row.toleranceBySetting?.find((item) => Number(item.setting) === Number(row.setting))?.tolerance ?? row.absoluteTolerance;
  const hasPercent = Number(row.tolerancePercent) > 0;
  const tolerance = fixedTolerance && hasPercent
    ? `maks(${row.tolerancePercent}% × setting, ${fixedTolerance} ${row.unit})`
    : fixedTolerance ? `${fixedTolerance} ${row.unit}` : `${row.tolerancePercent}% × setting`;
  const testValue = row.uncertaintyRule === 'signed' ? '|C + U95|' : '|C| + U95';
  return `${testValue} ≤ ${tolerance}`;
}

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
  'AED: rumus akurasi energi punya batas ±15%, tetapi uji energi maksimum 10 kali dan waktu pengisian tidak memiliki kriteria lulus yang konsisten di lembar Olah Data; keduanya belum dipakai sebagai penentu skor.',
  'Anesthesia Ventilator: beberapa rumus kolom standar mengacu ke bacaan UUT, dan sebagian sel hasil kosong. Aplikasi menghitung seri UUT dan standar terpisah dari nilai yang terisi.',
  'Autoclave: tab Data Mentah tertulis Inkubator/Centrifuge, sedangkan Olah Data bertajuk Autoclave dan memakai siklus 121/134 °C. Implementasi mengikuti tab Olah Data.',
  'Baby Incubator: tab input tertulis Anesthesia Unit; tab Olah Data dipakai. Beberapa formula min/maks merujuk baris bergeser; aplikasi menghitung pasangan per sensor dan variasi max−min dari bacaan mentah.',
  'Blanket Warmer: tab Data Mentah tertulis Blood Warmer, tiga baris Suhu T1 identik, dan hanya baris pertama yang masuk rumus skor. Implementasi menilai ketiganya tetapi skor memakai baris pertama.',
  'Blood Bank Refrigerator: rumus pada beberapa baris T3–T5 tidak terisi lengkap; implementasi memakai pola pasangan minimum/maksimum yang tampak pada baris T1–T2.',
  'Keselamatan listrik: workbook alat baru menampilkan batas arus bocor bagian diaplikasikan 5000 mA, sedangkan pemeriksaan bersama aplikasi memakai 50 mA. Konfirmasi satuan/acuan sebelum hasil keselamatan dipakai resmi.',
  'Bedside Monitor dan Biosafety Cabinet: workbook memakai nomor seri yang sama untuk alat standar berbeda (3904012 dan EFG19BE02496). Konfirmasi nomor seri sebelum sertifikat standar dicantumkan.',
  'Audiometeri: file yang dibagikan berisi pengujian Short Wave Diathermy dan rumus #REF!, jadi alat ini belum dimasukkan.',
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
  onEdit,
  draft,
  activeRevision,
  revisionHistory,
  adminEditorUnavailable,
}: {
  instrument: Instrument;
  activeReferences?: MeasurementReferences;
  onReferenceChange?: (key: keyof MeasurementReferences, value: string) => void;
  onEdit?: () => void;
  draft?: InstrumentMethodDraft;
  activeRevision?: InstrumentMethodRevision;
  revisionHistory?: InstrumentMethodRevision[];
  adminEditorUnavailable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const formulaRows = instrument.performanceRows.filter((row, index, rows) => rows.findIndex((item) => item.formula === row.formula) === index);
  const isActiveWork = Boolean(activeReferences && onReferenceChange);
  const readingCounts = [...new Set(instrument.performanceRows.map((row) => row.count))].sort((a, b) => a - b);
  const templateId = getInstrumentTemplateId(instrument);
  const activeMethodFormulas = instrumentFormulaFields(instrument);
  const occlusionLimit = instrument.infusionPump?.occlusionLimit ?? (templateId === 'syringe-pump' ? 21 : 20);
  const methodSource = ['centrifuge', 'fetal-doppler', 'flowmeter', 'infusion-pump', 'syringe-pump', 'suction-pump'].includes(templateId)
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
    : templateId === 'infusion-pump' || templateId === 'syringe-pump'
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
      {onEdit ? <View style={styles.editorAction}>
        <Badge text={`AKTIF v${instrument.methodVersion ?? 1}`} tone="good" />
        {draft ? <Badge text={`DRAFT v${(instrument.methodVersion ?? 1) + 1}`} tone="wait" /> : null}
        <ActionButton title={draft ? 'Lanjutkan draft metode' : 'Buat draft perubahan'} secondary onPress={onEdit} />
        {activeRevision?.source ? <ValueLine label="Sumber versi aktif" value={activeRevision.source} /> : null}
        {activeRevision?.reason ? <ValueLine label="Perubahan terakhir" value={activeRevision.reason} /> : null}
        {activeRevision?.verifiedBy ? <ValueLine label="Diperiksa oleh" value={activeRevision.verifiedBy} /> : null}
        {activeRevision?.effectiveDate ? <ValueLine label="Berlaku sejak" value={activeRevision.effectiveDate} /> : null}
      </View> : null}
      {onEdit && revisionHistory?.length ? <View style={styles.formulaGroup}>
        <Text style={styles.formulaGroupTitle}>Riwayat perubahan metode</Text>
        {[...revisionHistory].sort((a, b) => b.version - a.version).slice(0, 5).map((revision) => <View key={revision.version}>
          <Badge text={`VERSI ${revision.version}`} tone="good" />
          {revision.source ? <ValueLine label="Sumber" value={revision.source} /> : null}
          {revision.reason ? <ValueLine label="Perubahan" value={revision.reason} /> : null}
          {revision.verificationNote ? <ValueLine label="Hasil pembanding" value={revision.verificationNote} /> : null}
          {revision.verifiedBy ? <ValueLine label="Diperiksa oleh" value={revision.verifiedBy} /> : null}
          {revision.effectiveDate ? <ValueLine label="Berlaku sejak" value={revision.effectiveDate} /> : null}
        </View>)}
      </View> : null}
      {activeMethodFormulas.length ? <View style={styles.formulaGroup}>
        <Text style={styles.formulaGroupTitle}>Rumus aktif kalkulator</Text>
        {activeMethodFormulas.map((field, index) => <FormulaStep key={field.key} number={String(index + 1)} title={field.label} equation={instrument.formulaExpressions?.[field.key] ?? field.expression} detail={field.detail} />)}
      </View> : null}
      <View style={styles.formulaGroup}>
        <Text style={styles.formulaGroupTitle}>Bobot dan ambang skor</Text>
        <ValueLine label="Kinerja" value={`${instrument.score.performanceWeight} poin · ambang ${instrument.score.performanceThreshold}%`} />
        <ValueLine label="Fisik dan fungsi" value={`${instrument.score.physicalWeight} poin · ambang ${instrument.score.physicalThreshold ?? 70}%`} />
        <ValueLine label="Status laik pakai" value={`Skor minimum ${instrument.score.overallPassThreshold ?? 70}%`} />
      </View>
      {instrument.suctionPump ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik dan langkah pengukuran</Text>
          {instrument.suctionPump.pressurePoints.map((setting) => <ValueLine key={setting} label={`${Math.abs(setting)} mmHg vakum`} value="6 bacaan arah naik · 6 bacaan arah turun" />)}
          <ValueLine label="Daya hisap maksimum" value={`Tekanan vakum ${instrument.suctionPump.minimumVacuumMmHg}–${instrument.suctionPump.maximumVacuumMmHg} mmHg · waktu ≤ ${instrument.suctionPump.maximumVacuumSeconds} detik`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi Digital Pressure Meter</Text>
          <FormulaStep number="1" title="Tanda bacaan" equation="x̄ = −rata-rata(bacaan DPM)" detail="Bacaan diisi tanpa tanda minus di form; aplikasi mengubahnya menjadi tekanan bertanda negatif seperti tabel scoring Excel." />
          <FormulaStep number="2" title="Koreksi regresi drift" equation={instrument.formulaExpressions?.['suction.correction'] ?? 'intercept + slope * signedMean'} detail={`Koefisien arah naik dan turun mengikuti tabel aktif untuk DPM nomor seri ${instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3]}.`} />
          <FormulaStep number="3" title="Ketidakpastian" equation={`UA = ${instrument.formulaExpressions?.['suction.ua'] ?? 'standardDeviation / sqrt(n)'}; U95 = ${instrument.formulaExpressions?.['suction.u95'] ?? 'sqrt(uResolution^2 + ua^2 + uDrift^2 + uDpm^2) * k95'}`} detail="Komponen resolusi, drift, sertifikat, dan derajat kebebasan mengikuti konfigurasi metode aktif." />
          <FormulaStep number="4" title="Keputusan" equation={`${instrument.formulaExpressions?.['suction.error'] ?? 'correctedMean - setting'}; ${instrument.formulaExpressions?.['suction.pressurePass'] ?? 'abs(error / setting) <= toleranceRatio'}`} detail="Rumus galat dan aturan lulus mengikuti metode aktif." />
        </View>
      </> : templateId === 'infusion-pump' || templateId === 'syringe-pump' ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik ukur laju aliran</Text>
          {instrument.performanceRows.map((row) => <ValueLine key={row.id} label={`${row.setting} ${row.unit}`} value={`${row.count} bacaan · toleransi ${((instrument.infusionPump?.flowToleranceRatio ?? 0.1) * 100).toLocaleString('id-ID')}%`} />)}
          <ValueLine label="Occlusion" value={`Setting 100 mL/h · 6 bacaan · batas rata-rata ≤ ${occlusionLimit} psi`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi analyzer dan ketidakpastian</Text>
          <FormulaStep number="1" title="Koreksi laju aliran" equation={`C = ${instrument.formulaExpressions?.['pump.flowCorrection'] ?? 'intercept + slope * mean'}; x̄corr = ${instrument.formulaExpressions?.['pump.correctedMean'] ?? 'mean + correction'}`} detail="Koefisien tiap channel yang dipilih admin dipakai kalkulator." />
          {instrument.infusionPump?.channels.map((channel) => <ValueLine key={channel.channel} label={channel.channel} value={`Flow intercept ${channel.flowIntercept} · slope ${channel.flowSlope} | Occlusion intercept ${channel.occlusionIntercept} · slope ${channel.occlusionSlope}`} />)}
          <FormulaStep number="2" title="U95 tiap titik" equation={`UA = ${instrument.formulaExpressions?.['pump.ua'] ?? 'standardDeviation / sqrt(3)'}; U95 = ${instrument.formulaExpressions?.['pump.u95'] ?? 'sqrt(uResolution^2 + ua^2 + uDrift^2 + uCertificate^2) * k95'}`} detail="Drift, U95 sertifikat, dan derajat kebebasan mengikuti konfigurasi metode aktif." />
          <FormulaStep number="3" title="Keputusan laju aliran" equation={`Nilai = ${instrument.formulaExpressions?.['pump.flowTestValue'] ?? 'abs(error / setting)'}; lulus = ${instrument.formulaExpressions?.['pump.flowPass'] ?? 'testValue <= tolerance'}`} detail="U95 dicatat untuk hasil; aturan lulus memakai persamaan metode aktif." />
          <FormulaStep number="4" title="Occlusion" equation={`Koreksi = ${instrument.formulaExpressions?.['pump.occlusionCorrection'] ?? 'intercept + slope * mean'}; U95 = ${instrument.formulaExpressions?.['pump.occlusionU95'] ?? 'sqrt(uResolution^2 + ua^2 + uDpm^2) * k95'}; lulus = ${instrument.formulaExpressions?.['pump.occlusionPass'] ?? 'mean <= limit'}`} detail={`Batas occlusion aktif ${instrument.infusionPump?.occlusionLimit} psi.`} />
        </View>
      </> : instrument.sphygmomanometer ? <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Alur dan batas pengujian</Text>
          <FormulaStep number="1" title="Kebocoran" equation="Pompa 250 mmHg; ukur penurunan setelah 1 menit" detail={`Batas aktif: ≤ ${instrument.sphygmomanometer.leakageLimitMmHg} mmHg.`} />
          <FormulaStep number="2" title="Deflasi cepat" equation="Pompa 260 mmHg; ukur waktu deflasi" detail={`Batas aktif: ≤ ${instrument.sphygmomanometer.deflationLimitSeconds} detik.`} />
          <FormulaStep number="3" title="Ketepatan tekanan" equation={`Setting ${instrument.sphygmomanometer.pressurePoints.join(', ')} mmHg · 3 bacaan DPM saat tekanan naik dan turun`} detail={`Sphygmomanometer ${instrument.sphygmomanometer.accuracyClass === 1 ? 'digital' : 'analog'} · tingkat ketelitian ${instrument.sphygmomanometer.accuracyClass} mmHg.`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi Digital Pressure Meter</Text>
          <FormulaStep number="1" title="Interpolasi sertifikat" equation={instrument.formulaExpressions?.['sphyg.interpolation'] ?? 'c1 + (x - x1) * (c2 - c1) / (x2 - x1)'} detail="Koreksi dihitung terpisah untuk pembacaan naik dan turun." />
          <FormulaStep number="2" title="Bacaan terkoreksi" equation={instrument.formulaExpressions?.['sphyg.correctedReading'] ?? 'reading + correction'} detail={`U95 sertifikat DPM = ${instrument.sphygmomanometer.dpmU95} mmHg. Kurva di bawah mengikuti nomor seri pada workbook.`} />
          {instrument.sphygmomanometer.dpmCorrections.map((point) => <ValueLine key={point.pressure} label={`${point.pressure} mmHg`} value={`Naik ${point.up} · Turun ${point.down} mmHg`} />)}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Koreksi, U95, dan keputusan</Text>
          <FormulaStep number="1" title="Rata-rata dan koreksi" equation={`Koreksi = ${instrument.formulaExpressions?.['sphyg.correction'] ?? 'setting - mean'}; nilai keputusan = ${instrument.formulaExpressions?.['sphyg.decision'] ?? 'abs(correction) + u95'}`} detail="Simpangan baku s dihitung dari tiga bacaan DPM yang sudah dikoreksi." />
          <FormulaStep number="2" title="Komponen ketidakpastian" equation={`Resolusi = ${instrument.formulaExpressions?.['sphyg.uResolution'] ?? '(0.5 * accuracyClass) / sqrt(6)'}; ulang = ${instrument.formulaExpressions?.['sphyg.uRepeatability'] ?? 'standardDeviation / sqrt(3)'}; drift = ${instrument.formulaExpressions?.['sphyg.uDrift'] ?? 'drift / sqrt(3)'}; DPM = ${instrument.formulaExpressions?.['sphyg.uDpm'] ?? 'dpmU95 / 2'}`} detail="Nilai drift mengikuti tabel pada workbook dan arah tekanan." />
          <FormulaStep number="3" title="U95 dan kelulusan" equation={`U95 = ${instrument.formulaExpressions?.['sphyg.u95'] ?? 'max(k95 * sqrt(sumU2), minimumU95)'}; lulus = ${instrument.formulaExpressions?.['sphyg.pressurePass'] ?? 'decisionValue <= pressureTolerance'}`} detail="Persamaan keputusan tekanan mengikuti metode aktif." />
          {instrument.sphygmomanometer.drift.map((point) => <ValueLine key={point.pressure} label={`Drift ${point.pressure} mmHg`} value={`Naik ${point.up} · Turun ${point.down} mmHg`} />)}
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
          <FormulaStep number="1" title="Daya ulang" equation={`Simpangan baku laporan = ${instrument.formulaExpressions?.['weighing.reportSD'] ?? 'sqrt(2 / 3) * (0.5 * d)'}; u ulang = ${instrument.formulaExpressions?.['weighing.uRepeatability'] ?? '(0.5 * d) / 2'}`} detail="Hasil daya ulang memakai bacaan yang dimasukkan teknisi." />
          <FormulaStep number="2" title="Koreksi di tiap titik beban" equation={`Massa acuan = ${instrument.formulaExpressions?.['weighing.referenceMass'] ?? 'sumMass2026G / 1000'}; C hitung = ${instrument.formulaExpressions?.['weighing.correction'] ?? 'indication - referenceMass'}; C LK = ${instrument.formulaExpressions?.['weighing.reportCorrection'] ?? 'referenceMass - indication'}`} detail="Aplikasi menjumlahkan massa acuan dari anak timbangan yang dipilih untuk titik tersebut." />
          <FormulaStep number="3" title="Komponen ketidakpastian" equation={`Resolusi = ${instrument.formulaExpressions?.['weighing.uResolution'] ?? '(0.5 * d) / sqrt(resolutionDivisor)'}; sertifikat = ${instrument.formulaExpressions?.['weighing.uCertificate'] ?? '(sumCertificateU95G / 2) / 1000'}; drift = ${instrument.formulaExpressions?.['weighing.uDrift'] ?? '(0.5 * sumDriftDeltaG / sqrt(3) / sqrt(3)) / 1000'}`} detail="Komponen U95 memakai parameter metode aktif." />
          <FormulaStep number="4" title="U95 dan keputusan" equation={`U95 = ${instrument.formulaExpressions?.['weighing.u95'] ?? 'sqrt(uResolution^2 + uRepeatability^2 + uCertificate^2 + uDrift^2) * k95'}; LOP = ${instrument.formulaExpressions?.['weighing.lop'] ?? 'maxCorrection + maxU95'}; lulus = ${instrument.formulaExpressions?.['weighing.pass'] ?? 'lop <= limit'}`} detail={`Batas LOP aktif ${instrument.formulaExpressions?.['weighing.limit'] ?? '10 * d'}.`} />
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Parameter alat</Text>
          <ValueLine label="Kapasitas" value={`${instrument.weighingScale.capacityKg} kg`} />
          <ValueLine label="Tingkat ketelitian d" value={`${instrument.weighingScale.resolutionKg} kg`} />
          <ValueLine label="Pembagi u resolusi" value={`√${instrument.weighingScale.resolutionDivisor}`} />
        </View>
      </> : <>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Titik pemeriksaan</Text>
          {instrument.performanceRows.map((row) => <ValueLine key={row.id} label={`${row.label} · ${row.setting} ${row.unit}`} value={`${row.formula === 'workbookRange' ? 'otomatis' : `${row.count} bacaan`} · ${performanceAcceptance(row)}${row.includeInScore === false ? ' · di luar skor' : ''}`} />)}
        </View>
        <View style={styles.formulaGroup}>
          <Text style={styles.formulaGroupTitle}>Urutan perhitungan</Text>
          {formulaRows.map((row, index) => {
            const formula = formulaDisplay[row.formula];
            return <View key={row.formula} style={styles.methodGroup}>
              <Text style={styles.methodTitle}>{formula.title} · {row.formula === 'workbookRange' ? 'otomatis' : `${row.count} bacaan`}</Text>
              {row.formula === 'workbookRange' ? <>
                <FormulaStep number="1" title="Hitung variasi" equation="R = maksimum bacaan min/maks − minimum bacaan min/maks" detail="Nilainya diturunkan otomatis dari seluruh bacaan sensor yang sama." />
                <FormulaStep number="2" title="Batas lulus" equation={performanceAcceptance(row)} detail="Batas variasi berbeda mengikuti suhu kontrol di workbook." />
              </> : <>
                <FormulaStep number="1" title="Rata-rata dan simpangan baku" equation={row.formula === 'workbookPairedAccuracy' ? 'xi = (bacaan minimum_i + bacaan maksimum_i) / 2; x̄ = Σxi / n' : row.formula === 'workbookComparisonAccuracy' ? 'x̄UUT = ΣUUT_i / n; x̄standar = Σstandar_i / n' : 'x̄ = Σxi / n; s = √[Σ(xi − x̄)² / (n − 1)]'} detail={`n adalah jumlah bacaan pada tiap titik (${row.count}).`} />
                {row.formula === 'customExpression' && row.customExpressions ? <>
                  <FormulaStep number="2" title="Koreksi" equation={row.customExpressions.correction} detail="Persamaan koreksi aktif yang dipakai kalkulator." />
                  <FormulaStep number="3" title="U95" equation={row.customExpressions.uncertainty} detail="Ketidakpastian dihitung sesuai persamaan metode." />
                  <FormulaStep number="4" title="Toleransi dan nilai keputusan" equation={`${row.customExpressions.testValue}; batas ${row.customExpressions.tolerance}`} detail="Nilai keputusan dihitung dari input teknisi lalu dibandingkan dengan toleransi." />
                  <FormulaStep number="5" title="Aturan lulus" equation={row.customExpressions.pass} detail="Persamaan ini menentukan status titik uji." />
                </> : <>
                  <FormulaStep number="2" title="Koreksi" equation={formula.correction} detail="Bandingkan rata-rata bacaan alat dengan nilai setting pada titik uji." />
                  <FormulaStep number="3" title="Ketidakpastian dari bacaan berulang" equation={formula.repeatability} detail="s adalah simpangan baku sampel dari bacaan pada titik tersebut." />
                  <FormulaStep number="4" title={row.includeUncertainty === false ? 'Keputusan tanpa U95' : 'Ketidakpastian bentangan 95%'} equation={row.includeUncertainty === false ? 'U95 tidak ditambahkan ke keputusan, sesuai kriteria pada Excel.' : 'U95 = 2 × √[UA² + (U sertifikat / 2)² + (res UUT / 2√3)² + (res kalibrator / 2√3)²]'} detail={row.includeUncertainty === false ? 'Excel membandingkan rata-rata langsung dengan batas.' : 'Komponen UA, sertifikat standar, resolusi alat yang diuji, dan resolusi kalibrator digabungkan.'} />
                  <FormulaStep number="5" title="Batas lulus" equation={performanceAcceptance(row)} detail={row.formula === 'workbookComparisonAccuracy' ? 'UUT dan standar dinilai terpisah; keduanya harus lulus.' : row.formula === 'workbookPairedAccuracy' ? 'Setiap bacaan minimum dipasangkan dengan bacaan maksimum pada nomor yang sama.' : 'Batas dan arah pengujian mengikuti rumus pada workbook.'} />
                </>}
              </>}
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
        ? `Kurva awal mengikuti Digital Pressure Meter ${instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3] ?? 'yang tercantum di workbook'} dan dapat diubah admin pada versi metode.`
        : templateId === 'infusion-pump' || templateId === 'syringe-pump'
          ? `Koefisien awal dan U95 mengikuti sertifikat Infusion Device Analyzer ${instrument.standards.find(([name]) => name === 'Infusion Device Analyzer')?.[3] ?? 'yang tercantum di workbook'}; admin dapat menerbitkan perubahan metode. Channel dipilih pada form pengerjaan.`
        : instrument.sphygmomanometer
        ? `Kurva dan U95 DPM terikat pada nomor seri ${instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3] ?? 'yang tercantum di workbook'}. Standar dengan nomor seri lain belum bisa dihitung memakai kurva ini.`
        : isActiveWork ? 'Rumus metode menjadi acuan pekerjaan ini. Nilai acuan di atas bisa diedit khusus untuk pekerjaan yang sedang dibuka.'
          : adminEditorUnavailable ? 'Metode ini belum memiliki pola rumus atau kalkulator yang bisa diedit.'
          : onEdit ? 'Admin bisa mengubah metode, pola rumus, titik uji, dan nilai acuan untuk pekerjaan baru.'
            : 'Rumus mengikuti versi metode yang dipakai pada pekerjaan.'}</Text>
    </View> : null}
  </Card>;
}

export function FormulasScreen() {
  const { recordId: rawRecordId } = useLocalSearchParams<{ recordId?: string }>();
  const recordId = Array.isArray(rawRecordId) ? rawRecordId[0] : rawRecordId;
  const { records, updateRecord } = useRecords();
  const directory = useAdminData();
  const { role } = useRole();
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [editingEnvironment, setEditingEnvironment] = useState(false);
  const record = records.find((item) => item.id === recordId);
  const activeInstrument = record ? getRecordInstrument(record) : undefined;
  const formulaInstruments = getConfiguredInstruments(directory.methodRevisions).map((instrument) => activeInstrument
    && getInstrumentTemplateId(activeInstrument) === instrument.id ? activeInstrument : instrument);
  const activeEnvironmentRevision = directory.environmentMethodRevisions.reduce<typeof directory.environmentMethodRevisions[number] | undefined>(
    (latest, entry) => !latest || entry.version > latest.version ? entry : latest,
    undefined,
  );
  const adminMethodList = role === 'admin' && !recordId;
  const editorReady = adminMethodList && directory.loaded && !directory.storageError;
  const supportsMethodEditor = (instrument: Instrument) => instrument.performanceRows.length > 0 || instrumentFormulaFields(instrument).length > 0;
  const updateReference = (key: keyof MeasurementReferences, value: string) => {
    if (!record) return;
    updateRecord(record.id, { data: { ...record.data, references: { ...record.data.references, [key]: value } } });
  };

  return <>
  <ScreenPage title="Rumus" backLabel={record ? 'Pengerjaan' : 'Menu utama'} hint={adminMethodList ? 'Admin menyiapkan draft. Versi aktif baru dipakai untuk pekerjaan setelah data acuan dan pemeriksaan hasil dilengkapi.' : record && activeInstrument ? `Rumus ${activeInstrument.name} dan alat lain bisa dibuka di bawah. Nilai acuan pekerjaan ada di rumus alat terkait.` : 'Pilih alat untuk melihat titik uji, urutan hitung, nilai acuan, dan batas lulusnya.'}>
    <Card>
      <Heading title="Kondisi lingkungan" hint="Suhu dan kelembapan ruangan dihitung terpisah memakai koreksi thermohygrometer acuan." />
      <Badge text="Excel + sertifikat thermohygrometer" />
      {editorReady ? <View style={styles.editorAction}>
        <Badge text={`AKTIF v${directory.environmentMethod.version}`} tone="good" />
        {directory.environmentDraft ? <Badge text={`DRAFT v${directory.environmentMethod.version + 1}`} tone="wait" /> : null}
        <ActionButton title={directory.environmentDraft ? 'Lanjutkan draft lingkungan' : 'Buat draft perubahan'} secondary onPress={() => setEditingEnvironment(true)} />
        {activeEnvironmentRevision?.source ? <ValueLine label="Sumber versi aktif" value={activeEnvironmentRevision.source} /> : null}
        {activeEnvironmentRevision?.reason ? <ValueLine label="Perubahan terakhir" value={activeEnvironmentRevision.reason} /> : null}
        {activeEnvironmentRevision?.verificationNote ? <ValueLine label="Hasil pembanding" value={activeEnvironmentRevision.verificationNote} /> : null}
        {activeEnvironmentRevision?.verifiedBy ? <ValueLine label="Diperiksa oleh" value={activeEnvironmentRevision.verifiedBy} /> : null}
        {activeEnvironmentRevision?.effectiveDate ? <ValueLine label="Berlaku sejak" value={activeEnvironmentRevision.effectiveDate} /> : null}
      </View> : null}
      {editorReady && directory.environmentMethodRevisions.length ? <View style={styles.formulaGroup}>
        <Text style={styles.formulaGroupTitle}>Riwayat versi rumus lingkungan</Text>
        {[...directory.environmentMethodRevisions].sort((a, b) => b.version - a.version).slice(0, 5).map((revision) => <View key={revision.version}>
          <Badge text={`VERSI ${revision.version}`} tone="good" />
          {revision.source ? <ValueLine label="Sumber" value={revision.source} /> : null}
          {revision.reason ? <ValueLine label="Perubahan" value={revision.reason} /> : null}
          {revision.verificationNote ? <ValueLine label="Hasil pembanding" value={revision.verificationNote} /> : null}
          {revision.verifiedBy ? <ValueLine label="Diperiksa oleh" value={revision.verifiedBy} /> : null}
          {revision.effectiveDate ? <ValueLine label="Berlaku sejak" value={revision.effectiveDate} /> : null}
        </View>)}
      </View> : null}
      <FormulaStep number="1" title="Cari koreksi dari sertifikat" equation={directory.environmentMethod.expressions.interpolation} detail="Interpolasi di antara dua titik sertifikat yang mengapit bacaan." />
      <FormulaStep number="2" title="Koreksi bacaan awal dan akhir" equation={directory.environmentMethod.expressions.correctedReading} detail="Koreksi awal dan akhir dicari masing-masing dari tabel sertifikat." />
      <FormulaStep number="3" title="Ringkas kondisi ruangan" equation={`Rata-rata: ${directory.environmentMethod.expressions.mean}; rentang: ${directory.environmentMethod.expressions.range}`} detail="Rata-rata terkoreksi dicatat sebagai hasil suhu atau kelembapan ruangan." />
      <FormulaStep number="4" title="Hitung ketidakpastian" equation={`UA: ${directory.environmentMethod.expressions.ua}; u resolusi: ${directory.environmentMethod.expressions.uResolution}; U95: ${directory.environmentMethod.expressions.u95}`} detail="Formula kondisi lingkungan versi aktif diterapkan pada pekerjaan baru." />
    </Card>
    {adminMethodList ? <StorageMessage message={directory.storageError} /> : null}
    <ExcelQuestionsCard />
    {formulaInstruments.map((instrument) => <FormulaCard
      key={instrument.id}
      instrument={instrument}
      activeReferences={activeInstrument && getInstrumentTemplateId(activeInstrument) === instrument.id ? record?.data.references : undefined}
      onReferenceChange={activeInstrument && getInstrumentTemplateId(activeInstrument) === instrument.id ? updateReference : undefined}
      onEdit={editorReady && supportsMethodEditor(instrument) ? () => setEditingInstrument(instrument) : undefined}
      draft={directory.methodDrafts.find((entry) => entry.instrumentId === instrument.id)}
      activeRevision={directory.methodRevisions.filter((entry) => entry.instrumentId === instrument.id).reduce<InstrumentMethodRevision | undefined>((latest, entry) => !latest || entry.version > latest.version ? entry : latest, undefined)}
      revisionHistory={directory.methodRevisions.filter((entry) => entry.instrumentId === instrument.id)}
      adminEditorUnavailable={adminMethodList && directory.loaded && !directory.storageError && !supportsMethodEditor(instrument)}
    />)}
  </ScreenPage>
    {editingEnvironment ? <EnvironmentFormulaModal
      visible
      method={directory.environmentMethod}
      draft={directory.environmentDraft ?? undefined}
      onClose={() => setEditingEnvironment(false)}
      onSaveDraft={(method, metadata) => directory.saveEnvironmentMethodDraft(method, metadata)}
      onPublish={(method, metadata) => directory.publishEnvironmentMethod(method, metadata)}
      onDiscardDraft={directory.discardEnvironmentMethodDraft}
    /> : null}
    {editingInstrument ? <FormulaEditorModal
      visible
      instrument={editingInstrument}
      version={editingInstrument.methodVersion ?? 0}
      existingDraft={directory.methodDrafts.find((entry) => entry.instrumentId === editingInstrument.id)}
      onClose={() => setEditingInstrument(null)}
      onSaveDraft={(updated, metadata) => directory.saveInstrumentMethodDraft(updated, metadata)}
      onPublish={(updated, metadata) => directory.publishInstrumentMethod(updated, metadata)}
      onDiscardDraft={() => directory.discardInstrumentMethodDraft(editingInstrument.id)}
    /> : null}
  </>;
}
