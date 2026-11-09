import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, CompactEntityCard, ConfirmModal, Field, Heading, SearchField } from '../../../components/ui';
import { newAdminId } from '../../../core/admin-data';
import { useAdminData } from '../hooks/useAdminData';
import type { Customer } from '../../../core/admin-data';
import { ScreenPage } from '../../../components/ScreenPage';
import { CustomerLocationFields } from '../components/CustomerLocationFields';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import { styles as customerStyles } from '../styles/CustomersScreenStyles';
import type { Confirmation } from '../types/Confirmation';



const blankCustomer = (): Customer => ({ id: '', name: '', province: '', provinceId: '', city: '', cityId: '', district: '', districtId: '', village: '', villageId: '', address: '', contacts: [{ id: newAdminId('pic'), name: '', phone: '' }], isDemo: false });













export function CustomersScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<Customer | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState('');
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const locked = !data.loaded || Boolean(data.storageError);
  const query = search.trim().toLowerCase();
  const filteredCustomers = data.customers.filter((customer) => [
    customer.name, customer.province, customer.city, customer.district, customer.village, customer.address,
    ...customer.contacts.flatMap((contact) => [contact.name, contact.phone]),
  ].join(' ').toLowerCase().includes(query));
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
    <View style={customerStyles.listHeader}>
      <View><Text style={customerStyles.listTitle}>Daftar pelanggan</Text><Text style={customerStyles.listSubtitle}>{query ? `${filteredCustomers.length} dari ${data.customers.length} pelanggan` : 'Lokasi kalibrasi yang tersimpan'}</Text></View>
      <View style={customerStyles.listCount}><Text style={customerStyles.listCountText}>{data.customers.length}</Text></View>
    </View>
    <SearchField accessibilityLabel="Cari pelanggan" value={search} onChange={(value) => { setSearch(value); setExpandedCustomerId(null); }} placeholder="Cari rumah sakit, lokasi, atau PIC" />
    <View style={customerStyles.addAction}><ActionButton title="＋ Tambah pelanggan" onPress={() => setEditing(blankCustomer())} disabled={locked} /></View>

    {!filteredCustomers.length ? <Card style={customerStyles.emptyCard}>
      <View style={customerStyles.emptyMark}><Text style={customerStyles.emptyMarkText}>RS</Text></View>
      <Text style={customerStyles.emptyTitle}>{data.customers.length ? 'Pelanggan tidak ditemukan' : 'Belum ada pelanggan'}</Text>
      <Text style={customerStyles.emptyHint}>{data.customers.length ? 'Coba kata kunci lain atau hapus pencarian.' : 'Tambahkan data rumah sakit dan PIC untuk mulai membuat pengerjaan kalibrasi.'}</Text>
      {search ? <ActionButton title="Hapus pencarian" secondary onPress={() => setSearch('')} /> : null}
    </Card> : filteredCustomers.map((customer) => {
      const expanded = expandedCustomerId === customer.id;
      return <CompactEntityCard key={customer.id} avatar="RS" title={customer.name} subtitle={`${customer.city} · ${customer.province}`} expanded={expanded} onPress={() => setExpandedCustomerId(expanded ? null : customer.id)}>
          {customer.isDemo ? <Badge text="Data contoh" tone="wait" /> : null}
          <View style={customerStyles.addressBlock}>
            <Text style={customerStyles.sectionLabel}>ALAMAT LENGKAP</Text>
            <Text style={customerStyles.addressText}>{customer.address}</Text>
            <Text style={customerStyles.addressMeta}>{customer.village}, {customer.district} · {customer.city}, {customer.province}</Text>
          </View>
          <View style={customerStyles.contactsHeader}><Text style={customerStyles.contactsTitle}>Kontak PIC</Text><Text style={customerStyles.contactsCount}>{customer.contacts.length}</Text></View>
          <View style={customerStyles.picList}>{customer.contacts.map((contact) => <View key={contact.id} style={customerStyles.picRow}>
            <View style={customerStyles.picMark}><Text style={customerStyles.picMarkText}>{contact.name.trim().slice(0, 1).toUpperCase() || 'P'}</Text></View>
            <View style={customerStyles.picCopy}><Text style={customerStyles.picName}>{contact.name}</Text><Text style={customerStyles.picPhone}>{contact.phone}</Text></View>
          </View>)}</View>
          <View style={[styles.actions, customerStyles.actions]}>
            <View style={customerStyles.actionButton}><ActionButton title="Ubah data" secondary onPress={() => setEditing({ ...customer, contacts: customer.contacts.map((contact) => ({ ...contact })) })} disabled={locked} /></View>
            <View style={customerStyles.actionButton}><ActionButton title="Hapus" danger onPress={() => remove(customer)} disabled={locked} /></View>
          </View>
      </CompactEntityCard>;
    })}
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
