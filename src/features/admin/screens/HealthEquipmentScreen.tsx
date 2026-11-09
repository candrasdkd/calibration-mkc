import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PickerField } from '../../../components/picker/PickerField';
import { PickerOption } from '../../../components/picker/PickerOption';
import { SearchPickerModal } from '../../../components/picker/SearchPickerModal';
import { ActionButton, Badge, Card, ConfirmModal, Field, Heading } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import type { EquipmentMethod } from '../../../core/admin-data';
import { getInstrument, instruments } from '../../../core/instruments';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/HealthEquipmentScreenStyles';
import type { Confirmation } from '../types/Confirmation';

export function HealthEquipmentScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<EquipmentMethod | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [instrumentPickerOpen, setInstrumentPickerOpen] = useState(false);
  const [instrumentSearch, setInstrumentSearch] = useState('');
  const locked = !data.loaded || Boolean(data.storageError);
  const available = instruments.filter((instrument) => !data.equipmentMethods.some((entry) => entry.instrumentId === instrument.id));
  const configured = instruments.flatMap((instrument) => {
    const entry = data.equipmentMethods.find((item) => item.instrumentId === instrument.id);
    return entry ? [{ instrument, entry }] : [];
  });
  const normalizedSearch = instrumentSearch.trim().toLowerCase();
  const filteredAvailable = available.filter((instrument) => !normalizedSearch
    || `${instrument.name} ${instrument.subtitle}`.toLowerCase().includes(normalizedSearch));
  const add = () => { setIsNew(true); setEditing({ instrumentId: '', method: '' }); };
  const openInstrumentPicker = () => { setInstrumentSearch(''); setInstrumentPickerOpen(true); };
  const selectNewInstrument = (instrumentId: string) => {
    setInstrumentPickerOpen(false);
    setEditing((current) => current ? { ...current, instrumentId } : current);
  };
  const edit = (entry: EquipmentMethod) => { setIsNew(false); setEditing({ ...entry }); };
  const closeEditor = () => setEditing(null);
  const save = () => {
    if (!editing?.instrumentId) { Alert.alert('Alat kesehatan wajib dipilih', 'Pilih jenis alat yang akan disiapkan untuk teknisi.'); return; }
    if (!editing.method.trim()) { Alert.alert('Metode kerja wajib diisi', 'Masukkan metode kerja sebelum menyimpan katalog.'); return; }
    if (isNew && data.equipmentMethods.some((entry) => entry.instrumentId === editing.instrumentId)) { Alert.alert('Alat sudah terdaftar', 'Ubah metode kerja dari katalog yang sudah ada.'); return; }
    const instrument = getInstrument(editing.instrumentId);
    if (!instrument) { Alert.alert('Jenis alat tidak dikenal', 'Pilih salah satu jenis alat yang didukung.'); return; }
    const entry = { instrumentId: editing.instrumentId, method: editing.method.trim() };
    setConfirmation({ title: isNew ? 'Tambahkan alkes ke katalog?' : 'Simpan metode kerja?', message: `Metode ${instrument.name} akan digunakan untuk kalibrasi baru oleh teknisi.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveEquipmentMethod(entry); closeEditor(); } });
  };
  const remove = (entry: EquipmentMethod) => {
    const instrument = getInstrument(entry.instrumentId);
    setConfirmation({ title: 'Hapus dari katalog?', message: `${instrument?.name ?? 'Alat kesehatan'} tidak tersedia untuk pekerjaan baru. Catatan yang sudah dibuat tetap tersimpan.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => data.deleteEquipmentMethod(entry.instrumentId) });
  };

  return <ScreenPage title="Katalog Alkes" hint="Atur alat kesehatan yang bisa dikerjakan teknisi beserta metode kerjanya.">
    <StorageMessage message={data.storageError} />
    <View style={styles.catalogOverview}>
      <View style={styles.overviewTop}>
        <View style={styles.overviewMark}><Text style={styles.overviewMarkText}>AK</Text></View>
        <View style={styles.overviewCopy}>
          <Text style={styles.overviewEyebrow}>PENGELOLAAN ALAT</Text>
          <Text style={styles.overviewTitle}>Alat dan metode kerja</Text>
        </View>
      </View>
      <Text style={styles.overviewHint}>Metode yang disimpan akan otomatis dipakai pada pekerjaan baru teknisi.</Text>
      <View style={styles.overviewStats}>
        <View style={styles.overviewStat}><Text style={styles.overviewValue}>{configured.length}</Text><Text style={styles.overviewLabel}>Siap dikerjakan</Text></View>
        <View style={styles.overviewDivider} />
        <View style={styles.overviewStat}><Text style={styles.overviewValue}>{available.length}</Text><Text style={styles.overviewLabel}>Belum disiapkan</Text></View>
      </View>
    </View>
    <View style={styles.catalogSectionHeader}>
      <View><Text style={styles.catalogSectionTitle}>Daftar alat</Text><Text style={styles.catalogSectionHint}>{configured.length} metode aktif</Text></View>
      <Text style={styles.catalogSectionMark}>KATALOG</Text>
    </View>
    <View style={styles.addButtonWrap}><ActionButton title="＋ Tambah alat kesehatan" onPress={add} disabled={locked || !available.length} /></View>
    {!data.loaded ? <Card style={styles.stateCard}><Text style={styles.stateText}>Memuat katalog alkes…</Text></Card> : null}
    {data.loaded && !configured.length ? <Card style={styles.emptyState}>
      <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>＋</Text></View>
      <Text style={styles.emptyTitle}>Belum ada alkes aktif</Text>
      <Text style={styles.stateText}>Tambahkan alat kesehatan dan metode kerja agar teknisi dapat mulai membuat pekerjaan.</Text>
    </Card> : null}
    {configured.map(({ instrument, entry }) => <Card key={entry.instrumentId} style={styles.catalogCard}>
      <View style={styles.catalogHeader}>
        <View style={styles.catalogAvatar}><Text style={styles.catalogAvatarText}>AK</Text></View>
        <View style={styles.catalogCopy}><Text style={styles.catalogTitle}>{instrument.name}</Text><Text style={styles.catalogSubtitle}>{instrument.subtitle}</Text></View>
        <Badge text="AKTIF" tone="good" />
      </View>
      <View style={styles.methodBlock}>
        <Text style={styles.blockLabel}>METODE KERJA</Text>
        <Text style={styles.methodText} numberOfLines={4}>{entry.method}</Text>
      </View>
      <View style={styles.standardBlock}>
        <View style={styles.standardHeading}><Text style={styles.standardTitle}>Standar yang digunakan</Text><Text style={styles.standardHint}>dipilih teknisi</Text></View>
        <View style={styles.standardChips}>
          {instrument.standards.map(([name]) => <View key={name} style={styles.standardChip}><Text style={styles.standardChipText}>{name}</Text></View>)}
          {instrument.weighingScale ? <View style={styles.standardChip}><Text style={styles.standardChipText}>Anak timbangan · per titik beban</Text></View> : null}
          {!instrument.standards.length && !instrument.weighingScale ? <Text style={styles.noStandard}>Tidak memerlukan standar terdaftar.</Text> : null}
        </View>
      </View>
      <View style={styles.catalogActions}>
        <View style={styles.catalogAction}><ActionButton title="Ubah metode" secondary onPress={() => edit(entry)} disabled={locked} /></View>
        <View style={styles.catalogAction}><ActionButton title="Hapus" danger onPress={() => remove(entry)} disabled={locked} /></View>
      </View>
    </Card>)}
    <Modal visible={Boolean(editing) && !confirmation} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeEditor}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}><Text style={styles.deviceModalTitle}>{isNew ? 'Tambah alat kesehatan' : 'Ubah metode kerja'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tutup form Katalog Alkes" onPress={closeEditor}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable></View>
          {editing ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled"><Card>
            <Heading title="Informasi alat kesehatan" hint="Pilih alat, lalu tentukan metode kerja yang akan diterapkan pada pekerjaan baru." />
            {isNew ? <PickerField label="Alat kesehatan *" value={getInstrument(editing.instrumentId)?.name} placeholder="Pilih alat kesehatan" onPress={openInstrumentPicker} /> : <View style={styles.selectedInstrument}><Text style={styles.blockLabel}>ALAT KESEHATAN</Text><Text style={styles.selectedInstrumentName}>{getInstrument(editing.instrumentId)?.name}</Text></View>}
            {isNew && editing.instrumentId ? <View style={styles.methodBlock}><Text style={styles.blockLabel}>STANDAR UNTUK PEKERJAAN INI</Text><View style={styles.standardChips}>{getInstrument(editing.instrumentId)?.standards.map(([name]) => <View key={name} style={styles.standardChip}><Text style={styles.standardChipText}>{name}</Text></View>)}{getInstrument(editing.instrumentId)?.weighingScale ? <View style={styles.standardChip}><Text style={styles.standardChipText}>Anak timbangan per titik beban</Text></View> : null}{!getInstrument(editing.instrumentId)?.standards.length && !getInstrument(editing.instrumentId)?.weighingScale ? <Text style={styles.noStandard}>Tidak ada standar khusus.</Text> : null}</View><Text style={styles.standardHint}>Nomor seri dipilih teknisi saat mengerjakan.</Text></View> : null}
            <Field label="Metode kerja *" value={editing.method} onChange={(method) => setEditing((current) => current ? { ...current, method } : current)} multiline />
            <Text style={styles.modalHint}>Metode ini otomatis disalin ke pekerjaan baru. Rumus dan standar mengikuti alat yang dipilih.</Text>
            <View style={styles.actions}><ActionButton title="Simpan metode kerja" onPress={save} disabled={locked} /><ActionButton title="Batal" secondary onPress={closeEditor} /></View>
          </Card></ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <SearchPickerModal visible={instrumentPickerOpen && Boolean(editing) && isNew} title="Pilih alat kesehatan" search={instrumentSearch} placeholder="Cari nama alat kesehatan" onSearch={setInstrumentSearch} onClose={() => setInstrumentPickerOpen(false)}>
      {filteredAvailable.length ? filteredAvailable.map((instrument, index) => <PickerOption
        key={instrument.id}
        index={index + 1}
        label={instrument.name}
        detail={instrument.subtitle}
        selected={editing?.instrumentId === instrument.id}
        status={editing?.instrumentId === instrument.id ? 'Dipilih' : 'Pilih'}
        statusTone={editing?.instrumentId === instrument.id ? 'good' : 'neutral'}
        onPress={() => selectNewInstrument(instrument.id)}
      />) : <Text style={styles.pickerEmpty}>{available.length ? 'Tidak ada alat yang cocok dengan pencarian.' : 'Semua alat sudah ditambahkan ke katalog.'}</Text>}
    </SearchPickerModal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
