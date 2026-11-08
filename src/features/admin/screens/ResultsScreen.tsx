import { useState } from 'react';
import { Alert, Text, View, Pressable } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ActionButton, Badge, Card, ConfirmModal, DateField, Field, ValueLine } from '../../../components/ui';
import { calculateRecord } from '../../../core/calculations';
import { buildDocumentHtml } from '../../../core/documents';
import { getInstrument } from '../../../core/instruments';
import type { DocumentKind, Instrument } from '../../../core/types';
import { useRole } from '../../home/hooks/useRole';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';

export function ResultsScreen() {
  const { role } = useRole();
  const { records, loaded, storageError, updateRecord, deleteRecord } = useRecords();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const selected = records.find((record) => record.id === selectedId);
  const updateIdentity = (patch: { documentNumber?: string; orderNumber?: string; issueDate?: string }) => {
    if (!selected) return;
    updateRecord(selected.id, { data: { ...selected.data, identity: { ...selected.data.identity, ...patch } } });
  };
  const shareDocument = async (record: (typeof records)[number], instrument: Instrument, kind: DocumentKind) => {
    if (role !== 'admin' || record.isDemo) return;
    const result = calculateRecord(instrument, record.data);
    const identity = record.data.identity;
    if (!result.complete) { Alert.alert('Pengerjaan belum lengkap', 'Lengkapi seluruh form teknisi sebelum membuat dokumen.'); return; }
    if (!identity.documentNumber.trim() || !identity.orderNumber?.trim() || !identity.issueDate.trim()) {
      Alert.alert('Data dokumen belum lengkap', 'Isi nomor sertifikat, nomor order, dan tanggal terbit terlebih dahulu.');
      return;
    }
    setBusyDocumentId(record.id);
    try {
      const { uri } = await Print.printToFileAsync({ html: buildDocumentHtml(record, instrument, result, kind) });
      if (!await Sharing.isAvailableAsync()) {
        Alert.alert('Berbagi PDF tidak tersedia', `File PDF dibuat di ${uri}, tetapi perangkat tidak menyediakan menu berbagi.`);
        return;
      }
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
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
  return <ScreenPage title="Cek hasil teknisi" hint="Tinjau data pekerjaan lalu lengkapi nomor dokumen dan tanggal terbit sertifikat.">
    <StorageMessage message={storageError} />
    {!loaded ? <Card><Text style={styles.muted}>Memuat data pekerjaan…</Text></Card> : null}
    {loaded && !records.length ? <Card style={styles.emptyState}><View style={styles.emptyMark}><Text style={styles.emptyMarkText}>—</Text></View><Text style={styles.emptyTitle}>Belum ada hasil</Text><Text style={styles.muted}>Hasil pekerjaan teknisi akan muncul di sini untuk ditinjau.</Text></Card> : null}
    {records.map((record) => {
      const item = getInstrument(record.instrumentId);
      if (!item) return null;
      const calculation = calculateRecord(item, record.data);
      const expanded = selectedId === record.id;
      const documentReady = Boolean(record.data.identity.documentNumber.trim() && record.data.identity.orderNumber?.trim() && record.data.identity.issueDate.trim());
      const documentHint = record.isDemo ? 'Data simulasi tidak dapat diterbitkan sebagai dokumen resmi.'
        : !calculation.complete ? 'Selesaikan form teknisi terlebih dahulu; ketuk hasil untuk melihat data yang belum lengkap.'
          : !documentReady ? 'Ketuk hasil untuk mengisi nomor sertifikat, nomor order, dan tanggal terbit.'
            : 'Data siap untuk dibuat sebagai PDF.';
      return <Card key={record.id} style={styles.resultCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${item.name}, ${record.data.identity.customer || 'Pelanggan belum diisi'}`} onPress={() => setSelectedId(expanded ? null : record.id)} style={styles.resultSummary}>
            <View style={styles.resultHead}>
              <View style={styles.resultMark}><Text style={styles.resultMarkText}>QC</Text></View>
              <View style={styles.resultCopy}><Text style={styles.resultCustomer}>{record.data.identity.customer || 'Pelanggan belum diisi'}</Text><Text style={styles.resultInstrument}>{item.name} · S/N {record.data.identity.serial || '—'}</Text></View>
              <Text style={styles.expandMark}>{expanded ? '−' : '+'}</Text>
            </View>
            <View style={styles.resultBadges}>{record.isDemo ? <Badge text="SIMULASI" tone="wait" /> : <Badge text={calculation.complete ? 'Hasil lengkap' : 'Draft'} tone={calculation.complete ? 'good' : 'wait'} />}<Badge text={documentReady ? 'Dokumen lengkap' : 'Dokumen belum lengkap'} tone={documentReady ? 'good' : 'neutral'} /></View>
          </Pressable>
          <View style={{ gap: 8, paddingHorizontal: 14, paddingBottom: 14 }}>
            <Text style={styles.muted}>{documentHint}</Text>
            <ActionButton title="Buat LK" secondary onPress={() => shareDocument(record, item, 'report')} disabled={!calculation.complete || !documentReady || record.isDemo || busyDocumentId === record.id} />
            <ActionButton title="Buat sertifikat" onPress={() => shareDocument(record, item, 'certificate')} disabled={!calculation.complete || !documentReady || record.isDemo || busyDocumentId === record.id} />
          </View>
          {expanded ? <View style={styles.resultEditor}>
            <View style={styles.resultDetails}>
              <ValueLine label="Tanggal pengerjaan" value={record.data.identity.testDate} /><ValueLine label="Teknisi" value={record.data.identity.technician} /><ValueLine label="Hasil kalibrasi" value={calculation.status} strong />
              {calculation.score !== null ? <ValueLine label="Nilai" value={`${calculation.score} / 100`} /> : null}
              {record.data.selectedDevices?.length ? <ValueLine label="Standar ukur" value={record.data.selectedDevices.map((device) => `${device.name} (${device.serial})`).join(', ')} /> : null}
            </View>
            {calculation.missing.length ? <Text style={styles.missing}>Belum lengkap: {calculation.missing.join(', ')}</Text> : null}
            {calculation.complete ? <>
              <Field label="No. Sertifikat" value={record.data.identity.documentNumber} onChange={(documentNumber) => updateIdentity({ documentNumber })} />
              <Field label="No. Order" value={record.data.identity.orderNumber ?? ''} onChange={(orderNumber) => updateIdentity({ orderNumber })} />
              <DateField label="Tanggal terbit sertifikat" value={record.data.identity.issueDate} onChange={(issueDate) => updateIdentity({ issueDate })} />
              {!documentReady ? <Text style={styles.missing}>Isi nomor sertifikat, nomor order, dan tanggal terbit untuk membuka pembuatan dokumen.</Text> : null}
            </> : <Text style={styles.missing}>LK dan sertifikat tersedia setelah teknisi menyelesaikan seluruh form.</Text>}
            <ActionButton title="Hapus pekerjaan" danger onPress={removeSelected} />
          </View> : null}
        </Card>
      ;
    })}
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
