import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionButton, Badge, Card, Heading } from '../../../components/ui';
import { PickerField } from '../../../components/picker/PickerField';
import { PickerOption } from '../../../components/picker/PickerOption';
import { SearchPickerModal } from '../../../components/picker/SearchPickerModal';
import { ScreenPage } from '../../../components/ScreenPage';
import { calculateRecord } from '../../../core/calculations';
import { getCustomEquipmentInstrument, getRecordInstrument, instruments } from '../../../core/instruments';
import type { Customer } from '../../../core/admin-data';
import { useAdminData } from '../../admin/hooks/useAdminData';
import { useRecords } from '../hooks/useRecords';
import { styles } from '../styles/FormScreenStyles';

function dateLabel(value: string) {
  return value ? value.split('-').reverse().join('-') : 'Tanggal belum diisi';
}

export function FormScreen() {
  const router = useRouter();
  const { records, loaded, storageError, createRecord } = useRecords();
  const directory = useAdminData();
  const [customerId, setCustomerId] = useState('');
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<string[]>([]);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [instrumentPickerOpen, setInstrumentPickerOpen] = useState(false);
  const [instrumentSearch, setInstrumentSearch] = useState('');
  const availableInstruments = instruments.flatMap((instrument) => {
    const method = directory.equipmentMethods.find((item) => item.instrumentId === instrument.id)?.method.trim();
    return method ? [{ instrument, method }] : [];
  }).concat(directory.customEquipment.flatMap((entry) => {
    const instrument = getCustomEquipmentInstrument(entry);
    return instrument ? [{ instrument, method: entry.method }] : [];
  }));
  const customer = directory.customers.find((item) => item.id === customerId);
  const selectedInstruments = selectedInstrumentIds.flatMap((id) => availableInstruments.filter(({ instrument }) => instrument.id === id));
  const filteredCustomers = directory.customers.filter((item) =>
    `${item.name} ${item.city} ${item.province}`.toLowerCase().includes(customerSearch.trim().toLowerCase()));
  const normalizedInstrumentSearch = instrumentSearch.trim().toLowerCase();
  const filteredInstruments = availableInstruments.filter(({ instrument, method }) => !normalizedInstrumentSearch
    || `${instrument.name} ${instrument.subtitle} ${method}`.toLowerCase().includes(normalizedInstrumentSearch));
  const blocked = !loaded || !directory.loaded || Boolean(storageError || directory.storageError);
  const activeTaskGroups = useMemo(() => {
    const groups = new Map<string, {
      customer: string;
      location: string;
      testDate: string;
      updatedAt: string;
      rows: { id: string; instrument: string; details: string; updatedAt: string }[];
    }>();
    for (const record of records) {
      if (record.isDemo) continue;
      const instrument = getRecordInstrument(record);
      if (!instrument || calculateRecord(instrument, record.data).complete) continue;
      const identity = record.data.identity;
      const name = identity.customer || 'Pelanggan belum dipilih';
      const location = identity.city || '';
      const testDate = identity.testDate || '';
      const key = `${testDate}::${name.trim().toLowerCase()}::${location.trim().toLowerCase()}`;
      const row = {
        id: record.id,
        instrument: instrument.name,
        details: [identity.brand, identity.model, identity.serial ? `No. seri ${identity.serial}` : 'No. seri belum diisi'].filter(Boolean).join(' · '),
        updatedAt: record.updatedAt,
      };
      const group = groups.get(key);
      if (group) {
        group.rows.push(row);
        if (record.updatedAt > group.updatedAt) group.updatedAt = record.updatedAt;
      } else groups.set(key, { customer: name, location, testDate, updatedAt: record.updatedAt, rows: [row] });
    }
    return [...groups.entries()]
      .map(([key, group]) => ({ key, ...group }))
      .sort((a, b) => b.testDate.localeCompare(a.testDate) || b.updatedAt.localeCompare(a.updatedAt));
  }, [records]);
  const showNewTaskForm = loaded && !activeTaskGroups.length;

  const toggleInstrument = (id: string) => setSelectedInstrumentIds((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]);

  const startWork = () => {
    if (blocked || !customer || !selectedInstrumentIds.length) return;
    const created = [...selectedInstrumentIds].reverse()
      .flatMap((id) => availableInstruments.filter(({ instrument }) => instrument.id === id))
      .map(({ instrument, method }) => createRecord(instrument, method, customer))
      .filter((id): id is string => Boolean(id));
    if (created.length) {
      setSelectedInstrumentIds([]);
      setCustomerId('');
    }
  };

  return <ScreenPage title="Mulai kalibrasi" hint="Lanjutkan alat yang tertunda, atau buat task baru untuk satu pelanggan.">
    {storageError || directory.storageError ? <Card style={styles.storageWarning}><Text style={styles.warningText}>{storageError || directory.storageError}</Text></Card> : null}

    {!loaded ? <Card><Text style={styles.helperText}>Memeriksa pekerjaan yang belum selesai…</Text></Card> : null}
    {loaded && activeTaskGroups.length ? <Card>
      <Heading title="Pilih alat untuk dikerjakan" hint="Task yang belum selesai ditampilkan di sini. Tekan alat yang mau dilanjutkan; urutannya kamu tentukan sendiri." />
      {activeTaskGroups.map((group) => <View key={group.key} style={styles.taskGroup}>
        <View style={styles.taskGroupHeading}>
          <View style={styles.taskGroupCopy}>
            <Text style={styles.taskCustomer}>{group.customer}</Text>
            <Text style={styles.taskMeta}>{[group.location, dateLabel(group.testDate)].filter(Boolean).join(' · ')}</Text>
          </View>
          <Badge text={`${group.rows.length} alat`} tone="wait" />
        </View>
        {group.rows.map((row) => <Pressable key={row.id} accessibilityRole="button" onPress={() => router.push(`/calibration/${row.id}`)} style={styles.taskRow}>
          <View style={styles.taskRowCopy}>
            <Text style={styles.taskName}>{row.instrument}</Text>
            <Text style={styles.taskDetails}>{row.details}</Text>
          </View>
          <Text style={styles.taskAction}>Kerjakan ›</Text>
        </Pressable>)}
      </View>)}
    </Card> : null}

    {showNewTaskForm ? <>
      <Card>
        <Heading title="1. Pilih pelanggan" hint="Pelanggan terpilih akan terisi otomatis di setiap draft alat." />
        <PickerField
          label="Pelanggan"
          value={customer ? `${customer.name} · ${customer.city}` : ''}
          placeholder={directory.loaded ? 'Pilih rumah sakit / klinik' : 'Memuat pelanggan…'}
          disabled={!directory.loaded || !directory.customers.length || Boolean(directory.storageError)}
          onPress={() => { setCustomerSearch(''); setCustomerPickerOpen(true); }}
        />
        {directory.loaded && !directory.customers.length ? <Text style={styles.helperText}>Belum ada pelanggan. Admin perlu menambahkannya di menu Data pelanggan.</Text> : null}
      </Card>

      <Card>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionCopy}><Heading title="2. Pilih alat yang dikalibrasi" hint="Cari lalu pilih satu atau beberapa jenis alat untuk pelanggan ini." /></View>
          <Badge text={`${selectedInstrumentIds.length} dipilih`} tone={selectedInstrumentIds.length ? 'good' : 'neutral'} />
        </View>
        {!directory.loaded ? <Text style={styles.helperText}>Memuat Katalog Alkes…</Text> : null}
        {directory.loaded && !availableInstruments.length ? <Text style={styles.helperText}>Katalog Alkes belum tersedia. Minta admin menyiapkan jenis alat dan metode kerja.</Text> : null}
        <PickerField
          label="Jenis alat kesehatan"
          value={selectedInstruments.length ? `${selectedInstruments.length} jenis alat dipilih` : ''}
          placeholder="Cari dan pilih jenis alat"
          disabled={blocked || !customer || !availableInstruments.length}
          onPress={() => { setInstrumentSearch(''); setInstrumentPickerOpen(true); }}
        />
        {!customer ? <Text style={styles.helperText}>Pilih pelanggan terlebih dahulu untuk memilih alat.</Text> : null}
        {selectedInstruments.map(({ instrument, method }) => <View key={instrument.id} style={styles.selectedInstrument}>
          <View style={styles.selectedInstrumentCopy}>
            <Text style={styles.selectedInstrumentName}>{instrument.name}</Text>
            <Text style={styles.selectedInstrumentMethod}>{method}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Hapus ${instrument.name}`} onPress={() => toggleInstrument(instrument.id)}><Text style={styles.removeSelection}>Hapus</Text></Pressable>
        </View>)}
      </Card>

      <Card style={styles.startCard}>
        <Text style={styles.startSummary}>{selectedInstrumentIds.length
          ? `${selectedInstrumentIds.length} draft akan dibuat untuk ${customer?.name ?? 'pelanggan terpilih'}. Setelah disimpan, pilih alat yang mau dikerjakan dulu.`
          : 'Pilih pelanggan dan minimal satu jenis alat untuk membuat task.'}</Text>
        <ActionButton
          title={selectedInstrumentIds.length ? `Buat draft · ${selectedInstrumentIds.length} alat` : 'Buat draft pengerjaan'}
          onPress={startWork}
          disabled={blocked || !customer || !selectedInstrumentIds.length}
        />
      </Card>
    </> : null}

    <SearchPickerModal
      visible={customerPickerOpen}
      title="Pilih pelanggan"
      search={customerSearch}
      placeholder="Cari nama rumah sakit atau kota"
      onSearch={setCustomerSearch}
      onClose={() => setCustomerPickerOpen(false)}
    >
      {filteredCustomers.length ? filteredCustomers.map((item: Customer, index) => <PickerOption
        key={item.id}
        index={index + 1}
        label={item.name}
        detail={`${item.city} · ${item.province}`}
        selected={customerId === item.id}
        status={customerId === item.id ? 'Dipilih' : 'Pilih'}
        statusTone={customerId === item.id ? 'good' : 'neutral'}
        onPress={() => { setCustomerId(item.id); setCustomerPickerOpen(false); }}
      />) : <Text style={styles.emptySearch}>{directory.customers.length ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada data pelanggan.'}</Text>}
    </SearchPickerModal>
    <SearchPickerModal
      visible={instrumentPickerOpen}
      title="Pilih jenis alat"
      search={instrumentSearch}
      placeholder="Cari nama alat atau metode kerja"
      onSearch={setInstrumentSearch}
      onClose={() => setInstrumentPickerOpen(false)}
    >
      {filteredInstruments.length ? filteredInstruments.map(({ instrument, method }, index) => {
        const selected = selectedInstrumentIds.includes(instrument.id);
        return <PickerOption
          key={instrument.id}
          index={index + 1}
          label={instrument.name}
          detail={instrument.subtitle}
          selected={selected}
          status={selected ? 'Dipilih' : 'Pilih'}
          statusTone={selected ? 'good' : 'neutral'}
          onPress={() => toggleInstrument(instrument.id)}
        ><Text style={styles.methodText}>{method}</Text></PickerOption>;
      }) : <Text style={styles.emptySearch}>{availableInstruments.length ? 'Tidak ada alat yang cocok.' : 'Belum ada jenis alat dengan metode kerja.'}</Text>}
    </SearchPickerModal>
  </ScreenPage>;
}
