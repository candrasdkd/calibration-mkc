import type { CalculationResult, CalibrationRecord, DocumentKind, Instrument, PerformanceResultRow } from './types';
import { mkcLogo } from './mkcLogo';
import { getInstrumentTemplateId } from './instruments';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const html = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, (character) => entities[character] ?? character);
const fixed = (value: number | null | undefined, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
const accuracyValue = (value: string) => value.replace(/^kelas\s*/i, '').trim();
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function date(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}` : html(value);
}

function validityDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  const month = Number(match[2]) - 1;
  const expiry = new Date(Number(match[1]) + 1, month, Number(match[3]));
  if (expiry.getMonth() !== month) expiry.setDate(0);
  return `${expiry.getDate()} ${months[expiry.getMonth()]} ${expiry.getFullYear()}`;
}

function capacityUnit(instrument: Instrument) {
  const templateId = getInstrumentTemplateId(instrument);
  if (instrument.weighingScale) return 'kg';
  if (instrument.sphygmomanometer) return 'mmHg';
  if (instrument.suctionPump) return 'mmHg';
  return templateId === 'fetal-doppler' ? 'BPM'
    : templateId === 'flowmeter' ? 'L/min'
      : ['infusion-pump', 'syringe-pump'].includes(templateId) ? 'mL/h' : 'RPM';
}

function reportStyles() {
  return `<style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:8pt Arial,sans-serif;color:#172a33;margin:0}.page{page-break-after:always;break-after:page}.page:last-child{page-break-after:auto;break-after:auto}.header{display:grid;grid-template-columns:82px 1fr;border:1px solid #1d333c;margin-bottom:9px}.logo{width:66px;height:50px;object-fit:contain;align-self:center;justify-self:center}.header-main{text-align:center}.header-main h1{font-size:12pt;margin:4px 0;border-bottom:1px solid #1d333c;padding:4px}.header-main h2{font-size:11pt;margin:0;border-bottom:1px solid #1d333c;padding:4px}.header-meta{display:flex;justify-content:space-between;padding:4px 7px;font-size:7pt;font-weight:bold}.section{margin-top:7px}.section-title{padding:4px 6px;background:#eaf1f2;border:1px solid #52666e;border-bottom:0;font-weight:bold}.section-title span{display:inline-block;width:25px}.grid{border-collapse:collapse;width:100%;margin:0 0 2px}.grid th,.grid td{border:1px solid #52666e;padding:3px 4px;vertical-align:middle}.grid th{background:#f3f6f6;text-align:center}.grid td:first-child{width:auto}.identity td:first-child{width:30%}.identity td:nth-child(2){width:16px;text-align:center}.small{font-size:7pt}.muted{font-size:7pt;color:#536a72}.result{text-align:center;font-weight:bold}.checks td:first-child,.checks th:first-child{text-align:center;width:26px}.performance th,.performance td{text-align:center;padding:3px 2px;font-size:7pt}.performance td:first-child{text-align:left}.performance .calc td{text-align:left;background:#f3f6f6}.summary{margin-top:7px;padding:7px;border:1px solid #52666e;text-align:right;font-weight:bold}.footer{margin-top:10px;font-size:7pt;display:flex;justify-content:space-between}.signature{display:flex;justify-content:space-around;text-align:center;margin-top:28px;line-height:1.4}.signature div{width:42%}.page-label{font-size:7pt;text-align:center;margin-top:8px;color:#536a72}
  </style>`;
}

function section(letter: string, title: string, content: string) {
  return `<div class="section"><div class="section-title"><span>${letter}.</span>${html(title)}</div>${content}</div>`;
}

function header(instrument: Instrument, record: CalibrationRecord, title: string, code = '') {
  const identity = record.data.identity;
  return `<div class="header"><img class="logo" src="${mkcLogo}"><div class="header-main"><h1>${html(title)}</h1><h2>${html(instrument.name)}</h2><div class="header-meta"><span>${code ? `No. LK: ${html(code)}` : 'LAPORAN HASIL PENGUJIAN / KALIBRASI'}</span><span>No. Label: ${html(identity.labelNumber)}</span></div></div></div>`;
}

function identityTable(record: CalibrationRecord, instrument: Instrument) {
  const { identity } = record.data;
  const capacity = identity.capacity ? `${identity.capacity} ${capacityUnit(instrument)}` : '—';
  const accuracy = accuracyValue(identity.accuracy) ? `${accuracyValue(identity.accuracy)} ${capacityUnit(instrument)}` : '—';
  const entries: [string, unknown][] = [
    ['Nama alat', instrument.name], ['Merek', identity.brand], ['Tipe / model', identity.model], ['Nomor seri', identity.serial],
    ['Kapasitas', capacity], ['Tingkat ketelitian', accuracy], ['Pelanggan', identity.customer],
    ['Alamat', [identity.address, identity.city].filter(Boolean).join(', ')], ['Ruang pelaksanaan', identity.room],
    ['Petugas pelaksana', identity.technician], ['Tanggal penerimaan', date(identity.receivedDate)], ['Tanggal pelaksanaan', date(identity.testDate)],
    ['Metode kerja', identity.method],
  ];
  return `<table class="grid identity"><tbody>${entries.map(([label, value]) => `<tr><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</tbody></table>`;
}

// shortcut: traceability covers the serials in the supplied workbooks; add it to standard data before using new serials.
function traceability(serial: string) {
  if (serial === 'EFG19BE02496' || ['G2128009', 'G2128010', 'G2128011', 'G2128012', 'G2128013', 'G2128014'].some((item) => serial.includes(item))) return 'LK-IDN-032';
  if (['G2128057', 'G2128058', 'G2128059', 'G2128060', 'G2128061'].some((item) => serial.includes(item))) return 'LK-IDN-081';
  return '—';
}

function standardsTable(record: CalibrationRecord, instrument: Instrument, includeTraceability = false) {
  const selected = record.data.selectedDevices?.length
    ? record.data.selectedDevices
    : instrument.standards.map(([name, brand, model, serial]) => ({ id: name, name, brand, model, serial }));
  const weights = record.data.weighing?.points.flatMap((point) => point.standardWeights) ?? [];
  const uniqueWeights = [...new Map(weights.map((weight) => [weight.serial, weight])).values()];
  const rows = [
    ...selected.map((item) => `<tr><td>${html(item.name)}</td><td>${html(item.brand)}</td><td>${html(item.model)}</td><td>${html(item.serial)}</td>${includeTraceability ? `<td>${traceability(item.serial)}</td>` : ''}</tr>`),
    ...uniqueWeights.map((item) => `<tr><td>${html(`${item.name} ${item.nominalKg} kg`)}</td><td>${html(item.brand)}</td><td>${html(item.model)}</td><td>${html(item.serial)}</td>${includeTraceability ? `<td>${traceability(item.serial)}</td>` : ''}</tr>`),
  ].join('');
  return `<table class="grid"><thead><tr><th>Nama peralatan</th><th>Merek</th><th>Tipe</th><th>Nomor seri</th>${includeTraceability ? '<th>Tertelusur</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>`;
}

function workbookIdentityTable(record: CalibrationRecord, instrument: Instrument) {
  const { identity } = record.data;
  const capacity = identity.capacity ? `${identity.capacity} ${capacityUnit(instrument)}` : '—';
  const accuracy = accuracyValue(identity.accuracy) ? `${accuracyValue(identity.accuracy)} ${capacityUnit(instrument)}` : '—';
  const entries: [string, unknown][] = [
    ['Milik', identity.customer], ['Merk', identity.brand], ['Tipe / Model', identity.model], ['Nomer Seri', identity.serial],
    [instrument.weighingScale ? 'Kapasitas Maksimum' : 'Kapasitas', capacity], ['Tingkat Ketelitian', accuracy],
  ];
  return `<table class="grid identity"><tbody>${entries.map(([label, value], index) => `<tr><td>${index + 1}.</td><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</tbody></table>`;
}

function executionTable(record: CalibrationRecord) {
  const { identity } = record.data;
  const entries: [string, unknown][] = [['Ruangan', identity.room], ['Tanggal Penerimaan', date(identity.receivedDate)], ['Tanggal Pelaksanaan', date(identity.testDate)]];
  return `<table class="grid identity"><tbody>${entries.map(([label, value], index) => `<tr><td>${index + 1}.</td><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</tbody></table>`;
}

function workbookEnvironmentTable(result: CalculationResult) {
  const rows = [
    ['Suhu Ruangan', result.environment.temperature?.mean, result.environment.temperature?.u95, '°C'],
    ['Kelembaban', result.environment.humidity?.mean, result.environment.humidity?.u95, '% RH'],
  ];
  return `<table class="grid"><thead><tr><th>No.</th><th>Parameter</th><th>Rata-rata</th><th>Ketidakpastian (U95)</th><th>Unit</th></tr></thead><tbody>${rows.map(([label, mean, u95, unit], index) => `<tr><td>${index + 1}.</td><td>${label}</td><td>${fixed(mean as number | null)}</td><td>${fixed(u95 as number | null)}</td><td>${unit}</td></tr>`).join('')}</tbody></table>`;
}

function workbookOpening(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const weighing = Boolean(instrument.weighingScale);
  const environment = section(weighing ? 'C' : 'D', 'Pengukuran Kondisi Lingkungan', workbookEnvironmentTable(result));
  const standards = section(weighing ? 'D' : 'C', 'Daftar Alat Ukur', standardsTable(record, instrument, weighing));
  return `${header(instrument, record, 'Laporan Hasil Pengujian / Kalibrasi')}${section('A', 'Data Alat Pelanggan', workbookIdentityTable(record, instrument))}${section('B', 'Pelaksanaan Pengujian / Kalibrasi', executionTable(record))}${weighing ? `${environment}${standards}` : `${standards}${environment}`}${section('E', 'Pemeriksaan Kondisi Fisik dan Fungsi', inspectionTable(result))}`;
}

function environmentTable(result: CalculationResult, mainsVoltage = '') {
  const temperature = result.environment.temperature;
  const humidity = result.environment.humidity;
  const rows = [
    ['Temperatur ruangan', '°C', temperature?.start, temperature?.startCorrection, temperature?.correctedStart, temperature?.end, temperature?.endCorrection, temperature?.correctedEnd, temperature?.mean, temperature?.u95],
    ['Kelembaban relatif', '%', humidity?.start, humidity?.startCorrection, humidity?.correctedStart, humidity?.end, humidity?.endCorrection, humidity?.correctedEnd, humidity?.mean, humidity?.u95],
  ];
  return `<table class="grid small"><thead><tr><th rowspan="2">Parameter</th><th rowspan="2">Unit</th><th colspan="3">Awal</th><th colspan="3">Akhir</th><th rowspan="2">Rata-rata</th><th rowspan="2">U95</th></tr><tr><th>Terukur</th><th>Koreksi</th><th>Terkoreksi</th><th>Terukur</th><th>Koreksi</th><th>Terkoreksi</th></tr></thead><tbody>${rows.map(([label, unit, start, startCorrection, correctedStart, end, endCorrection, correctedEnd, mean, u95]) => `<tr><td>${html(label)}</td><td>${html(unit)}</td><td>${fixed(start as number | null)}</td><td>${fixed(startCorrection as number | null)}</td><td>${fixed(correctedStart as number | null)}</td><td>${fixed(end as number | null)}</td><td>${fixed(endCorrection as number | null)}</td><td>${fixed(correctedEnd as number | null)}</td><td>${fixed(mean as number | null)}</td><td>${fixed(u95 as number | null)}</td></tr>`).join('')}${mainsVoltage ? `<tr><td>Tegangan jala-jala</td><td>V</td><td colspan="8">${html(mainsVoltage)}</td></tr>` : ''}</tbody></table><p class="muted">Thermohygrometer acuan: ${html(result.environment.reference?.serial)}.</p>`;
}

function inspectionTable(result: CalculationResult) {
  return `<table class="grid checks"><thead><tr><th>No.</th><th>Bagian alat</th><th>Fisik</th><th>Fungsi</th><th>Keterangan</th></tr></thead><tbody>${result.inspections.map((item, index) => `<tr><td>${index + 1}</td><td>${html(item.label)}</td><td>${html(item.physical || '—')}</td><td>${html(item.function || '—')}</td><td>${html(item.note || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function safetyTable(result: CalculationResult) {
  if (!result.safety) return '';
  return `<table class="grid checks"><thead><tr><th>No.</th><th>Parameter keselamatan listrik</th><th>Terukur</th><th>Batas</th><th>Hasil</th></tr></thead><tbody>${result.safety.checks.map((item, index) => `<tr><td>${index + 1}</td><td>${html(item.label)}</td><td>${html(item.measured || '—')}</td><td>${html(item.limit)}</td><td class="result">${item.result === null ? '—' : item.result ? 'LULUS' : 'TIDAK LULUS'}</td></tr>`).join('')}</tbody></table>`;
}

function fetalSafetyTable(record: CalibrationRecord, result: CalculationResult) {
  const inspectionsComplete = result.inspections.every((item) => item.complete);
  const physicalPass = inspectionsComplete && result.inspections.every((item) => item.physical === 'Baik');
  const physicalFail = inspectionsComplete && !physicalPass;
  const performanceComplete = result.performance.every((item) => item.result !== null);
  const performancePass = performanceComplete && result.performance.every((item) => item.result?.pass === true);
  const performanceFail = performanceComplete && !performancePass;
  const safety = record.data.safety;
  const rows: [string, string, string, string][] = [
    ['1.', 'Inspeksi Visual', physicalPass ? 'Baik' : physicalFail ? 'Tidak baik' : '—', physicalPass ? 'Ya' : physicalFail ? 'Tidak' : '—'],
    ['2.', 'Resistansi Pembumian Protektif', safety.earthResistance ? `${safety.earthResistance} Ω` : '—', safety.earthMeets || '—'],
    ['3.', 'Arus bocor Peralatan', safety.equipmentLeakage ? `${safety.equipmentLeakage} mA` : '—', safety.equipmentLeakageMeets || '—'],
    ['4.', 'Arus bocor bagian yang diaplikasikan', safety.appliedLeakage ? `${safety.appliedLeakage} mA` : '—', safety.appliedLeakageMeets || '—'],
    ['5.', 'Resistansi Isolasi', safety.insulationResistance ? `${safety.insulationResistance} MΩ` : '—', safety.insulationMeets || '—'],
    ['6.', 'Uji Fungsi · Heart Rate (BPM)', performancePass ? 'Lulus' : performanceFail ? 'Tidak lulus' : '—', performancePass ? 'Ya' : performanceFail ? 'Tidak' : '—'],
  ];
  return `<table class="grid checks"><thead><tr><th>No.</th><th>Parameter</th><th>Terukur</th><th>Memenuhi · Ya/Tidak</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row[0]}</td><td>${html(row[1])}</td><td>${html(row[2])}</td><td class="result">${html(row[3])}</td></tr>`).join('')}</tbody></table>`;
}

function performanceTable(rows: PerformanceResultRow[], title: string) {
  const count = Math.max(...rows.map((item) => item.readings.length));
  const readingHeaders = Array.from({ length: count }, (_, index) => `<th>${index + 1}</th>`).join('');
  const body = rows.map((item) => {
    const calculated = item.result;
    const tolerance = item.formula === 'fetalHeartRate' ? '±5 BPM' : `±${item.formula === 'flowmeter' ? '20' : item.tolerancePercent}%`;
    return `<tr><td>${html(item.setting)} ${html(item.unit)}</td>${Array.from({ length: count }, (_, index) => `<td>${html(item.readings[index])}</td>`).join('')}<td>${fixed(calculated?.mean)}</td><td>${fixed(calculated?.correction)}</td><td>${fixed(calculated?.u95)}</td><td>${html(tolerance)}</td><td>${fixed(calculated?.testValue)}</td><td>${calculated ? calculated.pass ? 'LULUS' : 'TIDAK LULUS' : '—'}</td></tr>`;
  }).join('');
  return `<h3>${html(title)}</h3><table class="grid performance"><thead><tr><th rowspan="2">Setting</th><th colspan="${count}">Bacaan terukur</th><th rowspan="2">Rata-rata</th><th rowspan="2">Koreksi</th><th rowspan="2">U95</th><th rowspan="2">Toleransi</th><th rowspan="2">Nilai uji</th><th rowspan="2">Hasil</th></tr><tr>${readingHeaders}</tr></thead><tbody>${body}</tbody></table>`;
}

function environmentalAndAdministrative(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, code: string) {
  const fetalDoppler = getInstrumentTemplateId(instrument) === 'fetal-doppler';
  const safety = fetalDoppler ? section('D', 'Pengujian Keselamatan Listrik', fetalSafetyTable(record, result)) : result.safety ? section('E', 'Pengujian keselamatan listrik', safetyTable(result)) : '';
  const physicalLetter = fetalDoppler ? 'E' : 'D';
  return `${header(instrument, record, 'LEMBAR KERJA KALIBRASI DAN PENGUJIAN', code)}${section('A', 'Data administrasi', identityTable(record, instrument))}${section('B', 'Standar dan peralatan yang digunakan', standardsTable(record, instrument))}${section('C', 'Pengukuran kondisi lingkungan', environmentTable(result, fetalDoppler ? record.data.safety.voltage : ''))}${safety}${section(physicalLetter, 'Pemeriksaan fisik dan fungsi alat', inspectionTable(result))}`;
}

function reportFooter(record: CalibrationRecord, result: CalculationResult) {
  return `<div class="summary">Nilai: ${fixed(result.score, 0)} / 100 · ${html(result.status)}</div><div class="footer"><span>Metode kerja: ${html(record.data.identity.method)}</span><span>Tanggal: ${date(record.data.identity.testDate)}</span></div>`;
}

function performanceReport(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, code: string, performanceTitle: string) {
  const opening = environmentalAndAdministrative(record, instrument, result, code);
  const performanceLetter = getInstrumentTemplateId(instrument) === 'fetal-doppler' ? 'F' : result.safety ? 'F' : 'E';
  return `<!doctype html><html><head><meta charset="utf-8">${reportStyles()}</head><body><section class="page">${opening}<div class="page-label">Halaman 1</div></section><section class="page">${header(instrument, record, 'LEMBAR HASIL PENGUKURAN KINERJA', code)}${section(performanceLetter, performanceTitle, performanceTable(result.performance, performanceTitle))}${reportFooter(record, result)}<div class="page-label">Halaman 2</div></section></body></html>`;
}

function technicalNotes(record: CalibrationRecord, instrument: Instrument) {
  const weighing = Boolean(instrument.weighingScale);
  const traceability = weighing ? 'LK-081-IDN' : 'LK-032-IDN';
  const workMethod = weighing ? 'MKC-MK-II-59-103-2024' : 'MKC-MK-II-59-090-2024';
  const methodNumber = weighing ? 'MK 103-2024' : 'MK 090-2024';
  const method = record.data.identity.method.trim() || workMethod;
  return {
    notes: [
      'Data hasil kalibrasi yang disajikan tertelusur ke Sistem Satuan Internasional (SI) melalui ' + traceability + '.',
      'Hasil ketidakpastian pengukuran mempunyai tingkat kepercayaan 95% dengan faktor cakupan (k) = 2.',
      'Alat ini dikalibrasi menggunakan metode kerja ' + method + ', yang mengacu pada Keputusan Direktorat Jenderal Pelayanan Kesehatan Nomor HK.02.02/D/43649/2024.',
    ],
    conclusions: [
      'Mengikuti Peraturan Kementerian Kesehatan No. 54 tahun 2015 tentang Pengujian dan Kalibrasi Alat Kesehatan.',
      'Berdasarkan metode kerja pengujian dan/atau kalibrasi alat kesehatan pada Keputusan Direktorat Jenderal Pelayanan Kesehatan Nomor HK.02.02/D/43649/2024 (' + methodNumber + ').',
      'Hasil kalibrasi di atas hanya berlaku untuk UUT dengan nomor seri yang tercantum.',
    ],
  };
}

function notesSection(record: CalibrationRecord, instrument: Instrument) {
  const notes = technicalNotes(record, instrument).notes;
  const body = '<ol>' + notes.map((note) => '<li>' + html(note) + '</li>').join('') + '</ol>';
  return instrument.weighingScale
    ? '<div class="section"><div class="section-title">Keterangan</div>' + body + '</div>'
    : section('G', 'Keterangan', body);
}

function technicalConclusion(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const conclusions = technicalNotes(record, instrument).conclusions;
  const body = '<p><strong>Alat dinyatakan: ' + html(result.status) + '</strong></p><ol>'
    + conclusions.map((note) => '<li>' + html(note) + '</li>').join('')
    + '</ol>' + reportFooter(record, result);
  return header(instrument, record, 'Kesimpulan Telaah Teknis Pengujian')
    + section('H', 'Kesimpulan Telaah Teknis Pengujian', body)
    + '<div class="signature"><div>Petugas pelaksana<br><br><br>________________________<br>' + html(record.data.identity.technician)
    + '</div><div>Pejabat berwenang<br><br><br>________________________</div></div>'
    + '<p class="muted">Dilarang memperbanyak dan/atau mempublikasikan sebagian isi laporan ini tanpa izin tertulis dari PT Megah Kalibramed.</p>'
    + '<p class="muted">It is prohibited to reproduce or publish any part of this report without written permission from PT Megah Kalibramed.</p>';
}

function weighingReport(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const weighing = result.weighing;
  if (!weighing) return performanceReport(record, instrument, result, '', 'Pengujian kinerja');
  const unit = capacityUnit(instrument);
  // Excel reports correction as reference mass minus indication.
  const rows = weighing.points.map((point) => '<tr><td>' + point.loadKg + '</td><td>' + fixed(point.indication, 4)
    + '</td><td>' + fixed(point.correction === null ? null : -point.correction, 5)
    + '</td><td>' + fixed(point.uncertaintyU95Kg, 5) + '</td></tr>').join('');
  const opening = workbookOpening(record, instrument, result);
  const repeatability = '<h3>1. Daya Ulang Pembacaan</h3><table class="grid"><thead><tr><th>Beban</th><th>Standar Deviasi (' + unit
    + ')</th></tr></thead><tbody><tr><td>' + instrument.weighingScale?.repeatabilityLoadKg + ' ' + unit + '</td><td>'
    + fixed(weighing.reportStandardDeviation, 6) + '</td></tr></tbody></table>';
  const deviation = '<h3>2. Penyimpangan Dari Nilai Nominal</h3><table class="grid performance"><thead><tr><th>Beban (' + unit
    + ')</th><th>Pembacaan (' + unit + ')</th><th>Koreksi (' + unit + ')</th><th>Ketidakpastian U95 (' + unit
    + ')</th></tr></thead><tbody>' + rows + '</tbody></table>';
  const lop = section('G', 'Limit of Performance (F)', '<table class="grid"><tbody><tr><td>F = Koreksi maksimum + U95 maksimum</td><td>'
    + fixed(weighing.lop, 6) + ' ' + unit + '</td></tr><tr><td>Batas 10 × resolusi</td><td>' + fixed(weighing.limit, 6) + ' '
    + unit + '</td></tr><tr><td>Hasil</td><td>' + (weighing.pass === null ? 'BELUM LENGKAP' : weighing.pass ? 'LULUS' : 'TIDAK LULUS')
    + '</td></tr></tbody></table>');
  const secondPage = section('F', 'Hasil Pengukuran Kinerja Alat', repeatability + deviation) + lop + notesSection(record, instrument);
  return '<!doctype html><html><head><meta charset="utf-8">' + reportStyles() + '</head><body><section class="page">' + opening
    + '<div class="page-label">Halaman 1 dari 3</div></section><section class="page">' + header(instrument, record, 'Laporan Hasil Pengujian / Kalibrasi')
    + secondPage + '<div class="page-label">Halaman 2 dari 3</div></section><section class="page">' + technicalConclusion(record, instrument, result)
    + '<div class="page-label">Halaman 3 dari 3</div></section></body></html>';
}

function sphygmomanometerReport(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const sphyg = result.sphygmomanometer;
  if (!sphyg) return performanceReport(record, instrument, result, '', 'Pengujian tekanan');
  const outcome = (pass: boolean | null) => pass === null ? 'MENUNGGU' : pass ? 'LULUS' : 'TIDAK LULUS';
  const rows = sphyg.pressureReadings.map((point) => '<tr><td>' + point.setting + '</td><td>' + fixed(point.up.mean)
    + '</td><td>' + fixed(point.down.mean) + '</td><td>' + fixed(point.up.correction) + '</td><td>' + fixed(point.down.correction)
    + '</td><td>' + fixed(point.up.uncertaintyU95) + '</td><td>' + fixed(point.down.uncertaintyU95) + '</td></tr>').join('');
  const opening = workbookOpening(record, instrument, result);
  const leakage = '<h3>1. Uji Kebocoran</h3><table class="grid"><thead><tr><th>Setting</th><th>Hasil Pengukuran</th><th>Ambang batas / 1 menit</th><th>Hasil</th></tr></thead><tbody><tr><td>250 mmHg · 1 menit</td><td>'
    + fixed(sphyg.leakageDrop.value) + ' mmHg</td><td>≤ 15 mmHg</td><td>' + outcome(sphyg.leakageDrop.pass) + '</td></tr></tbody></table>';
  const deflation = '<h3>2. Laju Buang Cepat</h3><table class="grid"><thead><tr><th>Hasil ukur</th><th>Batas akhir</th><th>Hasil</th></tr></thead><tbody><tr><td>'
    + fixed(sphyg.rapidDeflationSeconds.value) + ' detik</td><td>≤ 10 detik</td><td>' + outcome(sphyg.rapidDeflationSeconds.pass) + '</td></tr></tbody></table>';
  const accuracy = '<h3>3. Akurasi Tekanan</h3><table class="grid performance"><thead><tr><th rowspan="2">Tekanan (mmHg)</th><th rowspan="2">Setting Alat</th><th colspan="2">Pembacaan Standar</th><th colspan="2">Koreksi</th><th colspan="2">Ketidakpastian</th></tr><tr><th>Naik</th><th>Turun</th><th>Naik</th><th>Turun</th><th>Naik</th><th>Turun</th></tr></thead><tbody>'
    + rows + '</tbody></table>';
  const secondPage = section('F', 'Hasil Pengukuran Kinerja Alat', leakage + deflation + accuracy) + notesSection(record, instrument);
  return '<!doctype html><html><head><meta charset="utf-8">' + reportStyles() + '</head><body><section class="page">' + opening
    + '<div class="page-label">Halaman 1 dari 3</div></section><section class="page">' + header(instrument, record, 'Laporan Hasil Pengujian / Kalibrasi')
    + secondPage + '<div class="page-label">Halaman 2 dari 3</div></section><section class="page">' + technicalConclusion(record, instrument, result)
    + '<div class="page-label">Halaman 3 dari 3</div></section></body></html>';
}

function pumpReport(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const suction = Boolean(instrument.suctionPump);
  const safety = result.safety ? section(suction ? 'E' : 'D', 'Pengujian keselamatan listrik', safetyTable(result)) : '';
  const physical = section(suction ? 'D' : 'E', 'Pemeriksaan fisik dan fungsi alat', inspectionTable(result));
  const opening = `${header(instrument, record, 'LEMBAR KERJA KALIBRASI DAN PENGUJIAN')}${section('A', 'Data administrasi', identityTable(record, instrument))}${section('B', 'Standar dan peralatan yang digunakan', standardsTable(record, instrument))}${section('C', 'Pengukuran kondisi lingkungan', environmentTable(result))}${suction ? `${physical}${safety}` : `${safety}${physical}`}`;
  let tests = '';
  if (suction && result.suctionPump) {
    const legacy = record.data.suctionPump?.pressureReadings.some((point) => point.up.length === 3) ?? false;
    const readingCount = Math.max(...result.suctionPump.pressureReadings.flatMap((point) => [point.up?.readings.length ?? 0, point.down?.readings.length ?? 0]));
    const pressureLimit = legacy ? '≥ 300 mmHg' : `${instrument.suctionPump?.minimumVacuumMmHg}–${instrument.suctionPump?.maximumVacuumMmHg} mmHg`;
    const rows = result.suctionPump.pressureReadings.flatMap((point) => (['up', 'down'] as const).map((direction) => {
      const item = point[direction];
      return `<tr><td>${Math.abs(point.setting)}</td><td>${direction === 'up' ? 'Naik' : 'Turun'}</td><td>${item ? item.readings.map((value) => fixed(value)).join(' · ') : '—'}</td><td>${fixed(item?.mean)}</td><td>${fixed(item?.correction)}</td><td>${fixed(item?.correctedMean)}</td><td>${fixed(item?.error)}</td><td>${fixed(item?.uncertaintyU95)}</td><td>10%</td><td>${item ? item.pass ? 'LULUS' : 'TIDAK LULUS' : '—'}</td></tr>`;
    })).join('');
    tests = `${section('F', 'Pengujian kinerja · tekanan vakum', `<table class="grid performance"><thead><tr><th>Setting mmHg</th><th>Arah</th><th>${readingCount} bacaan DPM</th><th>Rata-rata</th><th>Koreksi drift</th><th>Terkoreksi</th><th>Galat</th><th>U95</th><th>Toleransi</th><th>Hasil</th></tr></thead><tbody>${rows}</tbody></table>`)}${section('G', 'Daya hisap maksimum dan waktu', `<table class="grid"><thead><tr><th>Vakum terbaca · magnitudo</th><th>Batas tekanan</th><th>Hasil tekanan</th><th>Waktu terukur</th><th>Batas waktu</th><th>Hasil waktu</th></tr></thead><tbody><tr><td>${fixed(result.suctionPump.maximumVacuumReading)} mmHg</td><td>${pressureLimit}</td><td>${result.suctionPump.maximumVacuumReadingPass === null ? '—' : result.suctionPump.maximumVacuumReadingPass ? 'LULUS' : 'TIDAK LULUS'}</td><td>${fixed(result.suctionPump.maximumVacuumSeconds)} detik</td><td>≤ 10 detik</td><td>${result.suctionPump.maximumVacuumPass === null ? '—' : result.suctionPump.maximumVacuumPass ? 'LULUS' : 'TIDAK LULUS'}</td></tr></tbody></table>`)}`;
  } else {
    const count = Math.max(...result.performance.map((row) => row.readings.length), 0);
    const headers = Array.from({ length: count }, (_, index) => `<th>${index + 1}</th>`).join('');
    const rows = result.performance.map((row) => `<tr><td>${html(row.setting)} ${html(row.unit)}</td>${Array.from({ length: count }, (_, index) => `<td>${html(row.readings[index])}</td>`).join('')}<td>${fixed(row.result?.mean)}</td><td>${fixed(row.result?.correction)}</td><td>${fixed(row.result?.correctedMean)}</td><td>${fixed(row.result?.error)}</td><td>${fixed(row.result?.u95)}</td><td>10%</td><td>${row.result ? row.result.pass ? 'LULUS' : 'TIDAK LULUS' : '—'}</td></tr>`).join('');
    const flow = `<h3>1. Laju aliran · ${html(record.data.infusionPump?.channel)}</h3><table class="grid performance"><thead><tr><th rowspan="2">Setting</th><th colspan="${count}">Bacaan mL/h</th><th rowspan="2">Rata-rata</th><th rowspan="2">Koreksi analyzer</th><th rowspan="2">Terkoreksi</th><th rowspan="2">Galat</th><th rowspan="2">U95</th><th rowspan="2">Toleransi</th><th rowspan="2">Hasil</th></tr><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
    const occlusion = result.pumpOcclusion
      ? `<h3>2. Uji kemampatan / occlusion</h3><table class="grid"><thead><tr><th>Setting</th><th>Enam bacaan psi</th><th>Rata-rata mentah</th><th>Koreksi analyzer</th><th>Rata-rata terkoreksi</th><th>U95</th><th>Batas</th><th>Hasil</th></tr></thead><tbody><tr><td>100 mL/h</td><td>${result.pumpOcclusion.readings.map((value) => fixed(value)).join(' · ')}</td><td>${fixed(result.pumpOcclusion.mean)}</td><td>${fixed(result.pumpOcclusion.correction)}</td><td>${fixed(result.pumpOcclusion.correctedMean)}</td><td>${fixed(result.pumpOcclusion.uncertaintyU95)}</td><td>≤ ${result.pumpOcclusion.limit} psi</td><td>${result.pumpOcclusion.pass ? 'LULUS' : 'TIDAK LULUS'}</td></tr></tbody></table>`
      : '<p>Data uji occlusion belum lengkap.</p>';
    tests = section('F', 'Pengujian kinerja alat', flow + occlusion);
  }
  const conclusion = `${header(instrument, record, 'KESIMPULAN PENGUJIAN')}${section('H', 'Kesimpulan', `<p><strong>Alat dinyatakan: ${html(result.status)}</strong></p><p>Nilai: ${fixed(result.score, 0)} / 100</p><p>Metode kerja: ${html(record.data.identity.method)}</p><p>Hasil berlaku untuk alat dengan nomor seri ${html(record.data.identity.serial)}.</p><p>Tanggal pelaksanaan: ${date(record.data.identity.testDate)}</p>`)}<div class="signature"><div>Petugas pelaksana<br><br><br>________________________<br>${html(record.data.identity.technician)}</div><div>Pejabat berwenang<br><br><br>________________________</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8">${reportStyles()}</head><body><section class="page">${opening}<div class="page-label">Halaman 1 dari 3</div></section><section class="page">${header(instrument, record, 'LAPORAN HASIL PENGUJIAN')}${tests}${reportFooter(record, result)}<div class="page-label">Halaman 2 dari 3</div></section><section class="page">${conclusion}<div class="page-label">Halaman 3 dari 3</div></section></body></html>`;
}

function workbookCertificate(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const identity = record.data.identity;
  const capacity = identity.capacity ? `${identity.capacity} ${capacityUnit(instrument)}` : '—';
  const accuracy = accuracyValue(identity.accuracy) ? `${accuracyValue(identity.accuracy)} ${capacityUnit(instrument)}` : '—';
  const fields = (rows: [string, string, string][]) => rows.map(([label, translation, value]) => `<div class="field"><div class="label">${html(label)}<i>${html(translation)}</i></div><div>:</div><div>${html(value)}</div></div>`).join('');
  const equipment = fields([
    ['Nama Alat', 'Name of Equipment', instrument.name], ['Merk', 'Manufacturer', identity.brand],
    ['Tipe / Model', 'Type/Model', identity.model], ['No. Seri', 'Serial Number', identity.serial],
    ['Kapasitas', 'Capacity', capacity], ['Tingkat Ketelitian', 'Resolution', accuracy],
  ]);
  const owner = fields([
    ['Nama Pemilik', 'Designation', identity.customer],
    ['Alamat', 'Address', [identity.address, identity.city].filter(Boolean).join(', ')],
    ['Tanggal Penerimaan', 'Receipt Date', date(identity.receivedDate)],
    ['Tanggal Pelaksanaan', 'Testing Date', date(identity.testDate)],
    ['Petugas Pelaksana', 'Executive Officer', identity.technician],
    ['Metode Kalibrasi', 'Calibration Method', identity.method],
  ]);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:9pt Arial,sans-serif;color:#111;margin:0}.top{display:grid;grid-template-columns:58px 1fr;align-items:center;border-bottom:2px solid #253942;padding-bottom:7px}.logo{width:46px;height:38px;object-fit:contain}.title{text-align:center;font-size:15pt;font-weight:bold;margin:0}.sub{text-align:center;font-size:9pt;font-style:italic;margin:3px 0 7px}.certificate-number{text-align:center;font-weight:bold;margin:8px 0}.english{font-size:8pt;font-style:italic;font-weight:normal}.numbers{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:8px 0 12px 50%;font-weight:bold}.section{padding:4px 6px;margin-top:8px;background:#eef2f3;border:1px solid #67777d;font-weight:bold}.section i,.label i{display:block;font-size:7pt;font-weight:normal}.fields{border:1px solid #67777d;border-top:0;padding:4px 7px}.field{display:grid;grid-template-columns:31% 14px 1fr;align-items:center;min-height:24px;border-bottom:1px solid #d1d8da;padding:2px 0}.field:last-child{border-bottom:0}.label{font-weight:normal}.result{border:1px solid #67777d;margin-top:10px;padding:6px;text-align:center;font-weight:bold}.result i,.result strong{display:block}.bottom{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:end;margin-top:14px;font-size:8pt}.validity{line-height:1.5}.issue{text-align:center;line-height:1.4}.signature{height:42px}.manager{font-weight:bold;margin-top:4px}.page-count{text-align:right;margin-top:8px;font-size:8pt}
  </style></head><body><header class="top"><img class="logo" src="${mkcLogo}"><div><h1 class="title">SERTIFIKAT KALIBRASI</h1><div class="sub">Calibration Certificate</div></div></header><div class="certificate-number">No. Sertifikat: ${html(identity.documentNumber)}<div class="english">Certificate Number</div></div><div class="numbers"><div>No. Order: ${html(identity.orderNumber)}</div><div>No. Label: ${html(identity.labelNumber)}</div></div><div class="section">Identitas Alat <i>Instrument Detail</i></div><div class="fields">${equipment}</div><div class="section">Identitas Pemilik <i>Owner Identity</i></div><div class="fields">${owner}</div><div class="result"><span>Hasil Pengujian</span><i class="english">Result of Testing</i><strong>${html(result.status)}</strong></div><div class="bottom"><div class="validity">Sertifikat ini terdiri <b>1 dari 3 halaman</b>.<br>Sertifikat berlaku 1 (satu) tahun dari pelaksanaan kalibrasi/pengujian.<br><i>This certificate is valid for one year from the date of testing.</i><br>Berlaku sampai: ${validityDate(identity.testDate)}</div><div class="issue">Diterbitkan tanggal, ${date(identity.issueDate)}<br><i>Date of issue</i><br><br>Manager Teknik<br><i>Technical Manager</i><div class="signature"></div><div class="manager">A. Andrian Wicaksono, S. T</div></div></div><div class="page-count">1 dari 3 halaman · 1 of 3 pages</div></body></html>`;
}

function certificate(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  if (['adult-scale-digital', 'adult-scale-mechanical', 'sphygmomanometer-analog', 'sphygmomanometer-digital', 'infusion-pump', 'syringe-pump', 'suction-pump'].includes(getInstrumentTemplateId(instrument))) {
    return workbookCertificate(record, instrument, result);
  }
  const identity = record.data.identity;
  const capacity = identity.capacity ? `${identity.capacity} ${capacityUnit(instrument)}` : '—';
  const accuracy = accuracyValue(identity.accuracy) ? `${accuracyValue(identity.accuracy)} ${capacityUnit(instrument)}` : '—';
  const details: [string, unknown][] = [
    ['Nama alat', instrument.name], ['Merek', identity.brand], ['Tipe / model', identity.model], ['Nomor seri', identity.serial],
    ['Kapasitas', capacity], ['Tingkat ketelitian', accuracy], ['Nama pemilik', identity.customer], ['Alamat', [identity.address, identity.city].filter(Boolean).join(', ')],
    ['Tanggal penerimaan', date(identity.receivedDate)], ['Tanggal pelaksanaan', date(identity.testDate)], ['Penanggung jawab pengujian', identity.technician], ['Metode kalibrasi', identity.method],
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:10pt Arial,sans-serif;color:#111;margin:0}.title{text-align:center;font-size:16pt;font-weight:bold;margin:0}.sub{text-align:center;font-size:9pt;font-style:italic;margin:4px 0 9px}.rule{border:0;border-top:2px solid #111;margin:0 0 12px}.cert-number{text-align:center;font-weight:bold;font-size:10pt;margin:0 0 13px}.numbers{width:46%;margin:0 0 13px auto;border-collapse:collapse;font-size:9pt}.numbers td{padding:4px 6px}.section{font-weight:bold;margin:9px 0 0;text-decoration:underline}.details{border-collapse:collapse;width:100%;font-size:9pt}.details td{padding:4px;vertical-align:top}.details td:first-child{width:29%}.details td:nth-child(2){width:15px}.owner{margin-top:8px}.outcome{text-align:center;font-size:11pt;font-weight:bold;margin:12px 0 17px}.bottom{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;font-size:9pt;margin-top:4px}.validity{max-width:48%;font-style:italic}.issue{text-align:center;min-width:48%}.signature{height:58px}.page-count{text-align:right;margin-top:12px;font-size:8pt}
  </style></head><body><h1 class="title">SERTIFIKAT KALIBRASI</h1><div class="sub">Calibration Certificate</div><hr class="rule"><p class="cert-number">No. Sertifikat: ${html(identity.documentNumber)}<br><span class="sub">Certificate Number</span></p><table class="numbers"><tr><td>No. Order</td><td>:</td><td>${html(identity.orderNumber)}</td></tr><tr><td>No. Label</td><td>:</td><td>${html(identity.labelNumber)}</td></tr></table><h2 class="section">Identitas Alat</h2><div class="sub">Instrument Detail</div><table class="details">${details.slice(0, 6).map(([label, value]) => `<tr><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</table><h2 class="section owner">Identitas Pemilik</h2><div class="sub">Owner Identity</div><table class="details">${details.slice(6, 8).map(([label, value]) => `<tr><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</table><table class="details owner">${details.slice(8).map(([label, value]) => `<tr><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</table><p class="outcome">Hasil Pengujian: ${html(result.status)}</p><div class="bottom"><div class="validity">Sertifikat ini terdiri dari 1 halaman.<br>Sertifikat berlaku 1 (satu) tahun dari tanggal pelaksanaan.<br>Berlaku sampai: ${validityDate(identity.testDate)}</div><div class="issue">Diterbitkan tanggal, ${date(identity.issueDate)}<br><i>Date of issue</i><br><br>Manager Teknik<br><i>Technical Manager</i><div class="signature"></div>________________________</div></div><div class="page-count">1 dari 1 halaman · 1 of 1 pages</div></body></html>`;
}

function report(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  switch (getInstrumentTemplateId(instrument)) {
    case 'fetal-doppler': return performanceReport(record, instrument, result, '045-18', 'Pengujian kinerja · heart rate');
    case 'flowmeter': return performanceReport(record, instrument, result, '006-18', 'Pengujian kinerja · laju aliran gas oksigen');
    case 'adult-scale-digital':
    case 'adult-scale-mechanical': return weighingReport(record, instrument, result);
    case 'sphygmomanometer-analog':
    case 'sphygmomanometer-digital': return sphygmomanometerReport(record, instrument, result);
    case 'infusion-pump':
    case 'syringe-pump':
    case 'suction-pump': return pumpReport(record, instrument, result);
    default: return performanceReport(record, instrument, result, '', 'Pengujian kinerja');
  }
}

export function buildInstrumentDocumentHtml(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, kind: DocumentKind) {
  return kind === 'certificate' ? certificate(record, instrument, result) : report(record, instrument, result);
}
