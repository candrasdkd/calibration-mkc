import { useState } from 'react';
import { Alert, Platform, Text, View, Pressable } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ActionButton, Badge, Card, ConfirmModal, DateField, ValueLine } from '../../../components/ui';
import { calculateRecord } from '../../../core/calculations';
import { buildDocumentHtml } from '../../../core/documents';
import { getRecordInstrument } from '../../../core/instruments';
import type { DocumentKind, Instrument } from '../../../core/types';
import { useRole } from '../../home/hooks/useRole';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { DocumentNumberSettingsCard } from '../components/DocumentNumberSettings';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';
import { localDateString, reserveDocumentNumber } from '../../../core/documentNumbering';

export function ResultsScreen() {
  const { role } = useRole();
  const { records, loaded, storageError, updateRecord, assignOrderNumber, deleteRecord } = useRecords();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const selected = records.find((record) => record.id === selectedId);
  const updateIdentity = (patch: { issueDate?: string }) => {
    if (!selected) return;
    const identity = selected.data.identity;
    const certificateMonthChanged = patch.issueDate && identity.issueDate.slice(0, 7) !== patch.issueDate.slice(0, 7);
    updateRecord(selected.id, { data: { ...selected.data, identity: {
      ...identity, ...patch, ...(certificateMonthChanged ? { documentNumber: '' } : {}),
    } } });
  };
  const shareDocument = async (record: (typeof records)[number], instrument: Instrument, kind: DocumentKind) => {
    if (role !== 'admin') return;
    const result = calculateRecord(instrument, record.data);
    let documentRecord = record;
    const identity = documentRecord.data.identity;
    if (!result.complete) { Alert.alert('Pengerjaan belum lengkap', 'Lengkapi seluruh form teknisi sebelum membuat dokumen.'); return; }
    if (!identity.issueDate.trim()) {
      Alert.alert('Data dokumen belum lengkap', 'Isi tanggal terbit sertifikat terlebih dahulu.');
      return;
    }
    setBusyDocumentId(record.id);
    try {
      const numberPatch: { documentNumber?: string; orderNumber?: string } = {};
      if (!identity.orderNumber?.trim()) {
        const orderReference = documentRecord.data.orderGroupId || record.id;
        numberPatch.orderNumber = await reserveDocumentNumber('order', orderReference, localDateString());
        assignOrderNumber(orderReference, numberPatch.orderNumber);
      }
      if (!identity.documentNumber.trim()) numberPatch.documentNumber = await reserveDocumentNumber('certificate', `${record.id}:${identity.issueDate.slice(0, 7)}`, identity.issueDate);
      if (numberPatch.documentNumber || numberPatch.orderNumber) {
        const data = { ...documentRecord.data, identity: { ...identity, ...numberPatch } };
        documentRecord = { ...documentRecord, data };
        updateRecord(record.id, { data });
      }
      const html = buildDocumentHtml(documentRecord, instrument, result, kind);
      if (Platform.OS === 'android') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('Berbagi PDF tidak tersedia', `File PDF dibuat di ${uri}, tetapi perangkat tidak menyediakan menu berbagi.`);
        return;
      }
      await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Dokumen gagal dibuat', error instanceof Error ? error.message : 'Terjadi kesalahan saat membuat PDF.');
    } finally {
      setBusyDocumentId(null);
    }
  };
  const removeSelected = () => {
    if (!selected) return;
    setConfirmation({ title: 'Hapus pekerjaan?', message: `Hasil ${selected.data.identity.customer || 'ini'} akan dihapus dari perangkat.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => { deleteRecord(selected.id); setSelectedId(null); } });
  };
  if (role !== 'admin') return <ScreenPage title="Cek hasil teknisi" hint="Halaman ini hanya tersedia untuk admin."><Card><Text style={styles.muted}>Pilih role admin untuk memeriksa hasil dan menerbitkan dokumen.</Text></Card></ScreenPage>;
  return <ScreenPage title="Cek hasil teknisi" hint="Tinjau hasil teknisi, atur format nomor, lalu terbitkan LK dan sertifikat.">
    <StorageMessage message={storageError} />
    <DocumentNumberSettingsCard />
    {!loaded ? <Card><Text style={styles.muted}>Memuat data pekerjaan…</Text></Card> : null}
    {loaded && !records.length ? <Card style={styles.emptyState}><View style={styles.emptyMark}><Text style={styles.emptyMarkText}>—</Text></View><Text style={styles.emptyTitle}>Belum ada hasil</Text><Text style={styles.muted}>Hasil pekerjaan teknisi akan muncul di sini untuk ditinjau.</Text></Card> : null}
    {records.map((record) => {
      const item = getRecordInstrument(record);
      if (!item) return null;
      const calculation = calculateRecord(item, record.data);
      const expanded = selectedId === record.id;
      const documentReady = Boolean(record.data.identity.issueDate.trim());
      const documentHint = !calculation.complete ? 'Selesaikan form teknisi terlebih dahulu; ketuk hasil untuk melihat data yang belum lengkap.'
        : !documentReady ? 'Ketuk hasil untuk mengisi tanggal terbit sertifikat. Admin menerbitkan nomor order dan sertifikat otomatis saat membuat dokumen.'
          : 'Data siap untuk dibuat sebagai PDF.';
      return <Card key={record.id} style={styles.resultCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${item.name}, ${record.data.identity.customer || 'Pelanggan belum diisi'}`} onPress={() => setSelectedId(expanded ? null : record.id)} style={styles.resultSummary}>
            <View style={styles.resultHead}>
              <View style={styles.resultMark}><Text style={styles.resultMarkText}>QC</Text></View>
              <View style={styles.resultCopy}><Text style={styles.resultCustomer}>{record.data.identity.customer || 'Pelanggan belum diisi'}</Text><Text style={styles.resultInstrument}>{item.name} · S/N {record.data.identity.serial || '—'}</Text></View>
              <Text style={styles.expandMark}>{expanded ? '−' : '+'}</Text>
            </View>
            <View style={styles.resultBadges}><Badge text={calculation.complete ? 'Hasil lengkap' : 'Draft'} tone={calculation.complete ? 'good' : 'wait'} /><Badge text={documentReady ? 'Dokumen lengkap' : 'Dokumen belum lengkap'} tone={documentReady ? 'good' : 'neutral'} /></View>
          </Pressable>
          <View style={{ gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={styles.muted}>{documentHint}</Text>
            <ActionButton title="Buat LK" secondary onPress={() => shareDocument(record, item, 'report')} disabled={!calculation.complete || !documentReady || busyDocumentId === record.id} />
            <ActionButton title="Buat sertifikat" onPress={() => shareDocument(record, item, 'certificate')} disabled={!calculation.complete || !documentReady || busyDocumentId === record.id} />
          </View>
          {expanded ? <View style={styles.resultEditor}>
            <View style={styles.resultDetails}>
              <ValueLine label="Tanggal pengerjaan" value={record.data.identity.testDate} /><ValueLine label="Teknisi" value={record.data.identity.technician} /><ValueLine label="Hasil kalibrasi" value={calculation.status} strong />
              {calculation.score !== null ? <ValueLine label="Nilai" value={`${calculation.score} / 100`} /> : null}
              {record.data.selectedDevices?.length ? <ValueLine label="Standar ukur" value={record.data.selectedDevices.map((device) => `${device.name} (${device.serial})`).join(', ')} /> : null}
            </View>
            {calculation.missing.length ? <Text style={styles.missing}>Belum lengkap: {calculation.missing.join(', ')}</Text> : null}
            {calculation.complete ? <>
              <ValueLine label="No. Order" value={record.data.identity.orderNumber || 'Dibuat admin saat menerbitkan dokumen'} />
              <ValueLine label="No. Sertifikat" value={record.data.identity.documentNumber || 'Dibuat otomatis saat dokumen diterbitkan'} />
              <DateField label="Tanggal terbit sertifikat" value={record.data.identity.issueDate} onChange={(issueDate) => updateIdentity({ issueDate })} />
              {!documentReady ? <Text style={styles.missing}>Isi tanggal terbit untuk membuka pembuatan dokumen. Nomor sertifikat dan order akan diisi otomatis.</Text> : null}
            </> : <Text style={styles.missing}>LK dan sertifikat tersedia setelah teknisi menyelesaikan seluruh form.</Text>}
            <ActionButton title="Hapus pekerjaan" danger onPress={removeSelected} />
          </View> : null}
        </Card>
      ;
    })}
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
