# Kalibrasi Mobile

Aplikasi React Native berbasis Expo dan TypeScript strict untuk membuat lembar kerja kalibrasi tanpa login. Draf dan hasil disimpan lokal di perangkat; laporan hasil dan sertifikat dapat dipratinjau lalu dibagikan sebagai PDF.

## Menjalankan

```sh
npm install
npx expo start
```

Buka dengan Expo Go di Android atau iOS. `npm run android` dan `npm run ios` menjalankan development server pada target masing-masing.

## Alur teknisi

1. Pilih Centrifuge, Fetal Doppler, atau Flow Meter.
2. Isi identitas alat dan pelanggan.
3. Pilih thermohygrometer acuan, masukkan kondisi awal/akhir, pemeriksaan fisik/fungsi, dan bacaan standar.
4. Tinjau koreksi, ketidakpastian, toleransi, skor, serta kesimpulan.
5. Pratinjau dan bagikan Laporan Hasil atau Sertifikat dalam PDF.

Data tersimpan lokal tanpa akun atau server. Penyimpanan memakai AsyncStorage yang tidak terenkripsi; jangan gunakan perangkat bersama untuk data pelanggan sensitif.

## Perhitungan yang diambil dari workbook

- **Centrifuge:** lima titik kecepatan (1000, 2000, 4000, dan 2500 RPM) serta waktu 600 detik; toleransi kinerja 10%; skor keselamatan 40, fisik/fungsi 10, kinerja 50.
- **Fetal Doppler:** lima titik heart rate (60–240 BPM), enam bacaan per titik, toleransi 5%; skor fisik/fungsi 10 dan kinerja 90.
- **Flow Meter:** lima titik aliran (2–10 L/min), lima bacaan per titik; skor fisik/fungsi 10 dan kinerja 90. Judul tabel Excel menyebut ±20%, sedangkan rumus ambangnya memakai 10%; aplikasi mengikuti rumus 10%.
- **Kondisi lingkungan:** koreksi suhu dan kelembaban memakai interpolasi linier pada tabel Thermohygrometer untuk lima nomor seri yang ada di workbook. Aplikasi tidak mengekstrapolasi di luar rentang tabel (15–37 °C dan 30–80% RH).

Ada dua kejanggalan workbook yang perlu diverifikasi terhadap prosedur kalibrasi sebelum dipakai resmi: rumus keselamatan Centrifuge membandingkan nilai ambang dengan teks satuan, sehingga aplikasi membandingkan nilai terukur dengan ambang tabel yang dimaksud; dan koreksi RH Thermohygrometer EFG19BE02500 pada titik 50% tercatat +10,1%. Nilai RH itu disalin apa adanya dan diberi peringatan saat acuan dipilih.

## Menambah alat

Tambahkan definisi alat, daftar titik dan standar di `src/core/instruments.ts`, lalu tambahkan cabang rumus di `src/core/calculations.ts`. Tipe datanya ada di `src/core/types.ts`. Layar input, skor, penyimpanan lokal, dan dokumen mengambil struktur tersebut secara otomatis; bila format uji alat baru berbeda, tambahkan komponennya di `src/app/calibration/[id].tsx`.
