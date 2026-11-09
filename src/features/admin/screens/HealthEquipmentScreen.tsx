import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { PickerField } from '../../../components/picker/PickerField';
import { PickerOption } from '../../../components/picker/PickerOption';
import { SearchPickerModal } from '../../../components/picker/SearchPickerModal';
import { ActionButton, Badge, Card, ConfirmModal, Field, Heading } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import { newAdminId, type EquipmentMethod } from '../../../core/admin-data';
import { getCustomEquipmentInstrument, getInstrument, instruments } from '../../../core/instruments';
import type { CustomEquipment } from '../../../core/types';
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
  const [customEditing, setCustomEditing] = useState<CustomEquipment | null>(null);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [standardPickerOpen, setStandardPickerOpen] = useState(false);
  const [standardSearch, setStandardSearch] = useState('');
  const locked = !data.loaded || Boolean(data.storageError);
  const available = instruments.filter((instrument) => !data.equipmentMethods.some((entry) => entry.instrumentId === instrument.id));
  const configured = [
    ...instruments.flatMap((instrument) => {
    const entry = data.equipmentMethods.find((item) => item.instrumentId === instrument.id);
    return entry ? [{ instrument, entry, id: instrument.id, custom: false }] : [];
    }),
    ...data.customEquipment.flatMap((entry) => {
    const instrument = getCustomEquipmentInstrument(entry);
    return instrument ? [{ instrument, entry, id: entry.id, custom: true }] : [];
    }),
  ];
  const normalizedSearch = instrumentSearch.trim().toLowerCase();
  const filteredAvailable = available.filter((instrument) => !normalizedSearch
    || `${instrument.name} ${instrument.subtitle}`.toLowerCase().includes(normalizedSearch));
  const selectedTemplate = customEditing ? getInstrument(customEditing.templateId) : undefined;
  const requiredStandardNames = new Set(selectedTemplate?.standards.map(([name]) => name.trim().toLowerCase()) ?? []);
  const extraStandardNames = [...new Map([...data.devices.filter((device) => !device.weighingStandard).map((device) => device.name.trim()), ...(customEditing?.standardNames ?? [])]
    .filter(Boolean).map((name) => [name.toLowerCase(), name] as const)).values()]
    .filter((name) => !requiredStandardNames.has(name.toLowerCase()));
  const filteredTemplates = instruments.filter((instrument) => !templateSearch.trim()
    || `${instrument.name} ${instrument.subtitle}`.toLowerCase().includes(templateSearch.trim().toLowerCase()));
  const filteredExtraStandards = extraStandardNames.filter((name) => !standardSearch.trim()
    || name.toLowerCase().includes(standardSearch.trim().toLowerCase()));
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
  const addCustom = () => setCustomEditing({ id: '', templateId: '', name: '', method: '', standardNames: [] });
  const selectTemplate = (templateId: string) => {
    setTemplatePickerOpen(false);
    const required = new Set(getInstrument(templateId)?.standards.map(([name]) => name.trim().toLowerCase()) ?? []);
    setCustomEditing((current) => current ? { ...current, templateId, standardNames: current.standardNames.filter((name) => !required.has(name.trim().toLowerCase())) } : current);
  };
  const saveCustom = () => {
    if (!customEditing?.templateId || !getInstrument(customEditing.templateId)) { Alert.alert('Template rumus wajib dipilih', 'Pilih alat yang rumusnya paling sesuai.'); return; }
    if (!customEditing.name.trim()) { Alert.alert('Nama alkes wajib diisi', 'Masukkan nama yang akan ditampilkan ke teknisi.'); return; }
    if (!customEditing.method.trim()) { Alert.alert('Metode kerja wajib diisi', 'Masukkan metode yang akan digunakan pada pekerjaan baru.'); return; }
    const nameKey = customEditing.name.trim().toLowerCase();
    const duplicate = instruments.some((instrument) => instrument.name.trim().toLowerCase() === nameKey)
      || data.customEquipment.some((item) => item.id !== customEditing.id && item.name.trim().toLowerCase() === nameKey);
    if (duplicate) { Alert.alert('Nama alkes sudah digunakan', 'Gunakan nama yang berbeda agar teknisi mudah membedakan alat.'); return; }
    const entry = { ...customEditing, id: customEditing.id || newAdminId('custom-alkes'), name: customEditing.name.trim(), method: customEditing.method.trim(), standardNames: [...new Set(customEditing.standardNames.map((name) => name.trim()).filter(Boolean))] };
    setConfirmation({ title: customEditing.id ? 'Simpan perubahan alkes?' : 'Tambahkan alkes ke katalog?', message: `${entry.name} memakai rumus ${getInstrument(entry.templateId)?.name}. Standar yang dipilih akan tersedia di form teknisi.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveCustomEquipment(entry); setCustomEditing(null); } });
  };
  const removeCustom = (entry: CustomEquipment) => setConfirmation({ title: 'Hapus alkes dari katalog?', message: `${entry.name} tidak tersedia untuk pekerjaan baru. Catatan yang sudah dibuat tetap tersimpan.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => data.deleteCustomEquipment(entry.id) });

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
    <View style={styles.addButtonWrap}><ActionButton title="＋ Tambah alkes dari daftar" onPress={add} disabled={locked || !available.length} /><View style={{ marginTop: 8 }}><ActionButton title="＋ Buat alkes dari template rumus" secondary onPress={addCustom} disabled={locked} /></View></View>
    {!data.loaded ? <Card style={styles.stateCard}><Text style={styles.stateText}>Memuat katalog alkes…</Text></Card> : null}
    {data.loaded && !configured.length ? <Card style={styles.emptyState}>
      <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>＋</Text></View>
      <Text style={styles.emptyTitle}>Belum ada alkes aktif</Text>
      <Text style={styles.stateText}>Tambahkan alat kesehatan dan metode kerja agar teknisi dapat mulai membuat pekerjaan.</Text>
    </Card> : null}
    {configured.map(({ instrument, entry, id, custom }) => <Card key={id} style={styles.catalogCard}>
      <View style={styles.catalogHeader}>
        <View style={styles.catalogAvatar}><Text style={styles.catalogAvatarText}>AK</Text></View>
        <View style={styles.catalogCopy}><Text style={styles.catalogTitle}>{instrument.name}</Text><Text style={styles.catalogSubtitle}>{instrument.subtitle}</Text></View>
        <Badge text="AKTIF" tone="good" />
      </View>
      <View style={styles.methodBlock}>
        <Text style={styles.blockLabel}>METODE KERJA</Text>
        <Text style={styles.methodText} numberOfLines={4}>{entry.method}</Text>
      </View>
      {custom ? <Text style={styles.standardHint}>Rumus mengikuti {getInstrument((entry as CustomEquipment).templateId)?.name}. Nilai acuan inti memakai rumus tersebut.</Text> : null}
      <View style={styles.standardBlock}>
        <View style={styles.standardHeading}><Text style={styles.standardTitle}>Standar yang digunakan</Text><Text style={styles.standardHint}>dipilih teknisi</Text></View>
        <View style={styles.standardChips}>
          {instrument.standards.map(([name]) => <View key={name} style={styles.standardChip}><Text style={styles.standardChipText}>{name}</Text></View>)}
          {instrument.weighingScale ? <View style={styles.standardChip}><Text style={styles.standardChipText}>Anak timbangan · per titik beban</Text></View> : null}
          {!instrument.standards.length && !instrument.weighingScale ? <Text style={styles.noStandard}>Tidak memerlukan standar terdaftar.</Text> : null}
        </View>
      </View>
      <View style={styles.catalogActions}>
        <View style={styles.catalogAction}><ActionButton title={custom ? 'Ubah alkes' : 'Ubah metode'} secondary onPress={() => custom ? setCustomEditing({ ...(entry as CustomEquipment) }) : edit(entry as EquipmentMethod)} disabled={locked} /></View>
        <View style={styles.catalogAction}><ActionButton title="Hapus" danger onPress={() => custom ? removeCustom(entry as CustomEquipment) : remove(entry as EquipmentMethod)} disabled={locked} /></View>
      </View>
    </Card>)}
    <Modal visible={Boolean(customEditing) && !confirmation} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCustomEditing(null)}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}><Text style={styles.deviceModalTitle}>{customEditing?.id ? 'Ubah alkes' : 'Buat alkes dari rumus'}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tutup form alkes" onPress={() => setCustomEditing(null)}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable></View>
          {customEditing ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled"><Card>
            <Heading title="Identitas dan rumus" hint="Pilih alat dengan cara ukur dan satuan yang sama. Titik uji, batas, perhitungan, dan laporan akan mengikuti template." />
            <PickerField label="Template rumus *" value={selectedTemplate?.name} placeholder="Pilih rumus acuan" onPress={() => { setTemplateSearch(''); setTemplatePickerOpen(true); }} />
            <Field label="Nama alkes *" value={customEditing.name} onChange={(name) => setCustomEditing((current) => current ? { ...current, name } : current)} placeholder="Contoh: Timbangan bayi digital" />
            <Field label="Metode kerja *" value={customEditing.method} onChange={(method) => setCustomEditing((current) => current ? { ...current, method } : current)} multiline placeholder="Nomor atau keterangan metode kerja" />
            {selectedTemplate ? <>
              <View style={styles.methodBlock}><Text style={styles.blockLabel}>STANDAR WAJIB DARI RUMUS</Text><View style={styles.standardChips}>{selectedTemplate.standards.map(([name]) => <View key={name} style={styles.standardChip}><Text style={styles.standardChipText}>{name}</Text></View>)}{selectedTemplate.weighingScale ? <View style={styles.standardChip}><Text style={styles.standardChipText}>Anak timbangan per titik beban</Text></View> : null}{!selectedTemplate.standards.length && !selectedTemplate.weighingScale ? <Text style={styles.noStandard}>Tidak ada standar wajib.</Text> : null}</View></View>
              <PickerField label="Standar tambahan untuk pekerjaan (opsional)" value={customEditing.standardNames.length ? `${customEditing.standardNames.length} jenis dipilih` : ''} placeholder="Pilih dari master standar kalibrasi" onPress={() => { setStandardSearch(''); setStandardPickerOpen(true); }} />
              {customEditing.standardNames.length ? <View style={styles.standardChips}>{customEditing.standardNames.map((name) => <View key={name} style={styles.standardChip}><Text style={styles.standardChipText}>{name}</Text></View>)}</View> : null}
              <Text style={styles.modalHint}>Standar wajib berasal dari rumus. Tambahan yang dipilih juga akan diminta dari teknisi. Daftarkan dulu alat ukurnya di menu Standar kalibrasi; teknisi memilih nomor seri saat mulai bekerja.</Text>
            </> : <Text style={styles.modalHint}>Pilih template untuk melihat standar wajibnya.</Text>}
            <View style={styles.actions}><ActionButton title={customEditing.id ? 'Simpan perubahan alkes' : 'Simpan alkes'} onPress={saveCustom} disabled={locked} /><ActionButton title="Batal" secondary onPress={() => setCustomEditing(null)} /></View>
          </Card></ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
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
    <SearchPickerModal visible={templatePickerOpen && Boolean(customEditing)} title="Pilih template rumus" search={templateSearch} placeholder="Cari alat berdasarkan rumus" onSearch={setTemplateSearch} onClose={() => setTemplatePickerOpen(false)}>
      {filteredTemplates.map((instrument, index) => <PickerOption key={instrument.id} index={index + 1} label={instrument.name} detail={instrument.subtitle} selected={customEditing?.templateId === instrument.id} status={customEditing?.templateId === instrument.id ? 'Dipilih' : 'Pilih'} statusTone={customEditing?.templateId === instrument.id ? 'good' : 'neutral'} onPress={() => selectTemplate(instrument.id)} />)}
    </SearchPickerModal>
    <SearchPickerModal visible={standardPickerOpen && Boolean(customEditing)} title="Pilih standar tambahan" search={standardSearch} placeholder="Cari jenis standar" onSearch={setStandardSearch} onClose={() => setStandardPickerOpen(false)}>
      {filteredExtraStandards.map((name, index) => {
        const selected = customEditing?.standardNames.includes(name) ?? false;
        return <PickerOption key={name} index={index + 1} label={name} detail="Dari data Standar kalibrasi" selected={selected} status={selected ? 'Dipilih' : 'Pilih'} statusTone={selected ? 'good' : 'neutral'} onPress={() => setCustomEditing((current) => current ? { ...current, standardNames: selected ? current.standardNames.filter((item) => item !== name) : [...current.standardNames, name] } : current)} />;
      })}
      {!filteredExtraStandards.length ? <Text style={styles.pickerEmpty}>{extraStandardNames.length ? 'Tidak ada jenis standar yang cocok.' : 'Belum ada jenis tambahan. Daftarkan alat ukur di menu Standar kalibrasi terlebih dahulu.'}</Text> : null}
    </SearchPickerModal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
