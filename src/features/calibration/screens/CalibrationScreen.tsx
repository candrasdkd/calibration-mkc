import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, Badge, Card, Choice, DateField, Field, Heading, ValueLine } from '../../../components/ui';
import { PickerField } from '../../../components/picker/PickerField';
import { PickerOption } from '../../../components/picker/PickerOption';
import { SearchPickerModal } from '../../../components/picker/SearchPickerModal';
import { calculateRecord } from '../../../core/calculations';
import { getInstrument } from '../../../core/instruments';
import { useAdminData } from '../../admin/hooks/useAdminData';
import { useRecords } from '../../work-orders/hooks/useRecords';
import type { Customer, MeasuringDevice, ThermohygrometerCertificate } from '../../../core/admin-data';
import { styles } from '../styles/CalibrationScreenStyles';
import type { FieldUpdate, InspectionUpdate, PerformanceUpdate } from '../types/CalibrationForm';
import type {
  CalculationResult,
  CalibrationData,
  CalibrationRecord,
  IdentityData,
  InspectionEntry,
  Instrument,
  SafetyResult,
  SelectedMeasurementDevice,
  Thermohygrometer,
} from '../../../core/types';

const steps = ['Identitas', 'Pilih alat ukur', 'Pengujian', 'Hasil'];




const fmt = (value: number | null | undefined, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

function ScreenHeader({ instrument, onBack, onFormula }: { instrument: Instrument; onBack: () => void; onFormula: () => void }) {
  return <View style={styles.screenHeader}>
    <Pressable accessibilityRole="button" accessibilityLabel="Kembali ke catatan" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable>
    <View style={styles.screenHeaderText}><Text style={styles.screenTitle}>{instrument.name}</Text><Text style={styles.screenSub}>Lembar kerja kalibrasi</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Buka rumus dan standar" onPress={onFormula} style={styles.formulaShortcut}><Text style={styles.formulaShortcutText}>ƒx</Text></Pressable>
    <View style={styles.localTag}><Text style={styles.localTagText}>LOKAL</Text></View>
  </View>;
}

function StepTabs({ current, onChange }: { current: number; onChange: (step: number) => void }) {
  return <View style={styles.stepProgress}>
    <View style={styles.stepProgressHeading}><Text style={styles.stepCounter}>LANGKAH {String(current + 1).padStart(2, '0')} / {steps.length}</Text><Text style={styles.stepCurrentTitle}>{steps[current]}</Text></View>
    <View style={styles.stepTrack}>
      <View style={styles.progressLine}><View style={[styles.progressFill, { width: `${(current / (steps.length - 1)) * 100}%` }]} /></View>
      {steps.map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: current === index }} onPress={() => onChange(index)} style={styles.stepNode}>
        <View style={[styles.stepCircle, index < current && styles.stepCircleDone, current === index && styles.stepCircleCurrent]}><Text style={[styles.stepNumber, (index <= current) && styles.stepNumberCurrent]}>{index + 1}</Text></View>
        <Text style={[styles.stepLabel, current === index && styles.stepLabelCurrent]} numberOfLines={1}>{label === 'Pilih alat ukur' ? 'Alat ukur' : label}</Text>
      </Pressable>)}
    </View>
  </View>;
}

