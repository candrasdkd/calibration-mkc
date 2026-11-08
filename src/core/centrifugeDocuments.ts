import type { CalculationResult, CalibrationRecord, DocumentKind, Instrument, PerformanceResultRow } from './types';
import { mkcLogo } from './mkcLogo';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const html = (value: unknown) => String(value ?? '—').replace(/[&<>"']/g, (character) => entities[character] ?? character);
const number = (value: number | null | undefined, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function date(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${Number(match[3])} ${months[Number(match[2]) - 1]} ${match[1]}` : html(value);
}

function validityDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  const year = Number(match[1]) + 1;
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const expiry = new Date(year, month, day);
  if (expiry.getMonth() !== month) expiry.setDate(0);
  return `${expiry.getDate()} ${months[expiry.getMonth()]} ${expiry.getFullYear()}`;
}

function identityLine(label: string, value: unknown, translation = '') {
  return `<tr><td class="label">${html(label)}${translation ? `<small>${html(translation)}</small>` : ''}</td><td class="colon">:</td><td>${html(value)}</td></tr>`;
}

function certificate(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const identity = record.data.identity;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:11pt Arial,sans-serif;color:#111;margin:0}.title{text-align:center;font-size:16pt;font-weight:bold;margin:0}.translation{text-align:center;font-style:italic;font-size:10pt;margin:3px 0 7px}.rule{border:0;border-top:2px solid #111;margin:0 0 12px}.cert-number{text-align:center;font-weight:bold;font-size:10pt;margin:0 0 18px}.number-box{width:45%;margin:0 0 16px auto;border:1px solid #777;border-collapse:collapse;font-size:9pt}.number-box td{padding:4px 6px}.section{font-weight:bold;margin:10px 0 0;text-decoration:underline}.section-translation{font-size:9pt;margin:0 0 8px}.details{border-collapse:collapse;width:100%;font-size:9pt}.details td{padding:3px 4px;vertical-align:top}.details .label{width:28%}.details .label small{display:block;font-style:italic;font-size:8pt}.details .colon{width:16px}.owner{margin-top:8px}.result{font-weight:bold;margin:6px 0 18px}.bottom{display:flex;justify-content:space-between;gap:20px;align-items:flex-end;font-size:9pt;margin-top:4px}.validity{font-style:italic;max-width:48%}.issue{text-align:center;min-width:48%}.signature{height:58px}.page-count{margin-top:13px;font-size:8pt;text-align:right;color:#444}
  </style></head><body>
    <h1 class="title">SERTIFIKAT KALIBRASI</h1><div class="translation">Calibration Certificate</div><hr class="rule">
    <p class="cert-number">No. Sertifikat : ${html(identity.documentNumber)}<br><span class="translation">Certificate Number</span></p>
    <table class="number-box"><tr><td>No. Order</td><td>:</td><td>${html(identity.orderNumber)}</td></tr><tr><td>No. Label</td><td>:</td><td>${html(identity.labelNumber)}</td></tr></table>
    <h2 class="section">Identitas Alat</h2><div class="section-translation">Instrument Detail</div>
    <table class="details">${identityLine('Nama Alat', instrument.name, 'Name of Equipment')}${identityLine('Merk', identity.brand, 'Manufacture')}${identityLine('Tipe / Model', identity.model, 'Type/Model')}${identityLine('No. Seri', identity.serial, 'Serial Number')}${identityLine('Kapasitas', identity.capacity ? `${identity.capacity} Rpm` : '—', 'Capacity')}${identityLine('Tingkat Ketelitian', identity.accuracy ? `${identity.accuracy} Rpm` : '—', 'Resolution')}</table>
    <h2 class="section owner">Identitas Pemilik</h2><div class="section-translation">Owner Identity</div>
    <table class="details">${identityLine('Nama Pemilik', identity.customer, 'Designation')}${identityLine('Alamat', identity.address, 'Address')}${identityLine('Kota / Kabupaten - Provinsi', identity.city)}</table>
    <table class="details owner">${identityLine('Tanggal Penerimaan', date(identity.receivedDate), 'Receipt Date')}${identityLine('Tanggal Pelaksanaan', date(identity.testDate), 'Testing Date')}${identityLine('Penanggung Jawab Pengujian', identity.technician, 'Testing Coordinator')}${identityLine('Metode Kalibrasi', identity.method, 'Calibration Method')}</table>
    <table class="details"><tr><td class="label">Hasil Pengujian<small>Result of Testing</small></td><td class="colon">:</td><td class="result">${html(result.status)}</td></tr></table>
    <div class="bottom"><div class="validity">Sertifikat ini terdiri dari 1 halaman.<br>* Sertifikat berlaku 1 (satu) tahun dari pelaksanaan kalibrasi/pengujian.<br>Berlaku sampai: ${validityDate(identity.testDate)}</div><div class="issue">Diterbitkan tanggal, ${date(identity.issueDate)}<br><i>Date of issue</i><br><br>Manager Teknik<br><i>Technical Manager</i><div class="signature"></div>________________________</div></div>
    <div class="page-count">1 dari 1 halaman · 1 of 1 pages</div>
  </body></html>`;
}

function standardsTable(record: CalibrationRecord, instrument: Instrument) {
  const selected = record.data.selectedDevices ?? instrument.standards.map(([name, brand, model, serial]) => ({ name, brand, model, serial }));
  return `<table class="grid"><thead><tr><th>No.</th><th>Nama Peralatan</th><th>Merk</th><th>Tipe</th><th>No. Seri</th></tr></thead><tbody>${selected.map((item, index) => `<tr><td>${index + 1}.</td><td>${html(item.name)}</td><td>${html(item.brand)}</td><td>${html(item.model)}</td><td>${html(item.serial)}</td></tr>`).join('')}</tbody></table>`;
}

function safetyResult(result: CalculationResult, label: string) {
  return result.safety?.checks.find((check) => check.label === label);
}

function safetyTable(result: CalculationResult) {
  const checks = [
    ['Inspeksi Visual', null, ''],
    ['Resistansi Pembumian Protektif', safetyResult(result, 'Resistansi pembumian protektif'), 'Ω'],
    ['Arus bocor Peralatan', safetyResult(result, 'Arus bocor peralatan'), 'mA'],
    ['Arus bocor bagian yang diaplikasikan', safetyResult(result, 'Arus bocor bagian diaplikasikan'), 'mA'],
    ['Resistansi Isolasi', safetyResult(result, 'Resistansi isolasi'), 'MΩ'],
    ['Uji Fungsi (Parameter yang diuji)', null, ''],
  ] as const;
  return `<table class="grid"><thead><tr><th>No.</th><th>Parameter</th><th>Terukur</th><th colspan="2">Memenuhi</th></tr><tr><th></th><th></th><th></th><th>Ya</th><th>Tidak</th></tr></thead><tbody>${checks.map(([label, check, unit], index) => `<tr><td>${index + 1}.</td><td>${html(label)}</td><td>${check ? `${html(check.measured)} ${unit}` : '—'}</td><td>${check?.result === true ? '✓' : ''}</td><td>${check?.result === false ? '✓' : ''}</td></tr>`).join('')}</tbody></table>`;
}

function inspectionTable(result: CalculationResult) {
  return `<table class="grid"><thead><tr><th>No.</th><th>Bagian Alat</th><th>Fisik</th><th>Fungsi</th><th>Keterangan</th></tr></thead><tbody>${result.inspections.map((item, index) => `<tr><td>${index + 1}.</td><td>${html(item.label)}</td><td>${html(item.physical)}</td><td>${html(item.function)}</td><td>${html(item.note || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function performanceTable(title: string, rows: PerformanceResultRow[], unit: string) {
  const count = Math.max(...rows.map((item) => item.readings.length));
  const header = Array.from({ length: count }, (_, index) => `<th>${index + 1}</th>`).join('');
  const body = rows.map((item) => {
    const short = item.id === 'low' ? 'L' : item.id === 'medium' ? 'M' : item.id === 'high' ? 'H' : item.label;
    const readings = Array.from({ length: count }, (_, index) => `<td>${html(item.readings[index])}</td>`).join('');
    const calculated = item.result;
    return `<tr><td>${html(short)} · ${html(item.setting)} ${html(unit)}</td>${readings}<td>${html(item.tolerancePercent)}%</td><td>${calculated ? calculated.pass ? 'LULUS' : 'TIDAK LULUS' : '—'}</td></tr>
      <tr class="calculation"><td colspan="${count + 3}">Rata-rata: ${number(calculated?.mean)} ${html(unit)} · Koreksi: ${number(calculated?.correction)} · U95: ${number(calculated?.u95)} · Nilai uji / batas: ${number(calculated?.testValue)} / ${number(calculated?.tolerance)}</td></tr>`;
  }).join('');
  return `<h3>${html(title)}</h3><table class="grid performance"><thead><tr><th rowspan="2">Setting</th><th colspan="${count}">Terbaca</th><th rowspan="2">Toleransi</th><th rowspan="2">Hasil</th></tr><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function worksheet(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const identity = record.data.identity;
  const environment = record.data.environment;
  const details = [
    ['Merk', identity.brand], ['Tipe/Model', identity.model], ['No. Seri', identity.serial],
    ['Kapasitas', identity.capacity ? `${identity.capacity} RPM` : '—'], ['Tingkat Ketelitian', identity.accuracy ? `${identity.accuracy} RPM` : '—'],
    ['Petugas Pelaksana', identity.technician], ['Tanggal Pelaksanaan', date(identity.testDate)],
    ['Ruang Pelaksanaan', identity.room], ['Nama Pelanggan', identity.customer],
    ['Alamat Pelanggan', identity.address], ['Kota/Kabupaten - Provinsi', identity.city],
  ];
  const voltage = safetyResult(result, 'Tegangan jala-jala')?.measured;
  const performanceRows = result.performance;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:letter;margin:0.42in}*{box-sizing:border-box}body{font:8pt Arial,sans-serif;color:#111;margin:0}.page{height:10.14in;position:relative;page-break-after:always;overflow:hidden}.page:last-child{page-break-after:auto}.header{display:grid;grid-template-columns:90px 1fr;border:1px solid #111;margin-bottom:10px}.logo{width:70px;height:54px;object-fit:contain;align-self:center;justify-self:center}.header-main{text-align:center}.header-main h1{font-size:13pt;margin:4px 0;border-bottom:1px solid #111;padding:4px}.header-main h2{font-size:12pt;margin:0;border-bottom:1px solid #111;padding:4px}.codes{display:grid;grid-template-columns:1fr 1fr}.codes div{border-right:1px solid #111;padding:4px;font-weight:bold}.codes div:last-child{border-right:0}.section-title{display:grid;grid-template-columns:32px 1fr;border:1px solid #111;border-bottom:0;margin-top:8px;font-size:8pt}.section-title span{border-right:1px solid #111;padding:4px;font-weight:bold}.section-title b{padding:4px}table{border-collapse:collapse;width:100%}.grid th,.grid td{border:1px solid #222;padding:3px 4px;vertical-align:middle}.grid th{text-align:center;font-weight:bold}.admin td:first-child{width:35%}.admin td:nth-child(2){width:16px;text-align:center}.admin td:last-child{height:17px}.standards td:first-child,.inspection td:first-child,.safety td:first-child{text-align:center;width:28px}.env td:nth-child(1){width:27%}.env td:nth-child(2){width:20%}.env td:nth-child(3){width:10%}.env td:nth-child(4){width:20%}.env td:nth-child(5){width:10%}.safety th{padding:2px}.safety td{height:18px}.inspection td{height:18px}.section-label{background:#f3f3f3;font-weight:bold}.page-footer{position:absolute;bottom:0;left:0;right:0;text-align:center;font-size:8pt}.performance-page h2{font-size:10pt;margin:4px 0}.performance-page h3{font-size:9pt;margin:7px 0 3px}.performance th,.performance td{text-align:center}.performance td:first-child{text-align:left}.performance .calculation td{font-size:7pt;text-align:left;background:#f6f6f6}.summary{text-align:right;font-weight:bold;margin:6px 0}
  </style></head><body>
    <section class="page">
      <div class="header"><img class="logo" src="${mkcLogo}"><div class="header-main"><h1>LAPORAN HASIL PENGUJIAN</h1><h2>Centrifuge</h2><div class="codes"><div>Kode Dokumen<br>MKC-FOR-QUA.04-010-</div><div>No. Label<br>${html(identity.labelNumber)}</div></div></div></div>
      <div class="section-title"><span>A.</span><b>Data Administrasi</b></div><table class="grid admin"><tbody>${details.map(([label, value]) => `<tr><td>${html(label)}</td><td>:</td><td>${html(value)}</td></tr>`).join('')}</tbody></table>
      <div class="section-title"><span>B.</span><b>Standar dan Peralatan yang digunakan</b></div><div class="standards">${standardsTable(record, instrument)}</div>
      <div class="section-title"><span>C.</span><b>Pengukuran Kondisi Lingkungan</b></div><table class="grid env"><thead><tr><th>No.</th><th>Parameter</th><th colspan="2">Awal</th><th colspan="2">Akhir</th></tr></thead><tbody>
        <tr><td>1.</td><td>Temperatur Ruangan</td><td>${html(environment.temperatureStart)}</td><td>°C</td><td>${html(environment.temperatureEnd)}</td><td>°C</td></tr>
        <tr><td>2.</td><td>Kelembaban Ruangan</td><td>${html(environment.humidityStart)}</td><td>%</td><td>${html(environment.humidityEnd)}</td><td>%</td></tr>
        <tr><td>3.</td><td>Tegangan Jala-jala</td><td colspan="3">${html(voltage)}</td><td>V</td></tr>
      </tbody></table>
      <div class="section-title"><span>D.</span><b>Pengujian Keselamatan Listrik</b></div><div class="safety">${safetyTable(result)}</div>
      <div class="section-title"><span>E.</span><b>Pemeriksaan Fungsi dan Fisik Alat</b></div><div class="inspection">${inspectionTable(result)}</div>
      <div class="section-title"><span>F.</span><b>Pengujian Kinerja</b></div>
      <div class="page-footer">Page 1 of 2</div>
    </section>
    <section class="page performance-page"><h2>F. Pengujian Kinerja · Centrifuge</h2>
      ${performanceTable('1. Kecepatan (RPM)', performanceRows.filter((item) => ['low', 'medium', 'high'].includes(item.id)), 'RPM')}
      ${performanceTable('2. Kecepatan 50%', performanceRows.filter((item) => item.id === 'half'), 'RPM')}
      ${performanceTable('3. Akurasi Waktu Putar', performanceRows.filter((item) => item.id === 'time'), 'detik')}
      <p class="summary">Jumlah Skor: ${number(result.score, 0)} / 100 · ${html(result.status)}</p>
      <div class="page-footer">Page 2 of 2</div>
    </section>
  </body></html>`;
}

export function buildCentrifugeDocumentHtml(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, kind: DocumentKind) {
  return kind === 'certificate' ? certificate(record, instrument, result) : worksheet(record, instrument, result);
}
