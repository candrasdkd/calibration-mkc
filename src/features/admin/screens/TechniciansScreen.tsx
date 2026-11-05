import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, ConfirmModal, Field, Heading } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import type { TechnicianProfile } from '../../../core/admin-data';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';

const blankTechnician = (): TechnicianProfile => ({ id: '', name: '', phone: '', isDemo: false });

export function TechniciansScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<TechnicianProfile | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const locked = !data.loaded || Boolean(data.storageError);
  const save = () => {
    if (!editing?.name.trim() || !editing.phone.trim()) { Alert.alert('Data belum lengkap', 'Isi nama dan nomor telepon teknisi.'); return; }
    const technician = editing;
    setConfirmation({ title: technician.id ? 'Simpan perubahan teknisi?' : 'Tambahkan teknisi?', message: `${technician.name} akan disimpan di data teknisi.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveTechnician(technician); setEditing(null); } });
  };
  const remove = (technician: TechnicianProfile) => setConfirmation({ title: 'Hapus teknisi?', message: `Data ${technician.name} akan dihapus dari daftar.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => data.deleteTechnician(technician.id) });
  return <ScreenPage title="Data teknisi" hint="Kelola nama dan nomor telepon teknisi.">
    <StorageMessage message={data.storageError} />
    <ActionButton title="＋ Tambah teknisi" onPress={() => setEditing(blankTechnician())} disabled={locked} />
    {data.technicians.map((technician) => <Card key={technician.id} style={styles.entityCard}>
      <View style={styles.entityHeader}>
        <View style={[styles.entityAvatar, styles.technicianAvatar]}><Text style={styles.entityAvatarText}>TK</Text></View>
        <View style={styles.entityCopy}><Text style={styles.entityTitle}>{technician.name}</Text><Text style={styles.entitySubtitle}>Teknisi kalibrasi</Text></View>
        {technician.isDemo ? <Badge text="Contoh" tone="wait" /> : null}
      </View>
      <View style={styles.serialBox}><Text style={styles.blockLabel}>NOMOR TELEPON</Text><Text style={styles.serialValue}>{technician.phone}</Text></View>
      <View style={styles.actions}><ActionButton title="Ubah data" secondary onPress={() => setEditing({ ...technician })} disabled={locked} /><ActionButton title="Hapus" danger onPress={() => remove(technician)} disabled={locked} /></View>
    </Card>)}
    <Modal visible={Boolean(editing)} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditing(null)}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}>
            <Text style={styles.deviceModalTitle}>{editing?.id ? 'Ubah teknisi' : 'Teknisi baru'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup form teknisi" onPress={() => setEditing(null)}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable>
          </View>
          {editing ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled">
            <Card>
              <Heading title="Data teknisi" hint="Informasi ini akan tersedia saat teknisi mengisi pekerjaan." />
              <Field label="Nama teknisi" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
              <Field label="Nomor telepon" value={editing.phone} onChange={(phone) => setEditing({ ...editing, phone })} keyboard="phone-pad" />
              <View style={styles.actions}><ActionButton title="Simpan teknisi" onPress={save} disabled={locked} /><ActionButton title="Batal" secondary onPress={() => setEditing(null)} /></View>
            </Card>
          </ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
