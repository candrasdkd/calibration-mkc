import type { CalculationResult, CalibrationRecord, Instrument } from './types';

const display = (value: number | null | undefined, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
const verdict = (pass: boolean | null | undefined) => pass === null || pass === undefined ? 'MENUNGGU' : pass ? 'LULUS' : 'TIDAK LULUS';

export function buildCalibrationQrPayload(record: CalibrationRecord, instrument: Instrument, result: CalculationResult) {
  const { identity } = record.data;
  const lines = [
    'HASIL KALIBRASI · KALIBRASI MOBILE',
    `Alat: ${instrument.name}`,
    `Pelanggan: ${identity.customer || '—'}`,
    `Merek / tipe: ${identity.brand || '—'} / ${identity.model || '—'}`,
    `Nomor seri: ${identity.serial || '—'}`,
    `Nomor label: ${identity.labelNumber || '—'}`,
    `Tanggal uji: ${identity.testDate || '—'}`,
    `Hasil: ${result.status}`,
    `Skor: ${result.score === null ? '—' : `${result.score}/100`}`,
  ];

  if (result.environment.temperature || result.environment.humidity) {
    const { temperature, humidity } = result.environment;
    lines.push(`Lingkungan: suhu ${temperature ? `${display(temperature.mean)} ± ${display(temperature.u95)} C` : '—'}; RH ${humidity ? `${display(humidity.mean)} ± ${display(humidity.u95)}%` : '—'}`);
  }

  if (result.inspections.length) {
    const complete = result.inspections.filter((item) => item.complete).length;
    const passed = result.inspections.filter((item) => item.complete && item.passed).length;
    lines.push(`Pemeriksaan fisik/fungsi: ${complete}/${result.inspections.length} lengkap, ${passed} baik`);
  }

  const performance = result.performance.flatMap(({ label, setting, unit, result: item }) => item
    ? [`- ${label} ${setting} ${unit}: x̄ ${display(item.mean)}, U95 ${display(item.u95)}, ${verdict(item.pass)}`]
    : []);
  if (performance.length) lines.push('Pengujian kinerja:', ...performance);

  if (result.weighing) {
    lines.push(`Timbangan berulang: ${display(result.weighing.repeatabilityMean, 4)} kg; ${verdict(result.weighing.pass)}`);
    result.weighing.points.forEach((point) => lines.push(`- Beban ${point.loadKg} kg: koreksi ${display(point.correction, 5)} kg, U95 ${display(point.uncertaintyU95Kg, 5)} kg`));
  }

  if (result.sphygmomanometer) {
    const pressure = result.sphygmomanometer;
    lines.push(`Uji kebocoran: ${display(pressure.leakageDrop.value)} mmHg, ${verdict(pressure.leakageDrop.pass)}`);
    lines.push(`Deflasi cepat: ${display(pressure.rapidDeflationSeconds.value)} detik, ${verdict(pressure.rapidDeflationSeconds.pass)}`);
    pressure.pressureReadings.forEach((point) => lines.push(`- Tekanan ${point.setting} mmHg: naik ${verdict(point.up.pass)} (${display(point.up.mean)}), turun ${verdict(point.down.pass)} (${display(point.down.mean)})`));
  }

  if (result.pumpOcclusion) {
    lines.push(`Occlusion: ${display(result.pumpOcclusion.correctedMean)} psi; U95 ${display(result.pumpOcclusion.uncertaintyU95)} psi; ${verdict(result.pumpOcclusion.pass)}`);
  }

  if (result.suctionPump) {
    result.suctionPump.pressureReadings.forEach((point) => lines.push(`- Vakum ${Math.abs(point.setting)} mmHg: naik ${verdict(point.up?.pass)}, turun ${verdict(point.down?.pass)}`));
    lines.push(`Vakum maksimum: ${display(result.suctionPump.maximumVacuumReading)} mmHg; waktu ${display(result.suctionPump.maximumVacuumSeconds)} detik`);
  }

  if (result.safety) {
    lines.push('Keselamatan listrik:');
    result.safety.checks.forEach((check) => lines.push(`- ${check.label}: ${check.measured || '—'} ${check.limit ? `(batas ${check.limit})` : ''} ${verdict(check.result)}`));
  }

  if (result.missing.length) lines.push(`Belum lengkap: ${result.missing.join(', ')}`);
  return lines.join('\n');
}

const htmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => htmlEntities[character] ?? character);

export function buildCalibrationQrPrintHtml(payload: string, qrDataUri: string, photos: { label: string; src: string }[] = []) {
  const photosHtml = photos.length ? `<section class="photo-section"><h2>Foto alat</h2><div class="photo-grid">${photos.map(({ label, src }) => `<figure><img src="${escapeHtml(src)}" alt="Foto alat sisi ${escapeHtml(label)}"><figcaption>${escapeHtml(label)}</figcaption></figure>`).join('')}</div></section>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:11pt Arial,sans-serif;color:#18313B;margin:0}h1{font-size:20pt;margin:0 0 5px}.subtitle{font-size:10pt;color:#627783;margin:0 0 18px}.qr{display:block;width:210px;height:210px;margin:0 auto 10px}.scan{text-align:center;font-size:9pt;color:#627783;margin:0 0 20px}.details{white-space:pre-wrap;overflow-wrap:anywhere;border-top:1px solid #DEE8EB;padding-top:14px;font:9pt/1.5 Arial,sans-serif}.photo-section{margin-top:24px;break-inside:avoid}.photo-section h2{font-size:15pt;margin:0 0 12px}.photo-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.photo-grid figure{margin:0;break-inside:avoid;border:1px solid #DEE8EB;border-radius:8px;padding:8px}.photo-grid img{display:block;width:100%;height:170px;object-fit:contain;background:#F4F7F8}.photo-grid figcaption{font-size:9pt;font-weight:bold;margin-top:6px}.footer{border-top:1px solid #DEE8EB;padding-top:8px;margin-top:20px;color:#627783;font-size:8pt}
  </style></head><body><h1>Ringkasan hasil kalibrasi</h1><p class="subtitle">Laporan hasil teknisi · QR berisi ringkasan teks yang dapat dibaca tanpa internet.</p><img class="qr" src="${qrDataUri}" alt="QR hasil kalibrasi"><p class="scan">Pindai QR untuk membaca ringkasan hasil ini.</p><div class="details">${escapeHtml(payload)}</div>${photosHtml}<p class="footer">Dokumen ringkasan hasil pengerjaan teknisi.</p></body></html>`;
}
