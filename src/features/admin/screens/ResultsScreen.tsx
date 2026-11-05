import { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { ActionButton, Badge, Card, ConfirmModal, DateField, Field, ValueLine } from '../../../components/ui';
import { calculateRecord } from '../../../core/calculations';
import { getInstrument } from '../../../core/instruments';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';

export function ResultsScreen() {
  const { records, loaded, storageError, updateRecord, deleteRecord } = useRecords();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const selected = records.find((record) => record.id === selectedId);
  const updateIdentity = (patch: { documentNumber?: string; issueDate?: string }) => {
    if (!selected) return;
    updateRecord(selected.id, { data: { ...selected.data, identity: { ...selected.data.identity, ...patch } } });
  };
  const removeSelected = () => {
    if (!selected) return;
    setConfirmation({ title: 'Hapus pekerjaan?', message: `Hasil ${selected.data.identity.customer || 'ini'} akan dihapus dari perangkat.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => { deleteRecord(selected.id); setSelectedId(null); } });
  };
  return <ScreenPage title="Cek hasil teknisi" hint="Tinjau data pekerjaan lalu lengkapi nomor dokumen dan tanggal terbit sertifikat.">
    <StorageMessage message={storageError} />
    {!loaded ? <Card><Text style={styles.muted}>Memuat data pekerjaan…</Text></Card> : null}
    {loaded && !records.length ? <Card style={styles.emptyState}><View style={styles.emptyMark}><Text style={styles.emptyMarkText}>—</Text></View><Text style={styles.emptyTitle}>Belum ada hasil</Text><Text style={styles.muted}>Hasil pekerjaan teknisi akan muncul di sini untuk ditinjau.</Text></Card> : null}
    {records.map((record) => {
      const item = getInstrument(record.instrumentId);
      if (!item) return null;
      const calculation = calculateRecord(item, record.data);
      const expanded = selectedId === record.id;
      const documentReady = Boolean(record.data.identity.documentNumber.trim() && record.data.identity.issueDate.trim());
      return <Card key={record.id} style={styles.resultCard}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded }} accessibilityLabel={`${item.name}, ${record.data.identity.customer || 'Pelanggan belum diisi'}`} onPress={() => setSelectedId(expanded ? null : record.id)} style={styles.resultSummary}>
            <View style={styles.resultHead}>
              <View style={styles.resultMark}><Text style={styles.resultMarkText}>QC</Text></View>
              <View style={styles.resultCopy}><Text style={styles.resultCustomer}>{record.data.identity.customer || 'Pelanggan belum diisi'}</Text><Text style={styles.resultInstrument}>{item.name} · S/N {record.data.identity.serial || '—'}</Text></View>
              <Text style={styles.expandMark}>{expanded ? '−' : '+'}</Text>
            </View>
            <View style={styles.resultBadges}>{record.isDemo ? <Badge text="SIMULASI" tone="wait" /> : <Badge text={calculation.complete ? 'Hasil lengkap' : 'Draft'} tone={calculation.complete ? 'good' : 'wait'} />}<Badge text={documentReady ? 'Dokumen lengkap' : 'Dokumen belum lengkap'} tone={documentReady ? 'good' : 'neutral'} /></View>
          </Pressable>
          {expanded ? <View style={styles.resultEditor}>
            <View style={styles.resultDetails}>
              <ValueLine label="Tanggal pengerjaan" value={record.data.identity.testDate} /><ValueLine label="Teknisi" value={record.data.identity.technician} /><ValueLine label="Hasil kalibrasi" value={calculation.status} strong />
              {calculation.score !== null ? <ValueLine label="Nilai" value={`${calculation.score} / 100`} /> : null}
              {record.data.selectedDevices?.length ? <ValueLine label="Standar ukur" value={record.data.selectedDevices.map((device) => `${device.name} (${device.serial})`).join(', ')} /> : null}
            </View>
            {calculation.missing.length ? <Text style={styles.missing}>Belum lengkap: {calculation.missing.join(', ')}</Text> : null}
            <Field label="No dokumen" value={record.data.identity.documentNumber} onChange={(documentNumber) => updateIdentity({ documentNumber })} />
            <DateField label="Tanggal terbit sertifikat" value={record.data.identity.issueDate} onChange={(issueDate) => updateIdentity({ issueDate })} />
            <ActionButton title="Hapus pekerjaan" danger onPress={removeSelected} />
          </View> : null}
        </Card>
      ;
    })}
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
