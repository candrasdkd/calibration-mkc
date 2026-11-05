import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, Choice, ConfirmModal, Field, Heading, ValueLine } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import type { EquipmentMethod } from '../../../core/admin-data';
import { getInstrument, instruments } from '../../../core/instruments';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';

export function HealthEquipmentScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<EquipmentMethod | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const locked = !data.loaded || Boolean(data.storageError);
  const available = instruments.filter((instrument) => !data.equipmentMethods.some((entry) => entry.instrumentId === instrument.id));
  const configured = instruments.flatMap((instrument) => {
    const entry = data.equipmentMethods.find((item) => item.instrumentId === instrument.id);
    return entry ? [{ instrument, entry }] : [];
  });
  const add = () => { setIsNew(true); setEditing({ instrumentId: '', method: '' }); };
  const edit = (entry: EquipmentMethod) => { setIsNew(false); setEditing({ ...entry }); };
  const closeEditor = () => setEditing(null);
  const save = () => {
    if (!editing?.instrumentId) { Alert.alert('Jenis alat wajib dipilih', 'Pilih jenis alat yang akan disiapkan untuk teknisi.'); return; }
    if (!editing.method.trim()) { Alert.alert('Metode kerja wajib diisi', 'Masukkan metode kerja sebelum menyimpan jenis alat.'); return; }
    if (isNew && data.equipmentMethods.some((entry) => entry.instrumentId === editing.instrumentId)) { Alert.alert('Jenis alat sudah terdaftar', 'Ubah metode kerja dari daftar alat yang sudah ada.'); return; }
    const instrument = getInstrument(editing.instrumentId);
    if (!instrument) { Alert.alert('Jenis alat tidak dikenal', 'Pilih salah satu jenis alat yang didukung.'); return; }
    const entry = { instrumentId: editing.instrumentId, method: editing.method.trim() };
    setConfirmation({ title: isNew ? 'Tambahkan jenis alat?' : 'Simpan metode kerja?', message: `Metode kerja ${instrument.name} akan digunakan untuk pengerjaan baru oleh teknisi.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveEquipmentMethod(entry); closeEditor(); } });
  };
  const remove = (entry: EquipmentMethod) => {
    const instrument = getInstrument(entry.instrumentId);
    setConfirmation({ title: 'Hapus jenis alat?', message: `${instrument?.name ?? 'Jenis alat'} tidak akan muncul lagi untuk pengerjaan baru teknisi. Catatan yang sudah dibuat tetap tersimpan.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => data.deleteEquipmentMethod(entry.instrumentId) });
  };

  return <ScreenPage title="Data alat kesehatan" hint="Admin menyiapkan jenis alat dan metode wajibnya. Metode akan otomatis masuk ke form teknisi.">
    <StorageMessage message={data.storageError} />
    <Card><Heading title="Jenis alat yang didukung" hint={`Rumus tersedia untuk ${instruments.map((instrument) => instrument.name).join(', ')}. Jenis alat baru perlu rumus kalibrasi sebelum dapat ditambahkan.`} /></Card>
    <ActionButton title="＋ Tambah jenis alat" onPress={add} disabled={locked || !available.length} />
    {!data.loaded ? <Card><Text style={styles.muted}>Memuat data jenis alat…</Text></Card> : null}
    {data.loaded && !configured.length ? <Card style={styles.emptyState}><Text style={styles.emptyTitle}>Belum ada jenis alat untuk teknisi</Text><Text style={styles.muted}>Tambahkan jenis alat lalu isi metode kerja agar teknisi bisa mulai membuat pengerjaan.</Text></Card> : null}
    {configured.map(({ instrument, entry }) => <Card key={entry.instrumentId} style={styles.entityCard}>
      <View style={styles.entityHeader}>
        <View style={[styles.entityAvatar, styles.deviceAvatar]}><Text style={styles.entityAvatarText}>AK</Text></View>
        <View style={styles.entityCopy}><Text style={styles.entityTitle}>{instrument.name}</Text><Text style={styles.entitySubtitle}>{instrument.subtitle}</Text></View>
        <Badge text="SIAP" tone="good" />
      </View>
      <View style={styles.equipmentMethodPreview}><Text style={styles.equipmentMethodLabel}>METODE KERJA</Text><Text style={styles.equipmentMethodText}>{entry.method}</Text></View>
      <View style={styles.actions}><ActionButton title="Ubah metode" secondary onPress={() => edit(entry)} disabled={locked} /><ActionButton title="Hapus" danger onPress={() => remove(entry)} disabled={locked} /></View>
    </Card>)}
    <Modal visible={Boolean(editing) && !confirmation} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}><Text style={styles.deviceModalTitle}>{isNew ? 'Jenis alat baru' : 'Ubah metode kerja'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tutup form jenis alat" onPress={closeEditor}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable></View>
          {editing ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled"><Card>
            <Heading title="Informasi jenis alat" hint="Metode wajib diisi admin sebelum jenis alat tersedia di form teknisi." />
            {isNew ? <Choice label="Jenis alat kesehatan *" value={editing.instrumentId} options={available.map((instrument) => ({ value: instrument.id, label: instrument.name }))} onChange={(instrumentId) => setEditing((current) => current ? { ...current, instrumentId } : current)} /> : <ValueLine label="Jenis alat kesehatan" value={getInstrument(editing.instrumentId)?.name} />}
            <Field label="Metode kerja *" value={editing.method} onChange={(method) => setEditing((current) => current ? { ...current, method } : current)} multiline />
            <Text style={styles.equipmentMethodHint}>Metode ini otomatis disalin ke pekerjaan baru teknisi untuk jenis alat yang dipilih.</Text>
            <View style={styles.actions}><ActionButton title="Simpan metode kerja" onPress={save} disabled={locked} /><ActionButton title="Batal" secondary onPress={closeEditor} /></View>
          </Card></ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
