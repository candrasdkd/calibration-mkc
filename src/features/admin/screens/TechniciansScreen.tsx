import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, CompactEntityCard, ConfirmModal, Field, Heading, SearchField } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import type { TechnicianProfile } from '../../../core/admin-data';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import { styles as technicianStyles } from '../styles/TechniciansScreenStyles';
import type { Confirmation } from '../types/Confirmation';

const blankTechnician = (): TechnicianProfile => ({ id: '', name: '', phone: '', isDemo: false });

export function TechniciansScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<TechnicianProfile | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState('');
  const [expandedTechnicianId, setExpandedTechnicianId] = useState<string | null>(null);
  const locked = !data.loaded || Boolean(data.storageError);
  const query = search.trim().toLowerCase();
  const filteredTechnicians = data.technicians.filter((technician) => `${technician.name} ${technician.phone}`.toLowerCase().includes(query));
  const save = () => {
    if (!editing?.name.trim() || !editing.phone.trim()) { Alert.alert('Data belum lengkap', 'Isi nama dan nomor telepon teknisi.'); return; }
    const technician = editing;
    setConfirmation({ title: technician.id ? 'Simpan perubahan teknisi?' : 'Tambahkan teknisi?', message: `${technician.name} akan disimpan di data teknisi.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveTechnician(technician); setEditing(null); } });
  };
  const remove = (technician: TechnicianProfile) => setConfirmation({ title: 'Hapus teknisi?', message: `Data ${technician.name} akan dihapus dari daftar.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => data.deleteTechnician(technician.id) });
  return <ScreenPage title="Data teknisi" hint="Kelola nama dan nomor telepon teknisi.">
    <StorageMessage message={data.storageError} />
    <View style={technicianStyles.listHeader}>
      <View><Text style={technicianStyles.listTitle}>Daftar teknisi</Text><Text style={technicianStyles.listSubtitle}>{query ? `${filteredTechnicians.length} dari ${data.technicians.length} teknisi` : 'Teknisi yang tersimpan'}</Text></View>
      <View style={technicianStyles.listCount}><Text style={technicianStyles.listCountText}>{data.technicians.length}</Text></View>
    </View>
    <SearchField accessibilityLabel="Cari teknisi" value={search} onChange={(value) => { setSearch(value); setExpandedTechnicianId(null); }} placeholder="Cari nama atau nomor telepon" />
    <View style={technicianStyles.addAction}><ActionButton title="＋ Tambah teknisi" onPress={() => setEditing(blankTechnician())} disabled={locked} /></View>
    {!filteredTechnicians.length ? <Card style={technicianStyles.emptyCard}>
      <View style={technicianStyles.emptyMark}><Text style={technicianStyles.emptyMarkText}>TK</Text></View>
      <Text style={technicianStyles.emptyTitle}>{data.technicians.length ? 'Teknisi tidak ditemukan' : 'Belum ada teknisi'}</Text>
      <Text style={technicianStyles.emptyHint}>{data.technicians.length ? 'Coba kata kunci lain atau hapus pencarian.' : 'Tambahkan teknisi agar bisa dipilih saat membuat pengerjaan.'}</Text>
      {search ? <ActionButton title="Hapus pencarian" secondary onPress={() => setSearch('')} /> : null}
    </Card> : filteredTechnicians.map((technician) => {
      const expanded = expandedTechnicianId === technician.id;
      return <CompactEntityCard key={technician.id} avatar="TK" tone="amber" title={technician.name} subtitle="Teknisi kalibrasi" expanded={expanded} onPress={() => setExpandedTechnicianId(expanded ? null : technician.id)}>
        {technician.isDemo ? <Badge text="Data contoh" tone="wait" /> : null}
        <View style={technicianStyles.phoneBox}><Text style={technicianStyles.phoneLabel}>NOMOR TELEPON</Text><Text style={technicianStyles.phoneValue}>{technician.phone}</Text></View>
        <View style={[styles.actions, technicianStyles.actions]}>
          <View style={technicianStyles.actionButton}><ActionButton title="Ubah data" secondary onPress={() => setEditing({ ...technician })} disabled={locked} /></View>
          <View style={technicianStyles.actionButton}><ActionButton title="Hapus" danger onPress={() => remove(technician)} disabled={locked} /></View>
        </View>
      </CompactEntityCard>;
    })}
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
