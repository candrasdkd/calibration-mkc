import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, ConfirmModal, Field, Heading } from '../../../components/ui';
import { newAdminId } from '../../../core/admin-data';
import { useAdminData } from '../hooks/useAdminData';
import type { Customer } from '../../../core/admin-data';
import { ScreenPage } from '../../../components/ScreenPage';
import { CustomerLocationFields } from '../components/CustomerLocationFields';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';



const blankCustomer = (): Customer => ({ id: '', name: '', province: '', provinceId: '', city: '', cityId: '', district: '', districtId: '', village: '', villageId: '', address: '', contacts: [{ id: newAdminId('pic'), name: '', phone: '' }], isDemo: false });













export function CustomersScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const locked = !data.loaded || Boolean(data.storageError);
  const save = () => {
    if (!editing?.name.trim() || !editing.province.trim() || !editing.city.trim() || !editing.district.trim() || !editing.village.trim() || !editing.address.trim()) {
      Alert.alert('Data belum lengkap', 'Isi nama rumah sakit dan alamat sampai kelurahan.'); return;
    }
    if (!editing.contacts.length || editing.contacts.some((contact) => !contact.name.trim() || !contact.phone.trim())) {
      Alert.alert('Data PIC belum lengkap', 'Isi nama dan nomor telepon setiap PIC, atau hapus baris PIC yang kosong.'); return;
    }
    const customer = editing;
    setConfirmation({ title: customer.id ? 'Simpan perubahan pelanggan?' : 'Tambahkan pelanggan?', message: `${customer.name} akan disimpan di data pelanggan.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveCustomer(customer); setEditing(null); } });
  };
  const remove = (customer: Customer) => setConfirmation({ title: 'Hapus pelanggan?', message: `Data ${customer.name} akan dihapus dari daftar.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => data.deleteCustomer(customer.id) });

  return <ScreenPage title="Data pelanggan" hint="Kelola alamat rumah sakit dan satu atau beberapa PIC.">
    <StorageMessage message={data.storageError} />
    <ActionButton title="＋ Tambah pelanggan" onPress={() => setEditing(blankCustomer())} disabled={locked} />

    {data.customers.map((customer) => <Card key={customer.id} style={styles.entityCard}>
      <View style={styles.entityHeader}>
        <View style={[styles.entityAvatar, styles.customerAvatar]}><Text style={styles.entityAvatarText}>RS</Text></View>
        <View style={styles.entityCopy}><Text style={styles.entityTitle}>{customer.name}</Text><Text style={styles.entitySubtitle}>{customer.city} · {customer.province}</Text></View>
        {customer.isDemo ? <Badge text="Contoh" tone="wait" /> : null}
      </View>
      <View style={styles.addressBlock}><Text style={styles.blockLabel}>ALAMAT LOKASI</Text><Text style={styles.blockText}>{customer.address}</Text><Text style={styles.blockMeta}>{customer.district} · {customer.village}</Text></View>
      <View style={styles.picList}>{customer.contacts.map((contact) => <View key={contact.id} style={styles.picChip}><Text style={styles.picName}>{contact.name}</Text><Text style={styles.picPhone}>{contact.phone}</Text></View>)}</View>
      <View style={styles.actions}><ActionButton title="Ubah data" secondary onPress={() => setEditing({ ...customer, contacts: customer.contacts.map((contact) => ({ ...contact })) })} disabled={locked} /><ActionButton title="Hapus" danger onPress={() => remove(customer)} disabled={locked} /></View>
    </Card>)}
    <Modal visible={Boolean(editing)} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditing(null)}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}>
            <Text style={styles.deviceModalTitle}>{editing?.id ? 'Ubah pelanggan' : 'Pelanggan baru'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup form pelanggan" onPress={() => setEditing(null)}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable>
          </View>
          {editing ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled">
            <Card>
              <Heading title="Informasi rumah sakit" hint="Masukkan alamat lengkap agar teknisi dapat menemukan lokasi pengerjaan." />
              <Field label="Nama rumah sakit" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
              <CustomerLocationFields customer={editing} onChange={(patch) => setEditing((current) => current ? { ...current, ...patch } : current)} />
              <Field label="Alamat lengkap" value={editing.address} onChange={(address) => setEditing({ ...editing, address })} multiline />
            </Card>
            <Card>
              <Heading title="Kontak PIC" hint="Tambahkan satu atau beberapa orang yang bisa dihubungi." />
              {editing.contacts.map((contact, index) => <View key={contact.id} style={styles.contact}>
                <Text style={styles.contactTitle}>PIC {index + 1}</Text>
                <Field label="Nama PIC" value={contact.name} onChange={(name) => setEditing({ ...editing, contacts: editing.contacts.map((item) => item.id === contact.id ? { ...item, name } : item) })} />
                <Field label="Nomor PIC" value={contact.phone} onChange={(phone) => setEditing({ ...editing, contacts: editing.contacts.map((item) => item.id === contact.id ? { ...item, phone } : item) })} keyboard="phone-pad" />
                <ActionButton title="Hapus PIC" secondary danger onPress={() => setConfirmation({ title: 'Hapus kontak PIC?', message: `${contact.name || 'Kontak ini'} akan dihapus dari data pelanggan.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => setEditing((current) => current ? { ...current, contacts: current.contacts.filter((item) => item.id !== contact.id) } : current) })} />
              </View>)}
              <ActionButton title="＋ Tambah PIC" secondary onPress={() => setEditing({ ...editing, contacts: [...editing.contacts, { id: newAdminId('pic'), name: '', phone: '' }] })} />
              <View style={styles.actions}><ActionButton title="Simpan pelanggan" onPress={save} disabled={locked} /><ActionButton title="Batal" secondary onPress={() => setEditing(null)} /></View>
            </Card>
          </ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
