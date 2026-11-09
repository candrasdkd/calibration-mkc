import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { ActionButton, Badge, Card, ConfirmModal } from '../../../components/ui';
import { ScreenPage } from '../../../components/ScreenPage';
import { calculateRecord } from '../../../core/calculations';
import { getInstrument } from '../../../core/instruments';
import { useRecords } from '../hooks/useRecords';
import { styles } from '../styles/DraftsScreenStyles';

import type { CalibrationRecord } from '../../../core/types';
import type { DraftConfirmation } from '../types/DraftConfirmation';


function dateLabel(value: string) {
  if (!value) return 'Tanggal belum diisi';
  return value.split('-').reverse().join('-');
}
function dateTimeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Waktu belum tersedia' : date.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function DraftsScreen() {
  const router = useRouter();
  const { records, loaded, storageError, deleteRecord } = useRecords();
  const [showCompleted, setShowCompleted] = useState(false);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<DraftConfirmation | null>(null);
  const recordRows = useMemo(() => records.filter((record) => !record.isDemo)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .flatMap((record) => {
      const instrument = getInstrument(record.instrumentId);
      return instrument ? [{ record, instrument, result: calculateRecord(instrument, record.data) }] : [];
    }), [records]);
  const { drafts, completed } = useMemo(() => ({
    drafts: recordRows.filter((item) => !item.result.complete),
    completed: recordRows.filter((item) => item.result.complete),
  }), [recordRows]);
  const draftGroups = useMemo(() => {
    const groups = new Map<string, { key: string; customer: string; location: string; testDate: string; updatedAt: string; rows: typeof drafts }>();
    for (const item of drafts) {
      const { identity } = item.record.data;
      const customer = identity.customer || 'Pelanggan belum dipilih';
      const location = identity.city || '';
      const customerKey = `${customer.trim().toLowerCase()}::${location.trim().toLowerCase()}`;
      const key = `${identity.testDate}::${customerKey}`;
      const group = groups.get(key);
      if (group) {
        group.rows.push(item);
        if (item.record.updatedAt > group.updatedAt) group.updatedAt = item.record.updatedAt;
      } else groups.set(key, { key, customer, location, testDate: identity.testDate, updatedAt: item.record.updatedAt, rows: [item] });
    }
    return [...groups.values()].sort((a, b) => b.testDate.localeCompare(a.testDate) || b.updatedAt.localeCompare(a.updatedAt));
  }, [drafts]);

  const removeRecord = (record: CalibrationRecord) => setConfirmation({
    title: 'Hapus catatan?',
    message: `${getInstrument(record.instrumentId)?.name || 'Catatan'} ini akan dihapus dari perangkat.`,
    confirmLabel: 'Hapus', danger: true, onConfirm: () => deleteRecord(record.id),
  });

  const renderRecord = ({ record, instrument, result }: (typeof recordRows)[number]) => {
    const { identity } = record.data;
    const title = identity.customer || 'Pelanggan belum dipilih';
    const deviceDetails = [identity.brand, identity.model].filter(Boolean).join(' · ');
    return <Card key={record.id} style={styles.recordCard}>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/calibration/${record.id}`)} style={styles.recordMain}>
        <View style={styles.recordTop}><View style={styles.recordTitleWrap}><Text style={styles.recordEyebrow}>PELANGGAN</Text><Text style={styles.recordName}>{title}</Text></View><Badge text={result.complete ? 'SELESAI' : 'BELUM SELESAI'} tone={result.complete ? 'good' : 'wait'} /></View>
        <View style={styles.recordDevice}><Text style={styles.recordEyebrow}>ALAT YANG DIKERJAKAN</Text><Text style={styles.recordDetails}>{instrument.name}{deviceDetails ? ` · ${deviceDetails}` : ''}</Text><Text style={styles.recordSerial}>No. seri: {identity.serial || 'Belum diisi'}</Text></View>
        <View style={styles.recordMeta}><View style={styles.recordMetaRow}><Text style={styles.recordMetaLabel}>TANGGAL UJI</Text><Text style={styles.recordMetaValue}>{dateLabel(identity.testDate)}</Text></View><View style={styles.recordMetaRow}><Text style={styles.recordMetaLabel}>TERAKHIR DIPERBARUI</Text><Text style={styles.recordMetaValue}>{dateTimeLabel(record.updatedAt)}</Text></View></View>
        {!result.complete ? <View style={styles.missingBlock}><Text style={styles.missingTitle}>{result.missing.length} data perlu dilengkapi</Text><Text numberOfLines={2} style={styles.missingPreview}>{result.missing.slice(0, 2).join(' · ')}{result.missing.length > 2 ? ` · +${result.missing.length - 2} lainnya` : ''}</Text></View> : null}
        <View style={styles.recordAction}><Text style={styles.recordActionText}>{result.complete ? 'Buka hasil' : 'Lanjutkan pengerjaan'}</Text><Text style={styles.recordActionArrow}>›</Text></View>
      </Pressable>
      <ActionButton title="Hapus" secondary danger onPress={() => removeRecord(record)} />
    </Card>;
  };

  return <ScreenPage title="Draft pekerjaan" hint="Draft dikelompokkan berdasarkan rumah sakit dan tanggal uji. Buka kelompok untuk melihat alat yang belum selesai.">
    {storageError ? <Card style={styles.storageWarning}><Text style={styles.warningText}>{storageError}</Text></Card> : null}
    {!loaded ? <Card><Text style={styles.emptyText}>Memuat catatan lokal…</Text></Card> : null}
    {loaded && drafts.length === 0 ? <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>Tidak ada draft tertunda</Text>
      <Text style={styles.emptyText}>Pekerjaan baru yang belum selesai akan muncul di sini.</Text>
    </Card> : null}
    {draftGroups.map((group) => {
      const expanded = expandedGroupKey === group.key;
      return <Card key={group.key} style={styles.groupCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedGroupKey(expanded ? null : group.key)} style={styles.groupHeader}>
          <View style={styles.groupCopy}>
            <Text style={styles.recordEyebrow}>RUMAH SAKIT</Text>
            <Text style={styles.groupCustomer}>{group.customer}</Text>
            {group.location ? <Text style={styles.groupDate}>{group.location}</Text> : null}
            <Text style={styles.groupDate}>Tanggal uji · {dateLabel(group.testDate)}</Text>
            <Text style={styles.groupSummary}>{group.rows.length} alat belum selesai</Text>
          </View>
          <View style={styles.groupHeaderAction}><Badge text={`${group.rows.length} alat`} tone="wait" /><Text style={styles.formulaChevron}>{expanded ? '−' : '›'}</Text></View>
        </Pressable>
        {expanded ? <View style={styles.groupRows}>
          {group.rows.map(({ record, instrument, result }) => {
            const { identity } = record.data;
            const deviceDetails = [identity.brand, identity.model].filter(Boolean).join(' · ');
            return <View key={record.id} style={styles.groupItem}>
              <Pressable accessibilityRole="button" onPress={() => router.push(`/calibration/${record.id}`)} style={styles.groupItemMain}>
                <View style={styles.groupItemHeader}>
                  <Text style={styles.groupItemName}>{instrument.name}</Text>
                  <Badge text="BELUM SELESAI" tone="wait" />
                </View>
                <Text style={styles.groupItemDetails}>{deviceDetails || 'Identitas alat belum diisi'} · No. seri {identity.serial || 'belum diisi'}</Text>
                <View style={styles.missingBlock}>
                  <Text style={styles.missingTitle}>{result.missing.length} data perlu dilengkapi</Text>
                  <Text numberOfLines={2} style={styles.missingPreview}>{result.missing.slice(0, 2).join(' · ')}{result.missing.length > 2 ? ` · +${result.missing.length - 2} lainnya` : ''}</Text>
                </View>
              </Pressable>
              <View style={styles.groupItemActions}>
                <ActionButton title="Lanjutkan" onPress={() => router.push(`/calibration/${record.id}`)} />
                <ActionButton title="Hapus" secondary danger onPress={() => removeRecord(record)} />
              </View>
            </View>;
          })}
        </View> : null}
      </Card>;
    })}
    {loaded && completed.length ? <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCompleted }} onPress={() => setShowCompleted((value) => !value)} style={styles.completedToggle}>
        <Text style={styles.completedTitle}>Pekerjaan selesai · {completed.length}</Text><Text style={styles.formulaChevron}>{showCompleted ? '−' : '+'}</Text>
      </Pressable>
      {showCompleted ? completed.map(renderRecord) : null}
    </> : null}
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
