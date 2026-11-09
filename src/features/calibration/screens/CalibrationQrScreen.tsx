import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import * as Print from 'expo-print';
import { Navbar } from '../../../components/Navbar';
import { ActionButton, Badge, Card, Heading, ValueLine } from '../../../components/ui';
import { calculateRecord } from '../../../core/calculations';
import { buildCalibrationQrPayload, buildCalibrationQrPrintHtml } from '../../../core/calibrationQr';
import { getRecordInstrument } from '../../../core/instruments';
import { useRecords } from '../../work-orders/hooks/useRecords';
import type { CalculationResult } from '../../../core/types';
import { styles } from '../styles/CalibrationQrStyles';

type QrSvgRef = { toDataURL: (callback: (data: string) => void) => void };

export default function CalibrationQrScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, loaded } = useRecords();
  const record = records.find((item) => item.id === String(id));
  const instrument = record ? getRecordInstrument(record) : null;
  const result = useMemo<CalculationResult | null>(() => record && instrument ? calculateRecord(instrument, record.data) : null, [record, instrument]);
  const payload = useMemo(() => record && instrument && result?.complete ? buildCalibrationQrPayload(record, instrument, result) : '', [record, instrument, result]);
  const qrRef = useRef<QrSvgRef | null>(null);
  const [qrError, setQrError] = useState('');
  const [printing, setPrinting] = useState(false);
  const setQrRef = useCallback((ref: QrSvgRef | null) => { qrRef.current = ref; }, []);
  const tone = result?.complete ? result.score !== null && result.score >= 70 ? 'good' : 'bad' : 'wait';

  const printResult = async () => {
    const svg = qrRef.current;
    if (!result?.complete || !payload || !svg || qrError) {
      Alert.alert('QR belum siap', qrError || 'Tunggu sampai QR hasil kalibrasi tampil.');
      return;
    }
    setPrinting(true);
    try {
      const encoded = await new Promise<string>((resolve) => svg.toDataURL(resolve));
      if (!encoded) throw new Error('QR belum berhasil disiapkan.');
      const qrDataUri = encoded.startsWith('data:image/') ? encoded : `data:image/png;base64,${encoded}`;
      await Print.printAsync({ html: buildCalibrationQrPrintHtml(payload, qrDataUri) });
    } catch (error) {
      Alert.alert('Cetak gagal', error instanceof Error ? error.message : 'Terjadi kesalahan saat menyiapkan hasil untuk dicetak.');
    } finally {
      setPrinting(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <Navbar title="QR hasil kalibrasi" subtitle="Ringkasan hasil teknisi" onBack={() => router.back()} backLabel="Kembali ke hasil" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {!loaded ? <Card><Text>Memuat hasil kalibrasi…</Text></Card> : !record || !instrument || !result ? <Card><Heading title="Hasil tidak ditemukan" /><ActionButton title="Kembali ke menu" onPress={() => router.replace('/')} /></Card> : !result.complete ? <Card>
        <Heading title="Pengerjaan belum selesai" hint="QR dan cetak hasil tersedia setelah semua data wajib dilengkapi." />
        {result.missing.map((item) => <Text key={item} style={styles.missingText}>• {item}</Text>)}
        <View style={styles.action}><ActionButton title="Kembali ke pengerjaan" onPress={() => router.replace(`/calibration/${record.id}`)} /></View>
      </Card> : <>
        <Card style={styles.qrCard}>
          <Badge text={result.status} tone={tone} />
          <Text style={styles.resultTitle}>{instrument.name}</Text>
          <View style={styles.qrFrame}>
            <QRCode value={payload} size={238} quietZone={12} ecl="L" getRef={setQrRef} onError={(error: unknown) => setQrError(error instanceof Error ? error.message : 'Ringkasan terlalu panjang untuk dibuat QR.')} />
          </View>
          <Text style={styles.scanHint}>Pindai dengan kamera untuk melihat ringkasan hasil. QR berisi teks, jadi bisa dibaca tanpa internet.</Text>
          {qrError ? <Text style={styles.errorText}>{qrError}</Text> : null}
        </Card>
        <Card>
          <Heading title="Ringkasan hasil" />
          <ValueLine label="Pelanggan" value={record.data.identity.customer || '—'} />
          <ValueLine label="Nomor seri alat" value={record.data.identity.serial || '—'} />
          <ValueLine label="Nomor label" value={record.data.identity.labelNumber || '—'} />
          <ValueLine label="Tanggal uji" value={record.data.identity.testDate || '—'} />
          <ValueLine label="Status hasil" value={result.status} strong />
          <ValueLine label="Skor" value={result.score === null ? '—' : `${result.score} / 100`} />
          {result.missing.length ? <Text style={styles.missingText}>Belum lengkap: {result.missing.join(', ')}</Text> : null}
        </Card>
        <View style={styles.action}><ActionButton title={printing ? 'Menyiapkan cetakan…' : 'Cetak hasil + QR'} onPress={printResult} disabled={printing || Boolean(qrError)} /></View>
        <ActionButton title="Selesai" secondary onPress={() => router.replace('/')} />
      </>}
    </ScrollView>
  </SafeAreaView>;
}
