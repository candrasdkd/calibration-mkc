import type { CalculationResult, CalibrationRecord, DocumentKind, Instrument } from './types';

const entities: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (character) => entities[character] ?? character);

const fixed = (value: number | null | undefined, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
const row = (label: string, value: unknown) => `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value || '—')}</td></tr>`;

function performanceTable(result: CalculationResult) {
  const rows = result.performance.map(({ label, unit, result: item }) => `<tr>
    <td>${escapeHtml(label)} (${escapeHtml(unit)})</td><td>${fixed(item?.setting)}</td><td>${item ? fixed(item.mean) : '—'}</td>
    <td>${item ? fixed(item.correction) : '—'}</td><td>${item ? fixed(item.u95) : '—'}</td>
    <td>${item ? fixed(item.tolerance) : '—'}</td><td>${item ? (item.pass ? 'LULUS' : 'TIDAK LULUS') : '—'}</td>
  </tr>`).join('');
  return `<table><thead><tr><th>Pengujian</th><th>Setting</th><th>Rata-rata</th><th>Koreksi</th><th>U95</th><th>Toleransi</th><th>Hasil</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function weighingTable(result: CalculationResult) {
  const weighing = result.weighing;
  if (!weighing) return performanceTable(result);
  const loadRows = weighing.points.map((point) => `<tr>
    <td>${point.loadKg}</td><td>${escapeHtml(point.standardWeightSerials.join(' + '))}</td>
    <td>${fixed(point.zeroReading, 4)}</td><td>${fixed(point.indication, 4)}</td>
    <td>${fixed(point.referenceMassKg, 5)}</td><td>${fixed(point.correction, 5)}</td><td>${fixed(point.uncertaintyU95Kg, 5)}</td>
  </tr>`).join('');
  const repeatedRows = weighing.repeatabilityReadings.map((reading, index) => `<tr>
    <td>${index + 1}</td><td>${fixed(reading.zeroReading, 4)}</td><td>${fixed(reading.indication, 4)}</td><td>${fixed(reading.difference, 4)}</td>
  </tr>`).join('');
  const lop = weighing.lop === null ? '—' : `${fixed(weighing.lop, 5)} kg / ${fixed(weighing.limit, 2)} kg`;
  const outcome = weighing.pass === null ? 'BELUM LENGKAP' : weighing.pass ? 'LULUS' : 'TIDAK LULUS';
  return `<h3>Uji berulang</h3><table><thead><tr><th>No.</th><th>Zero z (kg)</th><th>Penunjukan m (kg)</th><th>r = m − z (kg)</th></tr></thead><tbody>${repeatedRows}</tbody></table><table><tbody>
    <tr><th>Rata-rata bacaan</th><td>${fixed(weighing.repeatabilityMean, 4)} kg</td></tr>
    <tr><th>STDEV dari 10 bacaan</th><td>${fixed(weighing.repeatabilityStandardDeviation, 6)} kg</td></tr>
    <tr><th>Nilai simpangan baku pada laporan Excel</th><td>${fixed(weighing.reportStandardDeviation, 6)} kg</td></tr>
    <tr><th>Koreksi absolut maksimum</th><td>${fixed(weighing.maxAbsoluteCorrection, 5)} kg</td></tr>
    <tr><th>U95 maksimum</th><td>${fixed(weighing.maxUncertaintyU95, 5)} kg</td></tr>
    <tr><th>LOP / batas 10 × resolusi</th><td>${lop}</td></tr>
    <tr><th>Hasil LOP</th><td>${outcome}</td></tr>
  </tbody></table><h3>Pengujian beban</h3><table><thead><tr><th>Beban nominal (kg)</th><th>Anak timbangan</th><th>Bacaan nol (kg)</th><th>Bacaan berbeban (kg)</th><th>Massa konvensional (kg)</th><th>Koreksi (kg)</th><th>U95 (kg)</th></tr></thead><tbody>${loadRows}</tbody></table>`;
}

function sphygmomanometerTable(result: CalculationResult) {
  const sphyg = result.sphygmomanometer;
  if (!sphyg) return '';
  const outcome = (pass: boolean | null) => pass === null ? 'BELUM LENGKAP' : pass ? 'LULUS' : 'TIDAK LULUS';
  const rows = sphyg.pressureReadings.flatMap((point) => (['up', 'down'] as const).map((direction) => {
    const item = point[direction];
    return `<tr><td>${point.setting} mmHg · ${direction === 'up' ? 'Naik' : 'Turun'}</td>
      <td>${escapeHtml(item.readings.map((value) => fixed(value)).join(' / '))}</td>
      <td>${escapeHtml(item.correctedReadings.map((value) => fixed(value)).join(' / '))}</td>
      <td>${fixed(item.mean)}</td><td>${fixed(item.correction)}</td><td>${fixed(item.uncertaintyU95)}</td>
      <td>${fixed(item.decisionValue)} / 4 mmHg</td><td>${outcome(item.pass)}</td></tr>`;
  })).join('');
  return `<table><tbody>
    <tr><th>Uji kebocoran · penurunan tekanan</th><td>${fixed(sphyg.leakageDrop.value)} mmHg / batas 15 mmHg · ${outcome(sphyg.leakageDrop.pass)}</td></tr>
    <tr><th>Deflasi cepat</th><td>${fixed(sphyg.rapidDeflationSeconds.value)} detik / batas 10 detik · ${outcome(sphyg.rapidDeflationSeconds.pass)}</td></tr>
  </tbody></table><table><thead><tr><th>Titik / arah</th><th>Bacaan DPM</th><th>Bacaan terkoreksi</th><th>Rata-rata</th><th>Koreksi C</th><th>U95</th><th>|C| + U95 / batas</th><th>Hasil</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function environmentTable(result: CalculationResult) {
  const temp = result.environment.temperature;
  const humidity = result.environment.humidity;
  return `<table><thead><tr><th>Parameter</th><th>Titik</th><th>Terukur</th><th>Koreksi</th><th>Terkoreksi</th></tr></thead><tbody>
    <tr><td>Suhu (°C)</td><td>Awal</td><td>${fixed(temp?.start)}</td><td>${fixed(temp?.startCorrection)}</td><td>${fixed(temp?.correctedStart)}</td></tr>
    <tr><td>Suhu (°C)</td><td>Akhir</td><td>${fixed(temp?.end)}</td><td>${fixed(temp?.endCorrection)}</td><td>${fixed(temp?.correctedEnd)}</td></tr>
    <tr><td>Kelembaban (%)</td><td>Awal</td><td>${fixed(humidity?.start)}</td><td>${fixed(humidity?.startCorrection)}</td><td>${fixed(humidity?.correctedStart)}</td></tr>
    <tr><td>Kelembaban (%)</td><td>Akhir</td><td>${fixed(humidity?.end)}</td><td>${fixed(humidity?.endCorrection)}</td><td>${fixed(humidity?.correctedEnd)}</td></tr>
  </tbody></table><table><thead><tr><th>Parameter</th><th>Rata-rata terkoreksi</th><th>U95</th></tr></thead><tbody>
    <tr><td>Suhu (°C)</td><td>${fixed(temp?.mean)}</td><td>${fixed(temp?.u95)}</td></tr><tr><td>Kelembaban (%)</td><td>${fixed(humidity?.mean)}</td><td>${fixed(humidity?.u95)}</td></tr>
  </tbody></table><p class="muted">Thermohygrometer acuan: ${escapeHtml(result.environment.reference?.serial)}. Koreksi dihitung dengan interpolasi linier dari tabel sertifikat.</p>`;
}

function inspectionTable(result: CalculationResult) {
  return `<table><thead><tr><th>Bagian</th><th>Fisik</th><th>Fungsi</th><th>Keterangan</th></tr></thead><tbody>${result.inspections.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.physical)}</td><td>${escapeHtml(item.function)}</td><td>${escapeHtml(item.note || '—')}</td></tr>`).join('')}</tbody></table>`;
}

function standardsTable(record: CalibrationRecord, instrument: Instrument) {
  const weights = record.data.weighing?.points.flatMap((point) => point.standardWeights) ?? [];
  const uniqueWeights = [...new Map(weights.map((weight) => [weight.serial, weight])).values()];
  const selectedStandards = record.data.selectedDevices === undefined
    ? instrument.standards.map(([name, brand, model, serial]) => ({ name, brand, model, serial }))
    : record.data.selectedDevices;
  const rows = [
    ...selectedStandards.map((device) => `<tr><td>${escapeHtml(device.name)}</td><td>${escapeHtml(device.brand)}</td><td>${escapeHtml(device.model)}</td><td>${escapeHtml(device.serial)}</td></tr>`),
    ...uniqueWeights.map((weight) => `<tr><td>${escapeHtml(`${weight.name} ${weight.nominalKg} kg`)}</td><td>${escapeHtml(weight.brand)}</td><td>${escapeHtml(weight.model)}</td><td>${escapeHtml(weight.serial)}</td></tr>`),
  ].join('');
  return `<table><thead><tr><th>Standar kalibrasi</th><th>Merek</th><th>Tipe</th><th>Nomor seri</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function safetyTable(result: CalculationResult) {
  if (!result.safety) return '';
  return `<h2>Keselamatan listrik</h2><table><thead><tr><th>Parameter</th><th>Terukur</th><th>Ambang</th><th>Hasil</th></tr></thead><tbody>${result.safety.checks.map((item) => `<tr><td>${escapeHtml(item.label)}</td><td>${escapeHtml(item.measured || '—')}</td><td>${escapeHtml(item.limit)}</td><td>${item.result === null ? '—' : item.result ? 'LULUS' : 'TIDAK LULUS'}</td></tr>`).join('')}</tbody></table>`;
}

function validityDate(date: string) {
  const match = String(date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  const value = new Date(Number(match[1]) + 1, Number(match[2]) - 1, Number(match[3]));
  return `${String(value.getDate()).padStart(2, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${value.getFullYear()}`;
}

export function buildDocumentHtml(record: CalibrationRecord, instrument: Instrument, result: CalculationResult, kind: DocumentKind): string {
  const { identity } = record.data;
  const certificate = kind === 'certificate';
  const title = certificate ? 'SERTIFIKAT PENGUJIAN / KALIBRASI' : 'LAPORAN HASIL PENGUJIAN / KALIBRASI';
  const identityRows = [
    row('Nama alat', instrument.name), row('Nomor dokumen', identity.documentNumber), row('Nomor label', identity.labelNumber),
    row('Merek', identity.brand), row('Tipe / model', identity.model), row('Nomor seri', identity.serial),
    row('Kapasitas', instrument.sphygmomanometer ? `${identity.capacity} mmHg` : identity.capacity),
    row(instrument.sphygmomanometer ? 'Kelas akurasi' : 'Tingkat ketelitian', identity.accuracy), row('Pelanggan', identity.customer),
    row('Alamat', [identity.address, identity.city].filter(Boolean).join(', ')), row('Petugas', identity.technician),
    row('Ruang pelaksanaan', identity.room), row('Tanggal penerimaan', identity.receivedDate), row('Tanggal pelaksanaan', identity.testDate), row('Tanggal terbit', identity.issueDate),
  ].join('');
  const resultBlock = `<h2>Pengukuran kondisi lingkungan</h2>${environmentTable(result)}
    <h2>Standar kalibrasi yang digunakan</h2>${standardsTable(record, instrument)}
    <h2>Pemeriksaan fisik dan fungsi</h2>${inspectionTable(result)}${safetyTable(result)}
    <h2>Pengujian kinerja</h2>${result.sphygmomanometer ? sphygmomanometerTable(result) : result.weighing ? weighingTable(result) : performanceTable(result)}
    <div class="outcome"><strong>Jumlah skor</strong><span>${result.score}/100</span><b>${escapeHtml(result.status)}</b></div>`;
  const certificateFields = certificate
    ? `<div class="certificate"><p>Dengan ini dinyatakan hasil pengujian/kalibrasi untuk alat di atas adalah:</p>
      <h2>${escapeHtml(result.status)}</h2><p>Metode: ${escapeHtml(identity.method || '—')}</p>
      <p>Tanggal pelaksanaan: ${escapeHtml(identity.testDate)}</p><p>Tanggal terbit: ${escapeHtml(identity.issueDate)}</p><p>Berlaku sampai: ${escapeHtml(validityDate(identity.testDate))}</p>
      <div class="signature"><div>Petugas pelaksana<br><br><br>${escapeHtml(identity.technician)}</div><div>Manajer teknis<br><br><br>________________________</div></div></div>`
    : `<h2>Metode</h2><p>${escapeHtml(identity.method || '—')}</p>${resultBlock}`;
  const body = certificate
    ? `<table class="identity">${identityRows}</table>${certificateFields}${resultBlock}`
    : `<table class="identity">${identityRows}</table>${certificateFields}`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    @page{size:A4;margin:16mm}body{font:12px Arial,sans-serif;color:#172435}h1{text-align:center;font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 8px;border-bottom:1px solid #bec8d2;padding-bottom:4px}p{margin:6px 0;line-height:1.45}.meta{text-align:center;color:#536476;margin-bottom:20px}.identity{margin-top:18px}.identity th{width:175px}table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #cbd3dc;padding:6px;text-align:left;vertical-align:top}th{background:#f0f3f6}.identity th{background:#fff}.muted{color:#5d6e7d;font-size:10px}.outcome{border:2px solid #1d8e6e;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;margin-top:18px}.outcome b{color:#176f56}.certificate{text-align:center;padding:12px 20px}.certificate h2{font-size:18px;color:#176f56;border:0}.signature{display:flex;justify-content:space-around;text-align:center;margin-top:36px;line-height:1.35}
    </style></head><body><h1>${title}</h1><div class="meta">${escapeHtml(instrument.name)} · ${escapeHtml(identity.documentNumber)}</div>${body}</body></html>`;
}
