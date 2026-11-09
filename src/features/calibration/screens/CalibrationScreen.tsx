import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Navbar } from '../../../components/Navbar';
import { ActionButton, Badge, Card, Choice, DateField, Field, Heading, ValueLine } from '../../../components/ui';
import { PickerField } from '../../../components/picker/PickerField';
import { PickerOption } from '../../../components/picker/PickerOption';
import { SearchPickerModal } from '../../../components/picker/SearchPickerModal';
import { calculateRecord } from '../../../core/calculations';
import { getInstrumentTemplateId, getRecordInstrument } from '../../../core/instruments';
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
  SphygmomanometerData,
  InfusionPumpData,
  SuctionPumpData,
  Thermohygrometer,
  WeighingStandardWeight,
} from '../../../core/types';

const steps = ['Identitas', 'Standar kalibrasi', 'Pengujian', 'Hasil'];




const fmt = (value: number | null | undefined, digits = 2) => typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

function StepTabs({ current, onChange }: { current: number; onChange: (step: number) => void }) {
  return <View style={styles.stepProgress}>
    <View style={styles.stepProgressHeading}><Text style={styles.stepCounter}>LANGKAH {String(current + 1).padStart(2, '0')} / {steps.length}</Text><Text style={styles.stepCurrentTitle}>{steps[current]}</Text></View>
    <View style={styles.stepTrack}>
      <View style={styles.progressLine}><View style={[styles.progressFill, { width: `${(current / (steps.length - 1)) * 100}%` }]} /></View>
      {steps.map((label, index) => <Pressable key={label} accessibilityRole="button" accessibilityState={{ selected: current === index }} onPress={() => onChange(index)} style={styles.stepNode}>
        <View style={[styles.stepCircle, index < current && styles.stepCircleDone, current === index && styles.stepCircleCurrent]}><Text style={[styles.stepNumber, (index <= current) && styles.stepNumberCurrent]}>{index + 1}</Text></View>
        <Text style={[styles.stepLabel, current === index && styles.stepLabelCurrent]} numberOfLines={1}>{label === 'Standar kalibrasi' ? 'Standar' : label}</Text>
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

function IdentityStep({ data, instrument, customers, loaded, update, selectCustomer }: { data: CalibrationData; instrument: Instrument; customers: Customer[]; loaded: boolean; update: FieldUpdate; selectCustomer: (id: string) => void }) {
  const fields: [keyof IdentityData, string][] = [
    ['labelNumber', 'Nomor label *'], ['brand', 'Merek *'],
    ['model', 'Tipe / model *'], ['serial', 'Nomor seri *'], ['capacity', 'Kapasitas'], ['accuracy', 'Tingkat ketelitian'],
    ['technician', 'Petugas pelaksana *'], ['receivedDate', 'Tanggal penerimaan'], ['testDate', 'Tanggal pelaksanaan *'],
    ['room', 'Ruang pelaksanaan *'], ['method', 'Metode kerja *'],
  ];
  const characteristicUnit = instrument.weighingScale ? 'kg' : instrument.sphygmomanometer ? 'mmHg' : undefined;
  return <>
    <Card><Heading title="Alat yang dikalibrasi" hint="Isi identitas alat kesehatan yang diuji. Metode kerja otomatis mengikuti Katalog Alkes." />
      {fields.slice(0, 6).map(([key, label]) => {
        const characteristic = key === 'capacity' || key === 'accuracy';
        const value = key === 'accuracy' && instrument.sphygmomanometer
          ? data.identity.accuracy.replace(/^kelas\s*/i, '')
          : data.identity[key];
        return <Field key={key} label={label} value={value} onChange={(next) => update('identity', key, next)}
          keyboard={characteristic ? 'decimal-pad' : undefined} suffix={characteristic ? characteristicUnit : undefined} />;
      })}
      {characteristicUnit ? <Text style={styles.deviceHint}>Isi sesuai label alat. Tingkat ketelitian dipakai dalam perhitungan; kapasitas dicantumkan di LK dan sertifikat.</Text> : null}
    </Card>
    <Card><Heading title="Pelaksanaan dan pelanggan" hint="Pilih pelanggan yang sudah didaftarkan admin. Ketuk tanggal untuk membuka kalender." />
      {!loaded ? <Text style={styles.deviceHint}>Memuat data pelanggan…</Text> : customers.length ? <CustomerPicker customers={customers} value={data.identity.customerId || customers.find((customer) => customer.name === data.identity.customer)?.id || ''} loaded={loaded} onChange={selectCustomer} /> : <Text style={styles.errorText}>Belum ada data pelanggan. Admin perlu menambahkan pelanggan terlebih dahulu.</Text>}
      {data.identity.customer ? <><ValueLine label="Alamat pelanggan" value={data.identity.address} /><ValueLine label="Kota / kabupaten" value={data.identity.city} /></> : null}
      {fields.slice(6).map(([key, label]) => key.endsWith('Date')
        ? <DateField key={key} label={label} value={data.identity[key]} onChange={(value) => update('identity', key, value)} />
        : <Field key={key} label={label} value={data.identity[key]} onChange={(value) => update('identity', key, value)} editable={key !== 'method'} multiline={key === 'method'} />)}
      <Text style={styles.deviceHint}>Metode kerja dikelola admin di menu Katalog Alkes.</Text>
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

function weighingStandardSnapshot(device: MeasuringDevice): WeighingStandardWeight | null {
  const standard = device.weighingStandard;
  if (!standard) return null;
  const numeric = (value: string) => value.trim() ? Number(value.replace(',', '.')) : Number.NaN;
  const values = [standard.nominalKg, standard.uncertaintyU95G, standard.conventionalMass2025G, standard.conventionalMass2026G].map(numeric);
  if (!values.every(Number.isFinite) || values[0] <= 0 || values[1] < 0 || values[2] <= 0 || values[3] <= 0) return null;
  return {
    name: device.name, brand: device.brand, model: device.model, serial: device.serial,
    nominalKg: values[0], uncertaintyU95G: values[1], conventionalMass2025G: values[2], conventionalMass2026G: values[3],
  };
}

const deviceNameKey = (name: string) => name.trim().toLowerCase();

function SelectDevicesStep({ instrument, data, devices, loaded, onToggle, onReference, onToggleWeights }: {
  instrument: Instrument;
  data: CalibrationData;
  devices: MeasuringDevice[];
  loaded: boolean;
  onToggle: (device: SelectedMeasurementDevice, profile: Thermohygrometer | null) => void;
  onReference: (profile: Thermohygrometer) => void;
  onToggleWeights: (index: number, weights: WeighingStandardWeight[]) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [weightPickerPointId, setWeightPickerPointId] = useState<string | null>(null);
  const [weightSearch, setWeightSearch] = useState('');
  const selected = data.selectedDevices ?? [];
  const requirements = instrument.standards.map(([name]) => name);
  const expectedDpmSerial = instrument.sphygmomanometer || instrument.suctionPump ? instrument.standards.find(([name]) => name === 'Digital Pressure Meter')?.[3] : undefined;
  const selectedDpm = selected.find((device) => device.name === 'Digital Pressure Meter');
  const availableDevices = loaded ? devices.filter((device) => !device.weighingStandard
    && requirements.some((name) => deviceNameKey(name) === deviceNameKey(device.name))) : [];
  const selectedIds = new Set(selected.map((device) => device.id));
  const normalizedSearch = search.trim().toLowerCase();
  const deviceGroups = requirements.map((name) => {
    const key = deviceNameKey(name);
    const groupDevices = availableDevices.filter((device) => deviceNameKey(device.name) === key);
    const matchesName = name.toLowerCase().includes(normalizedSearch);
    const matchingDevices = groupDevices.filter((device) => !normalizedSearch || matchesName
      || [device.serial, device.brand, device.model].some((value) => value.toLowerCase().includes(normalizedSearch)));
    return { key, name, devices: matchingDevices, count: groupDevices.length };
  }).filter((group) => group.devices.length);
  const thermometers = availableDevices.map((device) => ({ device, profile: thermohygrometerProfile(device) }))
    .filter((item) => selectedIds.has(item.device.id) && item.profile);
  const missing = loaded ? selected.filter((device) => !availableDevices.some((item) => item.id === device.id)) : [];
  const matchingMissing = missing.filter((device) => !normalizedSearch
    || [device.name, device.brand, device.model, device.serial].some((value) => value.toLowerCase().includes(normalizedSearch)));
  const weightPoints = instrument.weighingScale?.points ?? [];
  const weighingStandards = loaded ? devices.map((device) => ({ device, standard: weighingStandardSnapshot(device) }))
    .filter((item): item is { device: MeasuringDevice; standard: WeighingStandardWeight } => Boolean(item.standard)) : [];
  const filteredWeights = weighingStandards.filter(({ device, standard }) => !weightSearch.trim()
    || [device.name, device.brand, device.model, standard.serial, String(standard.nominalKg)].some((value) => value.toLowerCase().includes(weightSearch.trim().toLowerCase())));
  const activeWeightPoint = weightPoints.find((point) => point.id === weightPickerPointId);
  const activeWeightMeasurement = data.weighing?.points.find((point) => point.id === weightPickerPointId);
  return <>
    <Card>
      <Heading title="Standar kalibrasi" hint={`Daftar mengikuti metode ${instrument.name}. Hanya jenis standar yang dibutuhkan metode ini yang ditampilkan.`} />
      <ValueLine label="Standar wajib" value={[...requirements, ...(weightPoints.length ? ['Anak timbangan per titik beban'] : [])].join(' · ')} />
      {!loaded ? <Text style={styles.deviceHint}>Memuat standar kalibrasi…</Text> : null}
      {loaded && requirements.some((name) => !availableDevices.some((device) => deviceNameKey(device.name) === deviceNameKey(name))) ? <Text style={styles.deviceHint}>Ada standar wajib yang belum terdaftar. Admin perlu menambahkannya dengan nama jenis yang sesuai di menu Standar kalibrasi.</Text> : null}
      {expectedDpmSerial && selectedDpm && selectedDpm.serial !== expectedDpmSerial ? <Text style={styles.sourceWarning}>Kurva koreksi workbook hanya untuk DPM {expectedDpmSerial}. Pilihan {selectedDpm.serial} belum punya kurva di aplikasi.</Text> : null}
      <PickerField label="Standar umum" value={selected.length ? `${selected.length} standar dipilih` : ''} placeholder="Pilih standar yang dibutuhkan" disabled={!loaded || !availableDevices.length} onPress={() => { setSearch(''); setWeightPickerPointId(null); setPickerOpen(true); }} />
      {loaded && thermometers.length ? <Choice label="Thermohygrometer acuan kondisi lingkungan" value={thermometers.some(({ device }) => device.id === data.environment.standardId) ? data.environment.standardId : ''} options={thermometers.map(({ device }) => ({ value: device.id, label: device.serial }))} onChange={(id) => {
        const profile = thermometers.find(({ device }) => device.id === id)?.profile;
        if (profile) onReference(profile);
      }} /> : loaded ? <Text style={styles.deviceHint}>Pilih thermohygrometer yang data sertifikatnya lengkap untuk menghitung kondisi lingkungan.</Text> : null}
    </Card>
    {selected.length ? <Card><Heading title={`Standar dipilih · ${selected.length}`} />{selected.map((device) => <ValueLine key={device.id} label={device.name} value={`${device.brand} · ${device.model} · ${device.serial}`} />)}</Card> : null}
    {weightPoints.length ? <Card><Heading title="Anak timbangan per beban" hint="Pilih kombinasi nomor seri hingga total massanya sama dengan titik uji." />
      {weightPoints.map((point, index) => {
        const measurement = data.weighing?.points.find((item) => item.id === point.id);
        const weights = measurement?.standardWeights ?? [];
        const total = weights.reduce((sum, weight) => sum + weight.nominalKg, 0);
        const complete = Math.abs(total - point.loadKg) < 1e-6;
        return <View key={point.id} style={styles.performanceCard}>
          <View style={styles.performanceHeading}><Text style={styles.itemTitle}>{point.loadKg} kg</Text><Badge text={complete ? 'LENGKAP' : 'PILIH STANDAR'} tone={complete ? 'good' : 'wait'} /></View>
          <PickerField label="Kombinasi anak timbangan" value={weights.length ? `${weights.map((weight) => `${weight.nominalKg} kg · ${weight.serial}`).join(' + ')} = ${fmt(total, 3)} kg` : ''} placeholder={`Pilih anak timbangan · total ${point.loadKg} kg`} disabled={!loaded || !weighingStandards.length} onPress={() => { setWeightSearch(''); setWeightPickerPointId(point.id); }} />
          {!loaded ? <Text style={styles.deviceHint}>Memuat standar massa…</Text> : !weighingStandards.length ? <Text style={styles.deviceHint}>Admin perlu mendaftarkan anak timbangan di menu Standar kalibrasi.</Text> : null}
        </View>;
      })}
    </Card> : null}
    <SearchPickerModal visible={pickerOpen} title="Pilih standar kalibrasi" search={search} placeholder="Cari nama, merek, tipe, atau nomor seri" onSearch={setSearch} onClose={() => setPickerOpen(false)}>
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
            {!deviceGroups.length && !matchingMissing.length ? <Text style={styles.devicePickerEmpty}>{normalizedSearch ? 'Tidak ada standar yang cocok.' : 'Belum ada standar untuk metode ini.'}</Text> : null}
    </SearchPickerModal>
    <SearchPickerModal visible={Boolean(activeWeightPoint)} title={activeWeightPoint ? `Anak timbangan · ${activeWeightPoint.loadKg} kg` : 'Pilih anak timbangan'} search={weightSearch} placeholder="Cari nomor seri atau massa" onSearch={setWeightSearch} onClose={() => setWeightPickerPointId(null)}>
      {activeWeightPoint ? filteredWeights.map(({ device, standard }, index) => {
        const current = activeWeightMeasurement?.standardWeights ?? [];
        const chosen = current.some((weight) => weight.serial === standard.serial);
        const nextTotal = current.reduce((sum, weight) => sum + weight.nominalKg, 0) + (chosen ? 0 : standard.nominalKg);
        const exceedsPoint = !chosen && nextTotal > activeWeightPoint.loadKg + 1e-6;
        return <PickerOption key={device.id} index={index + 1} label={`${device.name} · ${standard.nominalKg} kg`} detail={`${device.brand} · ${device.model} · S/N ${standard.serial} · U95 ${standard.uncertaintyU95G} g`} selected={chosen} disabled={exceedsPoint} status={chosen ? 'Dipilih' : exceedsPoint ? 'Melebihi beban' : 'Pilih'} statusTone={chosen ? 'good' : exceedsPoint ? 'wait' : 'neutral'} accessory={device.isDemo ? <Badge text="Contoh" tone="wait" /> : null} onPress={() => {
          const weights = chosen ? current.filter((weight) => weight.serial !== standard.serial) : [...current, standard];
          onToggleWeights(weightPoints.findIndex((point) => point.id === activeWeightPoint.id), weights);
        }} />;
      }) : null}
      {activeWeightPoint && !filteredWeights.length ? <Text style={styles.devicePickerEmpty}>{weightSearch.trim() ? 'Tidak ada anak timbangan yang cocok.' : 'Belum ada anak timbangan.'}</Text> : null}
    </SearchPickerModal>
  </>;
}

function EnvironmentStep({ data, update, result, mainsVoltage = false }: { data: CalibrationData; update: FieldUpdate; result: CalculationResult; mainsVoltage?: boolean }) {
  const { environment } = data;
  const calculated = result.environment;
  return <>
    <Card>
      <Heading title="Kondisi lingkungan" hint="Thermohygrometer acuan dipilih pada langkah Standar kalibrasi. Koreksi mengikuti tabel sertifikat pada data standar." />
      <ValueLine label="Thermohygrometer acuan" value={calculated.reference?.serial ?? 'Belum dipilih'} />
      {calculated.reference?.serial === 'EFG19BE02500' ? <Text style={styles.sourceWarning}>Workbook memuat koreksi RH +10,1% pada titik 50% untuk acuan ini. Nilai disalin apa adanya; verifikasi sertifikat sebelum digunakan.</Text> : null}
      <Field label="Suhu awal" value={environment.temperatureStart} onChange={(value) => update('environment', 'temperatureStart', value)} keyboard="decimal-pad" suffix="°C" />
      <Field label="Suhu akhir" value={environment.temperatureEnd} onChange={(value) => update('environment', 'temperatureEnd', value)} keyboard="decimal-pad" suffix="°C" />
      <Field label="Kelembaban awal" value={environment.humidityStart} onChange={(value) => update('environment', 'humidityStart', value)} keyboard="decimal-pad" suffix="%" />
      <Field label="Kelembaban akhir" value={environment.humidityEnd} onChange={(value) => update('environment', 'humidityEnd', value)} keyboard="decimal-pad" suffix="%" />
      {mainsVoltage ? <Field label="Tegangan jala-jala" value={data.safety.voltage} onChange={(value) => update('safety', 'voltage', value)} keyboard="decimal-pad" suffix="V" /> : null}
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
    <Heading title="Keselamatan listrik" hint="Ambang kategori mengikuti tabel tipe kabel dan arus bocor pada workbook alat." />
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

function FetalSafetyStep({ data, update }: { data: CalibrationData; update: FieldUpdate }) {
  const safety = data.safety;
  const compliance = (label: string, key: 'earthMeets' | 'equipmentLeakageMeets' | 'appliedLeakageMeets' | 'insulationMeets') => <Choice
    label={`Memenuhi · ${label}`}
    value={safety[key] ?? ''}
    onChange={(value) => update('safety', key, value)}
    options={[{ value: 'Ya', label: 'Ya' }, { value: 'Tidak', label: 'Tidak' }]}
  />;
  return <Card>
    <Heading title="Keselamatan listrik" hint="Isi angka terukur dan status Ya/Tidak seperti di LK. Workbook tidak menetapkan ambang batas untuk bagian ini." />
    <Field label="Resistansi pembumian protektif" value={safety.earthResistance} onChange={(value) => update('safety', 'earthResistance', value)} keyboard="decimal-pad" suffix="Ω" />
    {compliance('Resistansi pembumian protektif', 'earthMeets')}
    <Field label="Arus bocor peralatan" value={safety.equipmentLeakage} onChange={(value) => update('safety', 'equipmentLeakage', value)} keyboard="decimal-pad" suffix="mA" />
    {compliance('Arus bocor peralatan', 'equipmentLeakageMeets')}
    <Field label="Arus bocor bagian yang diaplikasikan" value={safety.appliedLeakage} onChange={(value) => update('safety', 'appliedLeakage', value)} keyboard="decimal-pad" suffix="mA" />
    {compliance('Arus bocor bagian yang diaplikasikan', 'appliedLeakageMeets')}
    <Choice label="Hasil resistansi isolasi" value={safety.insulationResistance.trim().toUpperCase() === 'OL' ? 'OL' : 'angka'} onChange={(value) => update('safety', 'insulationResistance', value === 'OL' ? 'OL' : '')} options={[
      { value: 'angka', label: 'Masukkan angka' }, { value: 'OL', label: 'OL' },
    ]} />
    {safety.insulationResistance.trim().toUpperCase() === 'OL'
      ? <Text style={styles.exportNote}>Hasil resistansi isolasi disimpan sebagai OL.</Text>
      : <Field label="Nilai resistansi isolasi" value={safety.insulationResistance} onChange={(value) => update('safety', 'insulationResistance', value)} keyboard="decimal-pad" suffix="MΩ" />}
    {compliance('Resistansi isolasi', 'insulationMeets')}
  </Card>;
}

function WeighingStep({ instrument, data, result, updatePoint, updateRepeatability }: {
  instrument: Instrument;
  data: CalibrationData;
  result: CalculationResult;
  updatePoint: (index: number, key: 'zeroReading' | 'indication', value: string) => void;
  updateRepeatability: (index: number, key: 'zeroReading' | 'indication', value: string) => void;
}) {
  const config = instrument.weighingScale;
  const weighing = data.weighing;
  const calculated = result.weighing;
  if (!config || !weighing || !calculated) return null;
  return <>
    <Card>
      <Heading title={`Uji berulang · ${config.repeatabilityLoadKg} kg`} hint="Masukkan nilai zero (z) dan penunjukan (m) sebanyak 10 kali. Selisih r = m − z dihitung otomatis." />
      {weighing.repeatabilityReadings.map((reading, index) => <View key={index} style={styles.performanceCard}>
        <Text style={styles.readingLabel}>Pengulangan {index + 1}</Text>
        <View style={styles.settingRow}>
          <View style={styles.settingField}><Field label="Zero (z)" value={reading.zeroReading} onChange={(value) => updateRepeatability(index, 'zeroReading', value)} keyboard="decimal-pad" suffix="kg" /></View>
          <View style={styles.settingField}><Field label={`Bacaan ${config.repeatabilityLoadKg} kg (m)`} value={reading.indication} onChange={(value) => updateRepeatability(index, 'indication', value)} keyboard="decimal-pad" suffix="kg" /></View>
        </View>
      </View>)}
      {calculated.repeatabilityMean !== null ? <View style={styles.inlineStats}>
        <Text style={styles.inlineStat}>Rata-rata {fmt(calculated.repeatabilityMean, 4)} kg</Text>
        <Text style={styles.inlineStat}>STDEV bacaan {fmt(calculated.repeatabilityStandardDeviation, 6)} kg</Text>
        <Text style={styles.inlineStat}>Nilai SD laporan Excel {fmt(calculated.reportStandardDeviation, 6)} kg</Text>
      </View> : null}
    </Card>
    <Card>
      <Heading title="Pengujian beban" hint="Anak timbangan dipilih pada langkah Standar kalibrasi. Masukkan bacaan nol dan bacaan berbeban di setiap titik." />
      {config.points.map((point, index) => {
        const measurement = weighing.points.find((item) => item.id === point.id);
        const output = calculated.points[index];
        const selectedWeights = measurement?.standardWeights ?? [];
        const selectedMass = selectedWeights.reduce((sum, weight) => sum + weight.nominalKg, 0);
        return <View key={point.id} style={styles.performanceCard}>
          <View style={styles.performanceHeading}>
            <Text style={styles.itemTitle}>Beban {point.loadKg} kg</Text>
            <Badge text={output?.complete ? 'LENGKAP' : output && !output.standardWeightsComplete ? 'ATUR ANAK TIMBANGAN' : 'ISI BACAAN'} tone={output?.complete ? 'good' : 'wait'} />
          </View>
          <Text style={styles.readingsHint}>Standar massa · {selectedWeights.length ? `${selectedWeights.map((weight) => `${weight.nominalKg} kg · ${weight.serial}`).join(' + ')} = ${fmt(selectedMass, 3)} kg` : 'Belum dipilih'}</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingField}><Field label="Bacaan nol" value={measurement?.zeroReading ?? ''} onChange={(value) => updatePoint(index, 'zeroReading', value)} keyboard="decimal-pad" suffix="kg" /></View>
            <View style={styles.settingField}><Field label="Bacaan berbeban" value={measurement?.indication ?? ''} onChange={(value) => updatePoint(index, 'indication', value)} keyboard="decimal-pad" suffix="kg" /></View>
          </View>
          {output ? <View style={styles.inlineStats}>
            <Text style={styles.inlineStat}>Massa acuan {fmt(output.referenceMassKg, 5)} kg</Text>
            <Text style={styles.inlineStat}>Koreksi {fmt(output.correction, 5)} kg</Text>
            <Text style={styles.inlineStat}>U95 {fmt(output.uncertaintyU95Kg, 5)} kg</Text>
          </View> : null}
        </View>;
      })}
    </Card>
  </>;
}

function PressureDirectionTable({ title, direction, data, results, onReading }: {
  title: string;
  direction: 'up' | 'down';
  data: SphygmomanometerData['pressureReadings'];
  results: NonNullable<CalculationResult['sphygmomanometer']>['pressureReadings'];
  onReading: (setting: number, direction: 'up' | 'down', index: number, value: string) => void;
}) {
  const outcome = (pass: boolean | null) => <Badge text={pass === null ? 'MENUNGGU' : pass ? 'LULUS' : 'TIDAK LULUS'} tone={pass === null ? 'wait' : pass ? 'good' : 'bad'} />;
  return <View>
    <Text style={styles.pressureDirectionTitle}>{title}</Text>
    <View style={styles.pressureTable}>
      <View style={[styles.pressureTableRow, styles.pressureTableHeader]}>
        <Text style={styles.pressureSettingColumn}>Setting</Text>
        {[1, 2, 3].map((number) => <Text key={number} style={styles.pressureReadingColumn}>Bacaan {number}</Text>)}
      </View>
      {data.map((point) => {
        const calculated = results.find((item) => item.setting === point.setting)?.[direction];
        return <View key={point.setting}>
          <View style={styles.pressureTableRow}>
            <Text style={styles.pressureSettingColumn}>{point.setting} mmHg</Text>
            {point[direction].map((value, index) => <View key={index} style={styles.pressureInputCell}>
              <TextInput accessibilityLabel={`${point.setting} mmHg, ${title}, bacaan DPM ${index + 1}`} value={value} onChangeText={(next) => onReading(point.setting, direction, index, next)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#8995A1" style={styles.pressureInput} />
            </View>)}
          </View>
          {calculated ? <View style={styles.pressureStats}>
            <View style={styles.resultLine}><Text style={styles.pressureStatsText}>x̄ terkoreksi {fmt(calculated.mean)} · C {fmt(calculated.correction)} · U95 {fmt(calculated.uncertaintyU95)}</Text>{outcome(calculated.pass)}</View>
            <Text style={styles.pressureStatsText}>|C| + U95 {fmt(calculated.decisionValue)} / 4 mmHg</Text>
          </View> : null}
        </View>;
      })}
    </View>
  </View>;
}

function SphygmomanometerStep({ data, result, onChange }: {
  data: SphygmomanometerData;
  result: NonNullable<CalculationResult['sphygmomanometer']>;
  onChange: (data: SphygmomanometerData) => void;
}) {
  const updateReading = (setting: number, direction: 'up' | 'down', index: number, value: string) => onChange({
    ...data,
    pressureReadings: data.pressureReadings.map((point) => point.setting !== setting ? point : {
      ...point,
      [direction]: point[direction].map((reading, readingIndex) => readingIndex === index ? value : reading),
    }),
  });
  const outcome = (pass: boolean | null) => <Badge text={pass === null ? 'MENUNGGU' : pass ? 'LULUS' : 'TIDAK LULUS'} tone={pass === null ? 'wait' : pass ? 'good' : 'bad'} />;
  return <>
    <Card>
      <Heading title="Uji kebocoran" hint="Pompa hingga 250 mmHg, lalu catat penurunan tekanan setelah 1 menit." />
      <Field label="Penurunan tekanan" value={data.leakageDrop} onChange={(value) => onChange({ ...data, leakageDrop: value })} keyboard="decimal-pad" suffix="mmHg" />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Batas penurunan ≤ 15 mmHg</Text>{outcome(result.leakageDrop.pass)}</View>
    </Card>
    <Card>
      <Heading title="Uji deflasi cepat" hint="Pompa hingga 260 mmHg, buka valve dan catat waktu deflasi." />
      <Field label="Waktu deflasi" value={data.rapidDeflationSeconds} onChange={(value) => onChange({ ...data, rapidDeflationSeconds: value })} keyboard="decimal-pad" suffix="detik" />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Batas waktu ≤ 10 detik</Text>{outcome(result.rapidDeflationSeconds.pass)}</View>
    </Card>
    <Card>
      <Heading title="Uji ketepatan tekanan" hint="Isi tabel tekanan naik sampai selesai, lalu lanjutkan ke tabel tekanan turun. Setiap setting memakai tiga bacaan Digital Pressure Meter." />
      <PressureDirectionTable title="1. Tekanan naik" direction="up" data={data.pressureReadings} results={result.pressureReadings} onReading={updateReading} />
      <PressureDirectionTable title="2. Tekanan turun" direction="down" data={data.pressureReadings} results={result.pressureReadings} onReading={updateReading} />
    </Card>
  </>;
}

function SuctionPumpStep({ data, result, config, onChange }: {
  data: SuctionPumpData;
  result: NonNullable<CalculationResult['suctionPump']>;
  config: NonNullable<Instrument['suctionPump']>;
  onChange: (data: SuctionPumpData) => void;
}) {
  const legacy = data.pressureReadings.some((point) => point.up.length === 3);
  const updateReading = (setting: number, direction: 'up' | 'down', index: number, value: string) => onChange({
    ...data,
    pressureReadings: data.pressureReadings.map((point) => point.setting !== setting ? point : {
      ...point,
      [direction]: point[direction].map((reading, readingIndex) => readingIndex === index ? value : reading),
    }),
  });
  const outcome = (pass: boolean | null) => <Badge text={pass === null ? 'MENUNGGU' : pass ? 'LULUS' : 'TIDAK LULUS'} tone={pass === null ? 'wait' : pass ? 'good' : 'bad'} />;
  return <>
    <Card>
      <Heading title="Uji tekanan vakum" hint={`Masukkan ${legacy ? 3 : 6} bacaan DPM saat tekanan naik dan saat turun. Angka dimasukkan tanpa tanda minus.`} />
      {data.pressureReadings.map((point) => {
        const calculated = result.pressureReadings.find((item) => item.setting === point.setting);
        return <View key={point.setting} style={styles.performanceCard}>
          <Text style={styles.itemTitle}>Setting {Math.abs(point.setting)} mmHg</Text>
          {(['up', 'down'] as const).map((direction) => {
            const label = direction === 'up' ? 'Naik' : 'Turun';
            const directionResult = calculated?.[direction] ?? null;
            return <View key={direction} style={styles.performanceCard}>
              <View style={styles.performanceHeading}><Text style={styles.labelLike}>Tekanan {label}</Text>{outcome(directionResult?.pass ?? null)}</View>
              <View style={styles.readingsGrid}>{point[direction].map((value, index) => <View key={index} style={styles.readingCell}>
                <Text style={styles.readingLabel}>Bacaan {index + 1}</Text>
                <TextInput accessibilityLabel={`${Math.abs(point.setting)} mmHg, ${label}, bacaan ${index + 1}`} value={value} onChangeText={(next) => updateReading(point.setting, direction, index, next)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#8995A1" style={styles.readingInput} />
              </View>)}</View>
              {directionResult ? <View style={styles.inlineStats}><Text style={styles.inlineStat}>Rata-rata terkoreksi {fmt(directionResult.correctedMean)} mmHg</Text><Text style={styles.inlineStat}>Galat {fmt(directionResult.error)} mmHg · {fmt(Math.abs(directionResult.error / point.setting) * 100, 2)}%</Text><Text style={styles.inlineStat}>U95 {fmt(directionResult.uncertaintyU95)} mmHg</Text></View> : null}
            </View>;
          })}
        </View>;
      })}
    </Card>
    <Card>
      <Heading title="Daya hisap maksimum" hint={legacy
        ? 'Atur alat hingga vakum minimal 300 mmHg, lalu catat waktu sampai daya hisap maksimum tercapai.'
        : `Atur vakum pada rentang ${config.minimumVacuumMmHg}–${config.maximumVacuumMmHg} mmHg, lalu catat waktu sampai daya hisap maksimum tercapai.`} />
      <Field label="Bacaan tekanan vakum maksimum" value={data.maximumVacuumReading} onChange={(value) => onChange({ ...data, maximumVacuumReading: value })} keyboard="decimal-pad" suffix="mmHg · isi besar vakum" />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>{legacy ? 'Batas vakum ≥ 300 mmHg' : `Batas vakum ${config.minimumVacuumMmHg}–${config.maximumVacuumMmHg} mmHg`}</Text>{outcome(result.maximumVacuumReadingPass)}</View>
      <Field label="Waktu mencapai vakum maksimum" value={data.maximumVacuumSeconds} onChange={(value) => onChange({ ...data, maximumVacuumSeconds: value })} keyboard="decimal-pad" suffix="detik" />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Batas waktu ≤ 10 detik</Text>{outcome(result.maximumVacuumPass)}</View>
    </Card>
  </>;
}

function MeasurementStep({ data, instrument, result, update, updateInspection, updatePerformance, updateWeighingPoint, updateWeighingRepeatability, updateSphygmomanometer, updateInfusionPump, updateSuctionPump }: {
  data: CalibrationData;
  instrument: Instrument;
  result: CalculationResult;
  update: FieldUpdate;
  updateInspection: InspectionUpdate;
  updatePerformance: PerformanceUpdate;
  updateWeighingPoint: (index: number, key: 'zeroReading' | 'indication', value: string) => void;
  updateWeighingRepeatability: (index: number, key: 'zeroReading' | 'indication', value: string) => void;
  updateSphygmomanometer: (data: SphygmomanometerData) => void;
  updateInfusionPump: (data: InfusionPumpData) => void;
  updateSuctionPump: (data: SuctionPumpData) => void;
}) {
  const infusionPump = data.infusionPump;
  const templateId = getInstrumentTemplateId(instrument);
  const infusionResult = templateId === 'infusion-pump' || templateId === 'syringe-pump';
  return <>
    <EnvironmentStep data={data} update={update} result={result} mainsVoltage={templateId === 'fetal-doppler'} />
    <InspectionStep data={data} updateInspection={updateInspection} />
    {result.safety ? <SafetyStep data={data} update={update} safetyResult={result.safety} /> : null}
    {templateId === 'fetal-doppler' ? <FetalSafetyStep data={data} update={update} /> : null}
    {instrument.sphygmomanometer && data.sphygmomanometer && result.sphygmomanometer
      ? <SphygmomanometerStep data={data.sphygmomanometer} result={result.sphygmomanometer} onChange={updateSphygmomanometer} />
      : instrument.weighingScale ? <WeighingStep instrument={instrument} data={data} result={result} updatePoint={updateWeighingPoint} updateRepeatability={updateWeighingRepeatability} />
      : instrument.suctionPump ? null : <Card>
      <Heading title="Pengujian kinerja" hint={templateId === 'flowmeter' ? 'Batas toleransi ±20% dari setting; setiap titik memakai lima bacaan.' : 'Masukkan setiap bacaan seperti yang terbaca pada alat standar.'} />
      {infusionResult && infusionPump ? <Choice label="Channel Infusion Device Analyzer" value={infusionPump.channel} onChange={(channel) => updateInfusionPump({ ...infusionPump, channel })} options={['Channel 1', 'Channel 2', 'Channel 3'].map((channel) => ({ value: channel, label: channel }))} /> : null}
      {data.performance.map((row, rowIndex) => {
        const calculated = result.performance[rowIndex].result;
        const absoluteTolerance = Number(row.absoluteTolerance?.replace(',', '.') ?? 0);
        const percentTolerance = Number(row.tolerancePercent.replace(',', '.') ?? 0);
        const limitLabel = row.formula === 'workbookMinimum' ? `Batas minimum ≥ ${row.setting} ${row.unit}`
          : row.formula === 'workbookMaximum' ? `Batas maksimum ≤ ${row.setting} ${row.unit}`
            : row.formula === 'workbookBand' ? `Rentang ${row.minimumSetting}–${row.maximumSetting} ${row.unit}`
              : row.formula === 'workbookRange' ? `Variasi maksimum ${row.absoluteTolerance} ${row.unit}`
              : absoluteTolerance && percentTolerance ? `±${percentTolerance}% atau ${row.absoluteTolerance} ${row.unit}`
                : absoluteTolerance ? `±${row.absoluteTolerance} ${row.unit}` : `±${row.tolerancePercent}%`;
        const renderReadings = (values: string[], field: 'readings' | 'standardReadings' | 'pairedReadings', title: string) => <>
          <Text style={styles.labelLike}>{title} · {values.length} kali sesuai Excel</Text>
          <View style={styles.readingsGrid}>{values.map((value, readingIndex) => <View key={readingIndex} style={styles.readingCell}>
            <Text style={styles.readingLabel}>Bacaan {readingIndex + 1}</Text>
            <TextInput accessibilityLabel={`${row.label}, ${title}, bacaan ${readingIndex + 1}`} value={value} onChangeText={(next) => updatePerformance(rowIndex, field, next, readingIndex)} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#8995A1" style={styles.readingInput} />
          </View>)}</View>
        </>;
        return <View key={row.id} style={styles.performanceCard}>
          <View style={styles.performanceHeading}>
            <Text style={styles.itemTitle}>{row.label} · {row.unit}</Text>
            {calculated ? <Badge text={calculated.pass ? 'LULUS' : 'TIDAK LULUS'} tone={calculated.pass ? 'good' : 'bad'} /> : <Badge text="MENUNGGU" tone="wait" />}
          </View>
          <View style={styles.settingRow}>
            <View style={styles.settingField}><Field label={row.formula === 'workbookMinimum' ? 'Batas minimum' : row.formula === 'workbookMaximum' ? 'Batas maksimum' : row.formula === 'workbookBand' ? 'Titik tengah' : row.formula === 'workbookRange' ? 'Suhu kontrol' : 'Setting'} value={row.setting} onChange={(value) => updatePerformance(rowIndex, 'setting', value)} keyboard="decimal-pad" suffix={row.unit} editable={row.formula !== 'workbookBand' && row.formula !== 'workbookRange'} /></View>
            <Text style={styles.toleranceNote}>{limitLabel}</Text>
          </View>
          {row.formula === 'workbookRange' ? <Text style={styles.readingsHint}>Rentang dihitung otomatis dari bacaan minimum dan maksimum sensor terkait.</Text> : <Text style={styles.readingsHint}>Ketuk setiap kolom untuk memasukkan atau mengubah angka bacaan.</Text>}
          {row.includeInScore === false ? <Text style={styles.readingsHint}>Dicatat di lembar hasil, tetapi tidak masuk skor Excel.</Text> : null}
          {row.formula === 'workbookComparisonAccuracy' ? <>
            {renderReadings(row.readings, 'readings', 'Bacaan UUT')}
            {renderReadings(row.standardReadings ?? [], 'standardReadings', 'Bacaan standar')}
          </> : row.formula === 'workbookPairedAccuracy' ? <>
            {renderReadings(row.readings, 'readings', 'Bacaan minimum')}
            {renderReadings(row.pairedReadings ?? [], 'pairedReadings', 'Bacaan maksimum')}
          </> : row.formula === 'workbookRange' ? null : renderReadings(row.readings, 'readings', 'Bacaan terukur')}
          {calculated ? <View style={styles.inlineStats}>
            <Text style={styles.inlineStat}>{row.formula === 'workbookRange' ? `Rentang max − min ${fmt(calculated.testValue)} ${row.unit}` : `Rata-rata ${fmt(calculated.mean)}`}</Text>
            {calculated.standardMean !== undefined ? <Text style={styles.inlineStat}>Rata-rata standar {fmt(calculated.standardMean)} · U95 {fmt(calculated.standardU95)}</Text> : null}
            {calculated.correction !== null && row.formula !== 'workbookRange' ? <Text style={styles.inlineStat}>Koreksi {fmt(calculated.correction)}</Text> : null}
            {calculated.correctedMean !== undefined ? <Text style={styles.inlineStat}>Rata-rata terkoreksi {fmt(calculated.correctedMean)}</Text> : null}
            {calculated.error !== undefined ? <Text style={styles.inlineStat}>Galat {fmt(calculated.error)} · {fmt(calculated.testValue * 100, 2)}%</Text> : null}
            {row.formula !== 'workbookRange' ? <Text style={styles.inlineStat}>{row.includeUncertainty === false ? 'Ketidakpastian tidak dipakai untuk keputusan Excel' : `U95 ${fmt(calculated.u95)}`}</Text> : null}
          </View> : null}
        </View>;
      })}
    </Card>}
    {infusionResult && infusionPump ? <Card>
      <Heading title="Uji kemampatan / occlusion" hint="Setting 100 mL/h · masukkan enam bacaan analyzer dalam psi." />
      <View style={styles.readingsGrid}>{infusionPump.occlusionReadings.map((value, index) => <View key={index} style={styles.readingCell}>
        <Text style={styles.readingLabel}>Bacaan {index + 1}</Text>
        <TextInput accessibilityLabel={`Occlusion, bacaan ${index + 1}`} value={value} onChangeText={(next) => updateInfusionPump({ ...infusionPump, occlusionReadings: infusionPump.occlusionReadings.map((reading, itemIndex) => itemIndex === index ? next : reading) })} keyboardType="decimal-pad" placeholder="—" placeholderTextColor="#8995A1" style={styles.readingInput} />
      </View>)}</View>
      {result.pumpOcclusion ? <View style={styles.inlineStats}><Text style={styles.inlineStat}>Rata-rata {fmt(result.pumpOcclusion.mean)} psi</Text><Text style={styles.inlineStat}>Koreksi standar {fmt(result.pumpOcclusion.correction)} psi</Text><Text style={styles.inlineStat}>U95 {fmt(result.pumpOcclusion.uncertaintyU95)} psi</Text><Text style={styles.inlineStat}>Batas rata-rata ≤ {result.pumpOcclusion.limit} psi</Text></View> : null}
      {result.pumpOcclusion ? <View style={styles.resultLine}><Text style={styles.resultLabel}>Hasil uji occlusion</Text><Badge text={result.pumpOcclusion.pass ? 'LULUS' : 'TIDAK LULUS'} tone={result.pumpOcclusion.pass ? 'good' : 'bad'} /></View> : null}
    </Card> : null}
    {instrument.suctionPump && data.suctionPump && result.suctionPump ? <SuctionPumpStep data={data.suctionPump} result={result.suctionPump} config={instrument.suctionPump} onChange={updateSuctionPump} /> : null}
  </>;
}

function PressureResultTable({ title, direction, pressureReadings }: {
  title: string;
  direction: 'up' | 'down';
  pressureReadings: NonNullable<CalculationResult['sphygmomanometer']>['pressureReadings'];
}) {
  return <>
    <Text style={styles.pressureDirectionTitle}>{title}</Text>
    <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false}>
      <View style={styles.pressureResultTable}>
        <View style={[styles.pressureResultRow, styles.pressureResultHeader]}>
          <Text style={[styles.pressureResultCell, styles.pressureResultSetting]}>Setting</Text>
          {[1, 2, 3].map((number) => <Text key={number} style={[styles.pressureResultCell, styles.pressureResultReading]}>DPM {number}</Text>)}
          <Text style={[styles.pressureResultCell, styles.pressureResultMean]}>Rata-rata terkoreksi</Text>
          <Text style={[styles.pressureResultCell, styles.pressureResultNarrow]}>Koreksi C</Text>
          <Text style={[styles.pressureResultCell, styles.pressureResultNarrow]}>U95</Text>
          <Text style={[styles.pressureResultCell, styles.pressureResultDecision]}>|C| + U95</Text>
          <Text style={[styles.pressureResultCell, styles.pressureResultOutcome]}>Hasil</Text>
        </View>
        {pressureReadings.map((point) => {
          const item = point[direction];
          return <View key={point.setting} style={styles.pressureResultRow}>
            <Text style={[styles.pressureResultCell, styles.pressureResultSetting]}>{point.setting} mmHg</Text>
            {item.readings.map((reading, index) => <Text key={index} style={[styles.pressureResultCell, styles.pressureResultReading]}>{fmt(reading)}</Text>)}
            <Text style={[styles.pressureResultCell, styles.pressureResultMean]}>{fmt(item.mean)}</Text>
            <Text style={[styles.pressureResultCell, styles.pressureResultNarrow]}>{fmt(item.correction)}</Text>
            <Text style={[styles.pressureResultCell, styles.pressureResultNarrow]}>{fmt(item.uncertaintyU95)}</Text>
            <Text style={[styles.pressureResultCell, styles.pressureResultDecision]}>{fmt(item.decisionValue)}</Text>
            <View style={[styles.pressureResultCell, styles.pressureResultOutcome]}>
              <Badge text={item.pass === null ? 'MENUNGGU' : item.pass ? 'LULUS' : 'TIDAK LULUS'} tone={item.pass === null ? 'wait' : item.pass ? 'good' : 'bad'} />
            </View>
          </View>;
        })}
      </View>
    </ScrollView>
  </>;
}

function ResultStep({ data, result, instrument }: { data: CalibrationData; result: CalculationResult; instrument: Instrument }) {
  const tone = result.complete ? result.score !== null && result.score >= 70 ? 'good' : 'bad' : 'wait';
  const legacySuction = data.suctionPump?.pressureReadings.some((point) => point.up.length === 3) ?? false;
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
      {result.performanceRate !== null ? <ValueLine label={result.sphygmomanometer ? 'Kinerja berbobot' : 'Titik kinerja lulus'} value={`${result.performanceRate.toFixed(0)}%`} /> : null}
    </Card>
    <Card><Heading title="Standar kalibrasi yang dipakai" />
      {(data.selectedDevices ?? []).length ? (data.selectedDevices ?? []).map((device) => <ValueLine key={device.id} label={device.name} value={`${device.brand} · ${device.model} · ${device.serial}`} />) : <Text style={styles.deviceHint}>Standar umum belum dipilih.</Text>}
    </Card>
    <Card><Heading title="Lingkungan terkoreksi" />
      <ValueLine label="Thermohygrometer acuan" value={result.environment.reference?.serial} />
      <ValueLine label="Suhu rata-rata ± U95" value={result.environment.temperature ? `${fmt(result.environment.temperature.mean)} ± ${fmt(result.environment.temperature.u95)} °C` : 'Belum lengkap'} />
      <ValueLine label="Kelembaban rata-rata ± U95" value={result.environment.humidity ? `${fmt(result.environment.humidity.mean)} ± ${fmt(result.environment.humidity.u95)}%` : 'Belum lengkap'} />
    </Card>
    {result.safety ? <Card><Heading title="Keselamatan listrik" />
      {result.safety.checks.map((item) => <View key={item.label} style={styles.resultLine}><Text style={styles.resultLabel}>{item.label}</Text><Badge text={item.result === null ? 'KOSONG' : item.result ? 'LULUS' : 'TIDAK LULUS'} tone={item.result === null ? 'wait' : item.result ? 'good' : 'bad'} /></View>)}
    </Card> : null}
    {result.sphygmomanometer ? <Card><Heading title="Hasil sphygmomanometer" />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Uji kebocoran · {fmt(result.sphygmomanometer.leakageDrop.value)} mmHg / batas 15 mmHg</Text>{result.sphygmomanometer.leakageDrop.pass === null ? <Badge text="MENUNGGU" tone="wait" /> : <Badge text={result.sphygmomanometer.leakageDrop.pass ? 'LULUS' : 'TIDAK LULUS'} tone={result.sphygmomanometer.leakageDrop.pass ? 'good' : 'bad'} />}</View>
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Deflasi cepat · {fmt(result.sphygmomanometer.rapidDeflationSeconds.value)} detik / batas 10 detik</Text>{result.sphygmomanometer.rapidDeflationSeconds.pass === null ? <Badge text="MENUNGGU" tone="wait" /> : <Badge text={result.sphygmomanometer.rapidDeflationSeconds.pass ? 'LULUS' : 'TIDAK LULUS'} tone={result.sphygmomanometer.rapidDeflationSeconds.pass ? 'good' : 'bad'} />}</View>
      <PressureResultTable title="1. Tekanan naik" direction="up" pressureReadings={result.sphygmomanometer.pressureReadings} />
      <PressureResultTable title="2. Tekanan turun" direction="down" pressureReadings={result.sphygmomanometer.pressureReadings} />
    </Card> : result.suctionPump ? <Card><Heading title="Hasil pengujian suction pump" />
      {result.suctionPump.pressureReadings.map((point) => (['up', 'down'] as const).map((direction) => {
        const item = point[direction];
        return <View key={`${point.setting}-${direction}`} style={styles.resultPerformance}>
          <View style={styles.resultLine}><Text style={styles.resultLabel}>{Math.abs(point.setting)} mmHg · {direction === 'up' ? 'Naik' : 'Turun'}</Text><Badge text={item ? item.pass ? 'LULUS' : 'TIDAK LULUS' : 'MENUNGGU'} tone={item ? item.pass ? 'good' : 'bad' : 'wait'} /></View>
          <ValueLine label="Bacaan DPM" value={item?.readings.map((value) => fmt(value)).join(' · ') ?? '—'} />
          <ValueLine label="Rata-rata terkoreksi" value={item ? `${fmt(item.correctedMean)} mmHg` : '—'} />
          <ValueLine label="Koreksi drift" value={item ? `${fmt(item.correction)} mmHg` : '—'} />
          <ValueLine label="U95" value={item ? `${fmt(item.uncertaintyU95)} mmHg` : '—'} />
          <ValueLine label="Galat / toleransi 10%" value={item ? `${fmt(item.error)} mmHg / ${fmt(Math.abs(item.error / point.setting) * 100, 2)}%` : '—'} />
        </View>;
      }))}
      <View style={styles.resultLine}><Text style={styles.resultLabel}>{legacySuction ? 'Tekanan maksimum / batas ≥ 300 mmHg' : `Tekanan maksimum / batas ${instrument.suctionPump?.minimumVacuumMmHg}–${instrument.suctionPump?.maximumVacuumMmHg} mmHg`}</Text><Badge text={result.suctionPump.maximumVacuumReadingPass === null ? 'MENUNGGU' : result.suctionPump.maximumVacuumReadingPass ? 'LULUS' : 'TIDAK LULUS'} tone={result.suctionPump.maximumVacuumReadingPass === null ? 'wait' : result.suctionPump.maximumVacuumReadingPass ? 'good' : 'bad'} /></View>
      <ValueLine label="Tekanan terukur" value={result.suctionPump.maximumVacuumReading === null ? '—' : `${fmt(result.suctionPump.maximumVacuumReading)} mmHg`} />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Waktu mencapai vakum maksimum / batas 10 detik</Text><Badge text={result.suctionPump.maximumVacuumPass === null ? 'MENUNGGU' : result.suctionPump.maximumVacuumPass ? 'LULUS' : 'TIDAK LULUS'} tone={result.suctionPump.maximumVacuumPass === null ? 'wait' : result.suctionPump.maximumVacuumPass ? 'good' : 'bad'} /></View>
      <ValueLine label="Waktu terukur" value={result.suctionPump.maximumVacuumSeconds === null ? '—' : `${fmt(result.suctionPump.maximumVacuumSeconds)} detik`} />
    </Card> : result.weighing ? <Card><Heading title="Hasil pengujian timbangan" />
      <ValueLine label="Rata-rata uji berulang" value={result.weighing.repeatabilityMean === null ? 'Belum lengkap' : `${fmt(result.weighing.repeatabilityMean, 4)} kg`} />
      <ValueLine label="STDEV 10 bacaan" value={result.weighing.repeatabilityStandardDeviation === null ? 'Belum lengkap' : `${fmt(result.weighing.repeatabilityStandardDeviation, 6)} kg`} />
      <ValueLine label="Nilai SD pada laporan Excel" value={`${fmt(result.weighing.reportStandardDeviation, 6)} kg`} />
      <ValueLine label="Koreksi absolut maksimum" value={result.weighing.maxAbsoluteCorrection === null ? 'Belum lengkap' : `${fmt(result.weighing.maxAbsoluteCorrection, 5)} kg`} />
      <ValueLine label="U95 maksimum" value={result.weighing.maxUncertaintyU95 === null ? 'Belum lengkap' : `${fmt(result.weighing.maxUncertaintyU95, 5)} kg`} />
      <ValueLine label="LOP / batas 10 × resolusi" value={result.weighing.lop === null ? 'Belum lengkap' : `${fmt(result.weighing.lop, 5)} / ${fmt(result.weighing.limit, 2)} kg`} />
      <View style={styles.resultLine}><Text style={styles.resultLabel}>Hasil LOP</Text><Badge text={result.weighing.pass === null ? 'MENUNGGU' : result.weighing.pass ? 'LULUS' : 'TIDAK LULUS'} tone={result.weighing.pass === null ? 'wait' : result.weighing.pass ? 'good' : 'bad'} /></View>
      {result.weighing.points.map((point) => <View key={point.id} style={styles.resultPerformance}>
        <View style={styles.resultLine}><Text style={styles.resultLabel}>Beban {point.loadKg} kg</Text><Text style={styles.resultTiny}>{point.standardWeightSerials.join(' + ')}</Text></View>
        <ValueLine label="Bacaan nol" value={point.zeroReading === null ? '—' : `${fmt(point.zeroReading, 4)} kg`} />
        <ValueLine label="Bacaan berbeban" value={point.indication === null ? '—' : `${fmt(point.indication, 4)} kg`} />
        <ValueLine label="Massa konvensional" value={`${fmt(point.referenceMassKg, 5)} kg`} />
        <ValueLine label="Koreksi" value={point.correction === null ? '—' : `${fmt(point.correction, 5)} kg`} />
        <ValueLine label="U95" value={`${fmt(point.uncertaintyU95Kg, 5)} kg`} />
      </View>)}
    </Card> : ['infusion-pump', 'syringe-pump'].includes(getInstrumentTemplateId(instrument)) ? <>
      <Card><Heading title="Hasil laju aliran" />
        {result.performance.map((row) => <View key={row.id} style={styles.resultPerformance}>
          <View style={styles.resultLine}><Text style={styles.resultLabel}>{row.setting} {row.unit}</Text><Badge text={row.result ? row.result.pass ? 'LULUS' : 'TIDAK LULUS' : 'MENUNGGU'} tone={row.result ? row.result.pass ? 'good' : 'bad' : 'wait'} /></View>
          <ValueLine label="Enam bacaan / rata-rata" value={row.result ? `${row.result.readings.map((value) => fmt(value)).join(' · ')} / ${fmt(row.result.mean)} ${row.unit}` : 'Belum lengkap'} />
          <ValueLine label="Koreksi analyzer" value={row.result ? `${fmt(row.result.correction)} ${row.unit}` : '—'} />
          <ValueLine label="Rata-rata terkoreksi" value={row.result ? `${fmt(row.result.correctedMean)} ${row.unit}` : '—'} />
          <ValueLine label="Galat / batas 10%" value={row.result ? `${fmt(row.result.error)} ${row.unit} / ${fmt(row.result.testValue * 100, 2)}%` : '—'} />
          <ValueLine label="U95" value={row.result ? `${fmt(row.result.u95)} ${row.unit}` : '—'} />
        </View>)}
      </Card>
      <Card><Heading title="Hasil uji occlusion" />
        <ValueLine label="Enam bacaan" value={result.pumpOcclusion?.readings.map((value) => fmt(value)).join(' · ') ?? 'Belum lengkap'} />
        <ValueLine label="Rata-rata / batas" value={result.pumpOcclusion ? `${fmt(result.pumpOcclusion.mean)} / ${result.pumpOcclusion.limit} psi` : '—'} />
        <ValueLine label="Koreksi analyzer" value={result.pumpOcclusion ? `${fmt(result.pumpOcclusion.correction)} psi` : '—'} />
        <ValueLine label="Rata-rata terkoreksi" value={result.pumpOcclusion ? `${fmt(result.pumpOcclusion.correctedMean)} psi` : '—'} />
        <ValueLine label="U95" value={result.pumpOcclusion ? `${fmt(result.pumpOcclusion.uncertaintyU95)} psi` : '—'} />
        <View style={styles.resultLine}><Text style={styles.resultLabel}>Hasil uji</Text><Badge text={result.pumpOcclusion ? result.pumpOcclusion.pass ? 'LULUS' : 'TIDAK LULUS' : 'MENUNGGU'} tone={result.pumpOcclusion ? result.pumpOcclusion.pass ? 'good' : 'bad' : 'wait'} /></View>
      </Card>
    </> : <Card><Heading title="Hasil tiap titik kinerja" />
      {result.performance.map((row) => <View key={row.id} style={styles.resultPerformance}>
        <View style={styles.resultLine}><Text style={styles.resultLabel}>{row.label} · {row.setting} {row.unit}</Text><Badge text={row.result ? row.result.pass ? 'LULUS' : 'TIDAK LULUS' : 'KOSONG'} tone={row.result ? row.result.pass ? 'good' : 'bad' : 'wait'} /></View>
        <ValueLine label={row.formula === 'workbookComparisonAccuracy' ? 'Rata-rata UUT' : row.formula === 'workbookRange' ? 'Rentang max − min' : 'Rata-rata'} value={row.result ? fmt(row.formula === 'workbookRange' ? row.result.testValue : row.result.mean) : '—'} />
        {row.result?.standardMean !== undefined ? <ValueLine label="Rata-rata standar" value={fmt(row.result.standardMean)} /> : null}
        {row.formula !== 'workbookRange' ? <ValueLine label="Koreksi" value={row.result ? fmt(row.result.correction) : '—'} /> : null}
        {row.result?.standardMean !== undefined ? <ValueLine label="Status standar" value={row.result.standardPass ? 'Lulus' : 'Tidak lulus'} /> : null}
        <ValueLine label={row.formula === 'workbookRange' ? 'Rentang max − min / toleransi' : row.formula === 'workbookMinimum' || row.formula === 'workbookMaximum' ? 'Nilai keputusan / batas' : row.formula === 'workbookBand' ? 'Bacaan / rentang lulus' : row.includeUncertainty === false ? 'Galat / toleransi' : 'Koreksi + U95 / toleransi'} value={row.result ? row.formula === 'workbookBand' ? `${fmt(row.result.mean)} / ${row.minimumSetting}–${row.maximumSetting} ${row.unit}` : `${fmt(row.result.testValue)} / ${fmt(row.result.tolerance)}` : '—'} />
      </View>)}
    </Card>}
  </>;
}

export default function CalibrationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, updateRecord, storageError } = useRecords();
  const { customers, devices, equipmentMethods, customEquipment, loaded: directoryLoaded } = useAdminData();
  const record = useMemo<CalibrationRecord | undefined>(() => records.find((item) => item.id === String(id)), [records, id]);
  const [step, setStep] = useState(0);
  const instrument = record ? getRecordInstrument(record) : null;
  const data = record?.data;
  const result = instrument && data ? calculateRecord(instrument, data) : null;

  useEffect(() => {
    if (!record || !instrument || !data || !directoryLoaded) return;
    const legacyCustomer = customers.find((item) => item.name === data.identity.customer);
    const configuredMethod = (equipmentMethods.find((item) => item.instrumentId === instrument.id)?.method
      ?? customEquipment.find((item) => item.id === instrument.id)?.method)?.trim();
    const missingMethod = !data.identity.method?.trim() && configuredMethod;
    const legacyDevices = devices.filter((device) => instrument.standards.some((standard) => standard[3] === device.serial)).map(deviceSnapshot);
    const legacyThermohygrometer = devices.find((device) => device.serial === data.environment.standardId);
    const legacyReference = legacyThermohygrometer ? thermohygrometerProfile(legacyThermohygrometer) : null;
    const needsMigration = data.identity.customerId === undefined || data.selectedDevices === undefined || data.environment.reference === undefined || Boolean(missingMethod);
    const needsWeightInitialization = Boolean(instrument.weighingScale && data.weighing && !data.weighing.standardsInitialized);
    if (!needsMigration && !needsWeightInitialization) return;
    const weighing = needsWeightInitialization && data.weighing && instrument.weighingScale ? {
      ...data.weighing,
      points: data.weighing.points.map((point) => {
        const setting = instrument.weighingScale?.points.find((item) => item.id === point.id);
        if (!setting || point.standardWeights?.length) return point;
        const standardWeights = setting.defaultStandardWeightSerials.flatMap((serial) => {
          const device = devices.find((item) => item.serial === serial);
          const standard = device ? weighingStandardSnapshot(device) : null;
          return standard ? [standard] : [];
        });
        return { ...point, standardWeights };
      }),
      standardsInitialized: true,
    } : data.weighing;
    updateRecord(record.id, { data: {
      ...data,
      identity: data.identity.customerId === undefined || missingMethod ? { ...data.identity, ...(data.identity.customerId === undefined ? { customerId: legacyCustomer?.id ?? '' } : {}), ...(missingMethod ? { method: configuredMethod } : {}) } : data.identity,
      selectedDevices: data.selectedDevices ?? legacyDevices,
      environment: data.environment.reference === undefined
        ? { ...data.environment, standardId: legacyReference?.id ?? data.environment.standardId, reference: legacyReference }
        : data.environment,
      ...(weighing ? { weighing } : {}),
    } });
  }, [customers, data, devices, directoryLoaded, equipmentMethods, instrument, record, updateRecord]);

  if (!record || !instrument || !data || !result) return <SafeAreaView style={styles.safe}><Navbar title="Pengerjaan" onBack={() => router.replace('/')} backLabel="Kembali ke menu" /><View style={styles.missingScreen}><Text style={styles.outcomeTitle}>Catatan tidak ditemukan</Text><ActionButton title="Kembali ke catatan" onPress={() => router.replace('/')} /></View></SafeAreaView>;

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
      if (key !== 'setting') {
        if (readingIndex === undefined) return row;
        const readings = (row[key] ?? []).map((item, itemIndex) => itemIndex === readingIndex ? value : item);
        return { ...row, [key]: readings };
      }
      return { ...row, setting: value };
    });
    updateRecord(record.id, { data: { ...data, performance } });
  };
  const updateWeighingPoint = (index: number, key: 'zeroReading' | 'indication', value: string) => {
    if (!data.weighing) return;
    const points = data.weighing.points.map((point, pointIndex) => pointIndex === index ? { ...point, [key]: value } : point);
    updateRecord(record.id, { data: { ...data, weighing: { ...data.weighing, points } } });
  };
  const updateWeighingRepeatability = (index: number, key: 'zeroReading' | 'indication', value: string) => {
    if (!data.weighing) return;
    const repeatabilityReadings = data.weighing.repeatabilityReadings.map((reading, readingIndex) => readingIndex === index ? { ...reading, [key]: value } : reading);
    updateRecord(record.id, { data: { ...data, weighing: { ...data.weighing, repeatabilityReadings } } });
  };
  const updateSphygmomanometer = (sphygmomanometer: SphygmomanometerData) => updateRecord(record.id, { data: { ...data, sphygmomanometer } });
  const updateInfusionPump = (infusionPump: InfusionPumpData) => updateRecord(record.id, { data: { ...data, infusionPump } });
  const updateSuctionPump = (suctionPump: SuctionPumpData) => updateRecord(record.id, { data: { ...data, suctionPump } });
  const updateWeighingWeights = (index: number, standardWeights: WeighingStandardWeight[]) => {
    if (!data.weighing) return;
    const points = data.weighing.points.map((point, pointIndex) => pointIndex === index ? { ...point, standardWeights } : point);
    updateRecord(record.id, { data: { ...data, weighing: { ...data.weighing, points } } });
  };
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <Navbar title={instrument.name} subtitle="Lembar kerja kalibrasi" onBack={() => router.replace('/')} backLabel="Kembali ke menu" action={{ label: <Text style={{ color: '#0F6B64', fontWeight: '900', fontSize: 13 }}>ƒx</Text>, accessibilityLabel: 'Buka rumus dan standar', onPress: () => router.push(`/rumus?recordId=${record.id}`) }} />
    <StepTabs current={step} onChange={setStep} />
    {storageError ? <View style={styles.storageMessage}><Text style={styles.storageMessageText}>{storageError}</Text></View> : null}
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? <IdentityStep data={data} instrument={instrument} customers={customers} loaded={directoryLoaded} update={update} selectCustomer={selectCustomer} /> : null}
        {step === 1 ? <SelectDevicesStep instrument={instrument} data={data} devices={devices} loaded={directoryLoaded} onToggle={toggleDevice} onReference={selectThermohygrometer} onToggleWeights={updateWeighingWeights} /> : null}
        {step === 2 ? <MeasurementStep data={data} instrument={instrument} result={result} update={update} updateInspection={updateInspection} updatePerformance={updatePerformance} updateWeighingPoint={updateWeighingPoint} updateWeighingRepeatability={updateWeighingRepeatability} updateSphygmomanometer={updateSphygmomanometer} updateInfusionPump={updateInfusionPump} updateSuctionPump={updateSuctionPump} /> : null}
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