function CustomerPicker({ customers, value, loaded, onChange }: { customers: Customer[]; value: string; loaded: boolean; onChange: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [search, setSearch] = useState('');
  const selected = customers.find((customer) => customer.id === value);
  const query = search.trim().toLowerCase();
  const filtered = customers.filter((customer) => [customer.name, customer.city, customer.province].some((item) => item.toLowerCase().includes(query)));
  const close = () => setVisible(false);

  return <>
    <PickerField label="Pelanggan *" value={selected ? `${selected.name} · ${selected.city}` : ''} placeholder="Pilih rumah sakit" disabled={!loaded || !customers.length} onPress={() => { setSearch(''); setVisible(true); }} />
    <SearchPickerModal visible={visible} title="Pilih pelanggan" search={search} placeholder="Cari nama rumah sakit atau kota" onSearch={setSearch} onClose={close}>
      {filtered.length ? <View style={styles.deviceGroup}>
        <View style={styles.deviceGroupHeader}><View style={styles.deviceGroupCopy}><Text style={styles.deviceGroupName}>Daftar pelanggan</Text><Text style={styles.deviceGroupMeta}>{filtered.length} rumah sakit ditemukan</Text></View><Badge text={String(filtered.length)} /></View>
        <View style={styles.deviceSerialList}>{filtered.map((customer, index) => {
          const isSelected = customer.id === value;
          return <PickerOption key={customer.id} index={index + 1} label={customer.name} detail={`${customer.city} · ${customer.province}`} selected={isSelected} status={isSelected ? 'Dipilih' : 'Pilih'} statusTone={isSelected ? 'good' : 'neutral'} accessibilityLabel={`${customer.name}, ${customer.city}, ${customer.province}`} onPress={() => { onChange(customer.id); close(); }} />;
        })}</View>
      </View> : <Text style={styles.devicePickerEmpty}>{query ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada data pelanggan.'}</Text>}
    </SearchPickerModal>
  </>;
}

function IdentityStep({ data, customers, loaded, update, selectCustomer }: { data: CalibrationData; customers: Customer[]; loaded: boolean; update: FieldUpdate; selectCustomer: (id: string) => void }) {
  const fields: [keyof IdentityData, string][] = [
    ['labelNumber', 'Nomor label *'], ['brand', 'Merek *'],
    ['model', 'Tipe / model *'], ['serial', 'Nomor seri *'], ['capacity', 'Kapasitas'], ['accuracy', 'Tingkat ketelitian'],
    ['technician', 'Petugas pelaksana *'], ['receivedDate', 'Tanggal penerimaan'], ['testDate', 'Tanggal pelaksanaan *'],
    ['room', 'Ruang pelaksanaan *'], ['method', 'Metode kerja *'],
  ];
  return <>
    <Card><Heading title="Identitas alat" hint="Isi nomor label, pelanggan, dan informasi alat. Metode kerja otomatis terisi dari data admin." />
      {fields.slice(0, 6).map(([key, label]) => <Field key={key} label={label} value={data.identity[key]} onChange={(value) => update('identity', key, value)} />)}
    </Card>
    <Card><Heading title="Pelaksanaan dan pelanggan" hint="Pilih pelanggan yang sudah didaftarkan admin. Ketuk tanggal untuk membuka kalender." />
      {!loaded ? <Text style={styles.deviceHint}>Memuat data pelanggan…</Text> : customers.length ? <CustomerPicker customers={customers} value={data.identity.customerId || customers.find((customer) => customer.name === data.identity.customer)?.id || ''} loaded={loaded} onChange={selectCustomer} /> : <Text style={styles.errorText}>Belum ada data pelanggan. Admin perlu menambahkan pelanggan terlebih dahulu.</Text>}
      {data.identity.customer ? <><ValueLine label="Alamat pelanggan" value={data.identity.address} /><ValueLine label="Kota / kabupaten" value={data.identity.city} /></> : null}
      {fields.slice(6).map(([key, label]) => key.endsWith('Date')
        ? <DateField key={key} label={label} value={data.identity[key]} onChange={(value) => update('identity', key, value)} />
        : <Field key={key} label={label} value={data.identity[key]} onChange={(value) => update('identity', key, value)} editable={key !== 'method'} multiline={key === 'method'} />)}
      <Text style={styles.deviceHint}>Metode kerja dikelola admin di menu Data alat kesehatan.</Text>
    </Card>
  </>;
}

function thermohygrometerProfile(device: MeasuringDevice): Thermohygrometer | null {
  if (!device.isThermohygrometer || !device.certificate) return null;
  const number = (value: string) => value.trim() ? Number(value.replace(',', '.')) : Number.NaN;
  const points = (items: ThermohygrometerCertificate['temperature']) => {
    const result = items.map((point) => ({ value: number(point.value), correction: number(point.correction) }));
    return result.length >= 2 && result.every((point, index) => Number.isFinite(point.value) && Number.isFinite(point.correction)
      && (index === 0 || point.value > result[index - 1].value)) ? result : null;
  };
  const temperature = points(device.certificate.temperature);
  const humidity = points(device.certificate.humidity);
  const temperatureU95 = number(device.certificate.temperatureU95);
  const humidityU95 = number(device.certificate.humidityU95);
  return temperature && humidity && Number.isFinite(temperatureU95) && Number.isFinite(humidityU95)
    ? { id: device.id, serial: device.serial, temperature, humidity, temperatureU95, humidityU95 }
    : null;
}

function deviceSnapshot(device: MeasuringDevice): SelectedMeasurementDevice {
  return { id: device.id, name: device.name, brand: device.brand, model: device.model, serial: device.serial };
}

const deviceNameKey = (name: string) => name.trim().toLowerCase();

function SelectDevicesStep({ data, devices, loaded, onToggle, onReference }: {
  data: CalibrationData;
  devices: MeasuringDevice[];
  loaded: boolean;
  onToggle: (device: SelectedMeasurementDevice, profile: Thermohygrometer | null) => void;
  onReference: (profile: Thermohygrometer) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const selected = data.selectedDevices ?? [];
  const availableDevices = loaded ? devices : [];
  const selectedIds = new Set(selected.map((device) => device.id));
  const normalizedSearch = search.trim().toLowerCase();
  const deviceGroups = [...new Set(availableDevices.map((device) => deviceNameKey(device.name)))].map((key) => {
    const groupDevices = availableDevices.filter((device) => deviceNameKey(device.name) === key);
    const matchesName = groupDevices[0]?.name.toLowerCase().includes(normalizedSearch);
    const matchingDevices = groupDevices.filter((device) => !normalizedSearch || matchesName
      || [device.serial, device.brand, device.model].some((value) => value.toLowerCase().includes(normalizedSearch)));
    return { key, name: groupDevices[0]?.name ?? key, devices: matchingDevices, count: groupDevices.length };
  }).filter((group) => group.devices.length);
  const thermometers = availableDevices.map((device) => ({ device, profile: thermohygrometerProfile(device) }))
    .filter((item) => selectedIds.has(item.device.id) && item.profile);
  const missing = loaded ? selected.filter((device) => !devices.some((item) => item.id === device.id)) : [];
  const matchingMissing = missing.filter((device) => !normalizedSearch
    || [device.name, device.brand, device.model, device.serial].some((value) => value.toLowerCase().includes(normalizedSearch)));
  return <>
    <Card>
      <Heading title="Pilih alat ukur" hint="Pilih semua alat standar yang dipakai untuk pengerjaan ini. Alat yang sama hanya bisa dipilih satu kali." />
      {!loaded ? <Text style={styles.deviceHint}>Memuat data alat ukur…</Text> : null}
      {loaded && !devices.length ? <Text style={styles.deviceHint}>Belum ada alat ukur. Minta admin menambahkannya di menu Data alat ukur.</Text> : null}
      <PickerField label="Alat ukur standar" value={selected.length ? `${selected.length} alat dipilih` : ''} placeholder="Pilih alat ukur" disabled={!loaded || !devices.length} onPress={() => { setSearch(''); setPickerOpen(true); }} />
      {loaded && thermometers.length ? <Choice label="Thermohygrometer acuan kondisi lingkungan" value={thermometers.some(({ device }) => device.id === data.environment.standardId) ? data.environment.standardId : ''} options={thermometers.map(({ device }) => ({ value: device.id, label: device.serial }))} onChange={(id) => {
        const profile = thermometers.find(({ device }) => device.id === id)?.profile;
        if (profile) onReference(profile);
      }} /> : loaded ? <Text style={styles.deviceHint}>Pilih thermohygrometer yang data sertifikatnya lengkap untuk menghitung kondisi lingkungan.</Text> : null}
    </Card>
    {selected.length ? <Card><Heading title={`Alat dipilih · ${selected.length}`} />{selected.map((device) => <ValueLine key={device.id} label={device.name} value={`${device.brand} · ${device.model} · ${device.serial}`} />)}</Card> : null}
    <SearchPickerModal visible={pickerOpen} title="Pilih alat ukur" search={search} placeholder="Cari nama, merek, tipe, atau nomor seri" onSearch={setSearch} onClose={() => setPickerOpen(false)}>
            {deviceGroups.map((group) => {
              const expanded = expandedName === group.key || Boolean(search.trim());
              const chosenInGroup = selected.some((device) => deviceNameKey(device.name) === group.key);
              return <View key={group.key} style={styles.deviceGroup}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpandedName(expandedName === group.key ? null : group.key)} style={styles.deviceGroupHeader}>
                  <View style={styles.deviceGroupCopy}><Text style={styles.deviceGroupName}>{group.name}</Text><Text style={styles.deviceGroupMeta}>{group.count} nomor seri · {selected.filter((device) => deviceNameKey(device.name) === group.key).length} dipilih</Text></View>
                  <Text style={styles.deviceGroupToggle}>{expanded ? '−' : '+'}</Text>
                </Pressable>
                {expanded ? <View style={styles.deviceSerialList}>{group.devices.map((device, index) => {
                  const chosen = selectedIds.has(device.id);
                  const unavailable = chosenInGroup && !chosen;
                  const profile = thermohygrometerProfile(device);
                  return <PickerOption key={device.id} index={index + 1} label={device.serial} detail={`${device.brand} · ${device.model}`} selected={chosen} disabled={unavailable} status={chosen ? 'Dipilih' : unavailable ? 'Nama sudah dipilih' : 'Pilih'} statusTone={chosen ? 'good' : unavailable ? 'wait' : 'neutral'} onPress={() => onToggle(deviceSnapshot(device), profile)} accessory={device.isDemo ? <Badge text="Contoh" tone="wait" /> : null}>
                    {device.isThermohygrometer && !profile ? <Text style={styles.deviceWarning}>Data koreksi sertifikat belum lengkap.</Text> : null}
                  </PickerOption>;
                })}</View> : null}
              </View>;
            })}
            {matchingMissing.map((device) => <PickerOption key={device.id} label={device.name} detail={`${device.brand} · ${device.model} · S/N ${device.serial}`} selected status="Hapus" statusTone="wait" onPress={() => onToggle(device, null)}><Text style={styles.deviceWarning}>Sudah dihapus dari data master. Ketuk untuk menghapus pilihan ini.</Text></PickerOption>)}
            {!deviceGroups.length && !matchingMissing.length ? <Text style={styles.devicePickerEmpty}>{normalizedSearch ? 'Tidak ada alat yang cocok.' : 'Belum ada alat ukur.'}</Text> : null}
    </SearchPickerModal>
  </>;
}

function EnvironmentStep({ data, update, result }: { data: CalibrationData; update: FieldUpdate; result: CalculationResult }) {
  const { environment } = data;
  const calculated = result.environment;
  return <>
    <Card>
      <Heading title="Kondisi lingkungan" hint="Thermohygrometer acuan dipilih pada langkah Pilih alat ukur. Koreksi mengikuti tabel sertifikat yang tersimpan pada data alat ukur." />
      <ValueLine label="Thermohygrometer acuan" value={calculated.reference?.serial ?? 'Belum dipilih'} />
      {calculated.reference?.serial === 'EFG19BE02500' ? <Text style={styles.sourceWarning}>Workbook memuat koreksi RH +10,1% pada titik 50% untuk acuan ini. Nilai disalin apa adanya; verifikasi sertifikat sebelum digunakan.</Text> : null}
      <Field label="Suhu awal" value={environment.temperatureStart} onChange={(value) => update('environment', 'temperatureStart', value)} keyboard="decimal-pad" suffix="°C" />
      <Field label="Suhu akhir" value={environment.temperatureEnd} onChange={(value) => update('environment', 'temperatureEnd', value)} keyboard="decimal-pad" suffix="°C" />
      <Field label="Kelembaban awal" value={environment.humidityStart} onChange={(value) => update('environment', 'humidityStart', value)} keyboard="decimal-pad" suffix="%" />
      <Field label="Kelembaban akhir" value={environment.humidityEnd} onChange={(value) => update('environment', 'humidityEnd', value)} keyboard="decimal-pad" suffix="%" />
      {calculated.temperature && calculated.humidity ? <View style={styles.liveResult}>
        <Text style={styles.liveTitle}>Hasil terkoreksi</Text>
        <Text style={styles.liveText}>Suhu {fmt(calculated.temperature.mean)} ± {fmt(calculated.temperature.u95)} °C</Text>
        <Text style={styles.liveText}>Kelembaban {fmt(calculated.humidity.mean)} ± {fmt(calculated.humidity.u95)}%</Text>
      </View> : null}
      {calculated.errors.map((error) => <Text key={error} style={styles.errorText}>{error}</Text>)}
    </Card>
  </>;
}

function InspectionButtons({ item, kind, value, onChange }: {
  item: string;
  kind: 'Fisik' | 'Fungsi';
  value: InspectionEntry['physical'];
  onChange: (value: InspectionEntry['physical']) => void;
}) {
  return <View style={styles.inspectionButtons}>
    {([{ value: 'Baik', symbol: '✓' }, { value: 'Tidak baik', symbol: '×' }] as const).map((option) => <Pressable
      key={option.value}
      accessibilityRole="button"
      accessibilityLabel={`${item}, ${kind}: ${option.value}`}
      accessibilityState={{ selected: value === option.value }}
      onPress={() => onChange(option.value)}
      style={[styles.inspectionButton, value === option.value && (option.value === 'Baik' ? styles.inspectionGood : styles.inspectionBad)]}
    ><Text style={[styles.inspectionButtonText, value === option.value && (option.value === 'Baik' ? styles.inspectionGoodText : styles.inspectionBadText)]}>{option.symbol}</Text></Pressable>)}
  </View>;
}

function InspectionStep({ data, updateInspection }: { data: CalibrationData; updateInspection: InspectionUpdate }) {
  const [expandedNote, setExpandedNote] = useState<number | null>(null);
  return <Card>
    <Heading title="Pemeriksaan fisik dan fungsi" hint="Pilih ✓ untuk Baik atau × untuk Tidak baik. Catatan tersedia per bagian." />
    <View style={styles.inspectionHeader}>
      <Text style={styles.inspectionPartHeader}>Bagian alat</Text>
      <Text style={styles.inspectionColumnHeader}>Fisik</Text>
      <Text style={styles.inspectionColumnHeader}>Fungsi</Text>
    </View>
    {data.inspections.map((item, index) => <View key={item.label} style={styles.inspectionGroup}>
      <View style={styles.inspectionRow}>
        <View style={styles.inspectionPart}>
          <Text style={styles.inspectionName}>{index + 1}. {item.label}</Text>
          <Pressable accessibilityRole="button" onPress={() => setExpandedNote((current) => current === index ? null : index)}>
            <Text style={styles.noteLink}>{item.note ? 'Edit catatan' : '+ Catatan'}</Text>
          </Pressable>
        </View>
        <InspectionButtons item={item.label} kind="Fisik" value={item.physical} onChange={(value) => updateInspection(index, 'physical', value)} />
        <InspectionButtons item={item.label} kind="Fungsi" value={item.function} onChange={(value) => updateInspection(index, 'function', value)} />
      </View>
      {expandedNote === index ? <Field label={`Catatan · ${item.label}`} value={item.note} onChange={(value) => updateInspection(index, 'note', value)} multiline /> : item.note ? <Text numberOfLines={1} style={styles.notePreview}>Catatan: {item.note}</Text> : null}
    </View>)}
  </Card>;
}

function SafetyStep({ data, update, safetyResult }: { data: CalibrationData; update: FieldUpdate; safetyResult: SafetyResult | null }) {
  const safety = data.safety;
  const limit = (label: string) => safetyResult?.checks.find((check) => check.label === label)?.limit || '—';
  const threshold = (label: string) => <Text style={styles.thresholdText}>Ambang batas: {limit(label)}</Text>;
  return <Card>
    <Heading title="Keselamatan listrik" hint="Ambang kategori mengikuti tabel tipe di workbook Centrifuge. Hasil ambang dibandingkan dengan angka terukur." />
    <Field label="Tegangan jala-jala" value={safety.voltage} onChange={(value) => update('safety', 'voltage', value)} keyboard="decimal-pad" suffix="V" />
    {threshold('Tegangan jala-jala')}
    <Choice label="Tipe kabel / pembumian" value={safety.earthType} onChange={(value) => update('safety', 'earthType', value)} options={[
      { value: '1', label: '1 · Kabel tetap' }, { value: '2', label: '2 · Kabel lepas' },
      { value: '3', label: '3 · Terpasang permanen' }, { value: '4', label: '4 · Kotak kontak multiple' },
    ]} />
    <Field label="Resistansi pembumian" value={safety.earthResistance} onChange={(value) => update('safety', 'earthResistance', value)} keyboard="decimal-pad" suffix="Ω" />
    {threshold('Resistansi pembumian protektif')}
    <Choice label="Tipe arus bocor" value={safety.leakageType} onChange={(value) => update('safety', 'leakageType', value)} options={[
      { value: '1', label: '1 · Kelas I, kabel tetap' }, { value: '2', label: '2 · Kelas II, kabel tetap' },
      { value: '3', label: '3 · Kelas I, kabel lepas' }, { value: '4', label: '4 · Kelas II, kabel lepas' },
    ]} />
    <Field label="Arus bocor peralatan" value={safety.equipmentLeakage} onChange={(value) => update('safety', 'equipmentLeakage', value)} keyboard="decimal-pad" suffix="mA" />
    {threshold('Arus bocor peralatan')}
    <Choice label="Arus bocor bagian diaplikasikan" value={safety.appliedLeakageNA} onChange={(value) => update('safety', 'appliedLeakageNA', value)} options={[
      { value: false, label: 'Ukur' }, { value: true, label: 'Tidak berlaku' },
    ]} />
    {!safety.appliedLeakageNA ? <>
      <Field label="Arus bocor bagian diaplikasikan" value={safety.appliedLeakage} onChange={(value) => update('safety', 'appliedLeakage', value)} keyboard="decimal-pad" suffix="mA" />
      {threshold('Arus bocor bagian diaplikasikan')}
    </> : null}
    <Choice
      label="Hasil resistansi isolasi"
      value={safety.insulationResistance.trim().toUpperCase() === 'OL' ? 'OL' : 'angka'}
      onChange={(value) => update('safety', 'insulationResistance', value === 'OL' ? 'OL' : '')}
      options={[{ value: 'angka', label: 'Masukkan angka' }, { value: 'OL', label: 'OL' }]}
    />
    {safety.insulationResistance.trim().toUpperCase() === 'OL'
      ? <Text style={styles.exportNote}>Hasil resistansi isolasi disimpan sebagai OL.</Text>
      : <Field label="Nilai resistansi isolasi" value={safety.insulationResistance} onChange={(value) => update('safety', 'insulationResistance', value)} keyboard="decimal-pad" placeholder="Contoh: 300" suffix="MΩ" />}
    {threshold('Resistansi isolasi')}
  </Card>;
}

function MeasurementStep({ data, instrument, result, update, updateInspection, updatePerformance }: {
  data: CalibrationData;
  instrument: Instrument;
  result: CalculationResult;
  update: FieldUpdate;
  updateInspection: InspectionUpdate;
  updatePerformance: PerformanceUpdate;
}) {
  return <>
    <EnvironmentStep data={data} update={update} result={result} />
    <InspectionStep data={data} updateInspection={updateInspection} />
    {instrument.id === 'centrifuge' ? <SafetyStep data={data} update={update} safetyResult={result.safety} /> : null}
    <Card>
      <Heading title="Pengujian kinerja" hint={instrument.id === 'flowmeter' ? 'Workbook menampilkan ±20% pada label, tetapi rumus ambang di sel menggunakan 10%. Perhitungan aplikasi mengikuti rumus 10%.' : 'Masukkan setiap bacaan seperti yang terbaca pada alat standar.'} />
      {data.performance.map((row, rowIndex) => {
        const calculated = result.performance[rowIndex].result;
        return <View key={row.id} style={styles.performanceCard}>
          <View style={styles.performanceHeading}>
            <Text style={styles.itemTitle}>{row.label} · {row.unit}</Text>
            {calculated ? <Badge text={calculated.pass ? 'LULUS' : 'TIDAK LULUS'} tone={calculated.pass ? 'good' : 'bad'} /> : <Badge text="MENUNGGU" tone="wait" />}
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingField}><Field label="Setting" value={row.setting} onChange={(value) => updatePerformance(rowIndex, 'setting', value)} keyboard="decimal-pad" suffix={row.unit} /></View>
            <Text style={styles.toleranceNote}>Toleransi {row.tolerancePercent}%</Text>
          </View>
          <Text style={styles.labelLike}>Bacaan terukur · {row.readings.length} kali sesuai Excel</Text>
          <Text style={styles.readingsHint}>Ketuk setiap kolom untuk memasukkan atau mengubah angka bacaan.</Text>
          <View style={styles.readingsGrid}>
            {row.readings.map((value, readingIndex) => <View key={readingIndex} style={styles.readingCell}>
              <Text style={styles.readingLabel}>Bacaan {readingIndex + 1}</Text>
              <TextInput accessibilityLabel={`${row.label}, bacaan ${readingIndex + 1}`} value={value} onChangeText={(next) => updatePerformance(rowIndex, 'readings', next, readingIndex)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#8995A1" style={styles.readingInput} />
            </View>)}
          </View>
          {calculated ? <View style={styles.inlineStats}><Text style={styles.inlineStat}>Rata-rata {fmt(calculated.mean)}</Text><Text style={styles.inlineStat}>Koreksi {fmt(calculated.correction)}</Text><Text style={styles.inlineStat}>U95 {fmt(calculated.u95)}</Text></View> : null}
        </View>;
      })}
    </Card>
  </>;
}

function ResultStep({ data, result, instrument }: { data: CalibrationData; result: CalculationResult; instrument: Instrument }) {
  const tone = result.complete ? result.score !== null && result.score >= 70 ? 'good' : 'bad' : 'wait';
  return <>
    <Card style={result.complete && result.score !== null && result.score < 70 ? styles.badOutcome : styles.goodOutcome}>
      <Text style={styles.outcomeKicker}>{result.complete ? 'HASIL PENGUJIAN' : 'STATUS PENGISIAN'}</Text>
      <Text style={styles.outcomeTitle}>{result.complete ? result.status : 'Data belum lengkap'}</Text>
      <Text style={styles.outcomeScore}>{result.score === null ? '—' : `${result.score} / 100`}</Text>
      <Badge text={result.status} tone={tone} />
    </Card>
    {result.missing.length ? <Card style={styles.pendingCard}>
      <Heading title="Masih perlu dilengkapi" hint="Lengkapi data dan pemeriksaan teknisi untuk menyelesaikan hasil." />
      {result.missing.map((item) => <Text key={item} style={styles.missingItem}>• {item}</Text>)}
    </Card> : null}
    <Card><Heading title="Skor" />
      {result.safety ? <ValueLine label="Keselamatan listrik" value={result.safetyScore === null ? 'Belum lengkap' : `${result.safetyScore} / 40`} /> : null}
      <ValueLine label="Pemeriksaan fisik dan fungsi" value={result.physicalScore === null ? 'Belum lengkap' : `${result.physicalScore} / ${instrument.score.physicalWeight}`} />
      <ValueLine label="Pengujian kinerja" value={result.performanceScore === null ? 'Belum lengkap' : `${result.performanceScore} / ${instrument.score.performanceWeight}`} />
      {result.performanceRate !== null ? <ValueLine label="Titik kinerja lulus" value={`${result.performanceRate.toFixed(0)}%`} /> : null}
    </Card>
    <Card><Heading title="Alat ukur yang dipilih" />
      {(data.selectedDevices ?? []).length ? (data.selectedDevices ?? []).map((device) => <ValueLine key={device.id} label={device.name} value={`${device.brand} · ${device.model} · ${device.serial}`} />) : <Text style={styles.deviceHint}>Belum memilih alat ukur.</Text>}
    </Card>
    <Card><Heading title="Lingkungan terkoreksi" />
      <ValueLine label="Thermohygrometer acuan" value={result.environment.reference?.serial} />
      <ValueLine label="Suhu rata-rata ± U95" value={result.environment.temperature ? `${fmt(result.environment.temperature.mean)} ± ${fmt(result.environment.temperature.u95)} °C` : 'Belum lengkap'} />
      <ValueLine label="Kelembaban rata-rata ± U95" value={result.environment.humidity ? `${fmt(result.environment.humidity.mean)} ± ${fmt(result.environment.humidity.u95)}%` : 'Belum lengkap'} />
    </Card>
    {result.safety ? <Card><Heading title="Keselamatan listrik" />
      {result.safety.checks.map((item) => <View key={item.label} style={styles.resultLine}><Text style={styles.resultLabel}>{item.label}</Text><Badge text={item.result === null ? 'KOSONG' : item.result ? 'LULUS' : 'TIDAK LULUS'} tone={item.result === null ? 'wait' : item.result ? 'good' : 'bad'} /></View>)}
    </Card> : null}
    <Card><Heading title="Hasil tiap titik kinerja" />
      {result.performance.map((row) => <View key={row.id} style={styles.resultPerformance}>
        <View style={styles.resultLine}><Text style={styles.resultLabel}>{row.setting} {row.unit}</Text><Badge text={row.result ? row.result.pass ? 'LULUS' : 'TIDAK LULUS' : 'KOSONG'} tone={row.result ? row.result.pass ? 'good' : 'bad' : 'wait'} /></View>
        <ValueLine label="Rata-rata" value={row.result ? fmt(row.result.mean) : '—'} />
        <ValueLine label="Koreksi" value={row.result ? fmt(row.result.correction) : '—'} />
        <ValueLine label="Koreksi + U95 / toleransi" value={row.result ? `${fmt(row.result.testValue)} / ${fmt(row.result.tolerance)}` : '—'} />
      </View>)}
    </Card>
  </>;
}

export default function CalibrationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, updateRecord, storageError } = useRecords();
  const { customers, devices, equipmentMethods, loaded: directoryLoaded } = useAdminData();
  const record = useMemo<CalibrationRecord | undefined>(() => records.find((item) => item.id === String(id)), [records, id]);
  const [step, setStep] = useState(0);
  const instrument = record ? getInstrument(record.instrumentId) : null;
  const data = record?.data;
  const result = instrument && data ? calculateRecord(instrument, data) : null;

  useEffect(() => {
    if (!record || !instrument || !data || !directoryLoaded) return;
    const legacyCustomer = customers.find((item) => item.name === data.identity.customer);
    const configuredMethod = equipmentMethods.find((item) => item.instrumentId === instrument.id)?.method.trim();
    const missingMethod = !data.identity.method?.trim() && configuredMethod;
    const legacyDevices = devices.filter((device) => instrument.standards.some((standard) => standard[3] === device.serial)).map(deviceSnapshot);
    const legacyThermohygrometer = devices.find((device) => device.serial === data.environment.standardId);
    const legacyReference = legacyThermohygrometer ? thermohygrometerProfile(legacyThermohygrometer) : null;
    const needsMigration = data.identity.customerId === undefined || data.selectedDevices === undefined || data.environment.reference === undefined || Boolean(missingMethod);
    if (!needsMigration) return;
    updateRecord(record.id, { data: {
      ...data,
      identity: data.identity.customerId === undefined || missingMethod ? { ...data.identity, ...(data.identity.customerId === undefined ? { customerId: legacyCustomer?.id ?? '' } : {}), ...(missingMethod ? { method: configuredMethod } : {}) } : data.identity,
      selectedDevices: data.selectedDevices ?? legacyDevices,
      environment: data.environment.reference === undefined
        ? { ...data.environment, standardId: legacyReference?.id ?? data.environment.standardId, reference: legacyReference }
        : data.environment,
    } });
  }, [customers, data, devices, directoryLoaded, equipmentMethods, instrument, record, updateRecord]);

  if (!record || !instrument || !data || !result) return <SafeAreaView style={styles.safe}><View style={styles.missingScreen}><Text style={styles.outcomeTitle}>Catatan tidak ditemukan</Text><ActionButton title="Kembali ke catatan" onPress={() => router.replace('/')} /></View></SafeAreaView>;

  const update: FieldUpdate = (section, key, value) => updateRecord(record.id, {
    data: { ...data, [section]: { ...data[section], [key]: value } } as CalibrationData,
  });
  const selectCustomer = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    updateRecord(record.id, { data: { ...data, identity: {
      ...data.identity,
      customerId: customer?.id ?? '', customer: customer?.name ?? '',
      address: customer?.address ?? '', city: customer ? `${customer.city}, ${customer.province}` : '',
    } } });
  };
  const toggleDevice = (device: SelectedMeasurementDevice, profile: Thermohygrometer | null) => {
    const current = data.selectedDevices ?? [];
    const removing = current.some((item) => item.id === device.id);
    if (!removing && current.some((item) => deviceNameKey(item.name) === deviceNameKey(device.name))) return;
    const selectedDevices = removing ? current.filter((item) => item.id !== device.id) : [...current, device];
    let environment = data.environment;
    const referenceRemoved = removing && (environment.standardId === device.id || environment.reference?.id === device.id);
    if (referenceRemoved) {
      const replacement = selectedDevices.map((item) => devices.find((master) => master.id === item.id))
        .filter((item): item is MeasuringDevice => Boolean(item))
        .map(thermohygrometerProfile).find((item): item is Thermohygrometer => Boolean(item));
      environment = { ...environment, standardId: replacement?.id ?? '', reference: replacement ?? null };
    } else if (!removing && profile && !environment.reference) {
      environment = { ...environment, standardId: profile.id, reference: profile };
    }
    updateRecord(record.id, { data: { ...data, selectedDevices, environment } });
  };
  const selectThermohygrometer = (reference: Thermohygrometer) => updateRecord(record.id, {
    data: { ...data, environment: { ...data.environment, standardId: reference.id, reference } },
  });
  const updateInspection: InspectionUpdate = (index, key, value) => {
    const inspections = data.inspections.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      if (key === 'physical') return { ...item, physical: value as InspectionEntry['physical'] };
      if (key === 'function') return { ...item, function: value as InspectionEntry['function'] };
      return { ...item, note: value };
    });
    updateRecord(record.id, { data: { ...data, inspections } });
  };
  const updatePerformance: PerformanceUpdate = (index, key, value, readingIndex) => {
    const performance = data.performance.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (key === 'readings') {
        if (readingIndex === undefined) return row;
        return { ...row, readings: row.readings.map((item, itemIndex) => itemIndex === readingIndex ? value : item) };
      }
      return { ...row, setting: value };
    });
    updateRecord(record.id, { data: { ...data, performance } });
  };
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <ScreenHeader instrument={instrument} onBack={() => router.replace('/')} onFormula={() => router.push(`/rumus?recordId=${record.id}`)} />
    <StepTabs current={step} onChange={setStep} />
    {storageError ? <View style={styles.storageMessage}><Text style={styles.storageMessageText}>{storageError}</Text></View> : null}
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? <IdentityStep data={data} customers={customers} loaded={directoryLoaded} update={update} selectCustomer={selectCustomer} /> : null}
        {step === 1 ? <SelectDevicesStep data={data} devices={devices} loaded={directoryLoaded} onToggle={toggleDevice} onReference={selectThermohygrometer} /> : null}
        {step === 2 ? <MeasurementStep data={data} instrument={instrument} result={result} update={update} updateInspection={updateInspection} updatePerformance={updatePerformance} /> : null}
        {step === 3 ? <ResultStep data={data} result={result} instrument={instrument} /> : null}
        <View style={styles.navigationButtons}>
          {step > 0 ? <View style={styles.navButton}><ActionButton title="Sebelumnya" secondary onPress={() => setStep(step - 1)} /></View> : <View style={styles.navButton}><ActionButton title="Selesai" secondary onPress={() => router.replace('/')} /></View>}
          {step < steps.length - 1 ? <View style={styles.navButton}><ActionButton title="Lanjut" onPress={() => setStep(step + 1)} /></View> : <View style={styles.navButton}><ActionButton title="Selesai" onPress={() => router.replace('/')} /></View>}
        </View>
        <Text style={styles.autosaveNote}>Perubahan disimpan otomatis di perangkat.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
