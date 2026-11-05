import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, Choice, ConfirmModal, Field, Heading } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import type { MeasuringDevice, ThermohygrometerCertificate } from '../../../core/admin-data';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import type { Confirmation } from '../types/Confirmation';

const blankCertificate = (): ThermohygrometerCertificate => ({
  temperature: [15, 20, 25, 30, 35, 37].map((value) => ({ value: String(value), correction: '' })),
  humidity: [30, 40, 50, 60, 70, 80].map((value) => ({ value: String(value), correction: '' })),
  temperatureU95: '', humidityU95: '',
});

const blankDevice = (): MeasuringDevice => ({ id: '', name: '', brand: '', model: '', serial: '', isThermohygrometer: false, certificate: null, isDemo: false });

export function DevicesScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<MeasuringDevice | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [expandedName, setExpandedName] = useState<string | null>(null);
  const [selectedSerial, setSelectedSerial] = useState<string | null>(null);
  const locked = !data.loaded || Boolean(data.storageError);
  const deviceGroups = [...new Set(data.devices.map((device) => device.name.trim().toLowerCase()))].map((key) => {
    const devices = data.devices.filter((device) => device.name.trim().toLowerCase() === key);
    return { key, name: devices[0]?.name ?? key, devices };
  });
  const editDevice = (device: MeasuringDevice) => {
    setSelectedSerial(null);
    setEditing({ ...device, certificate: device.certificate ? { ...device.certificate, temperature: device.certificate.temperature.map((point) => ({ ...point })), humidity: device.certificate.humidity.map((point) => ({ ...point })) } : device.isThermohygrometer ? blankCertificate() : null });
  };
  const updateCertificate = (update: (certificate: ThermohygrometerCertificate) => ThermohygrometerCertificate) => setEditing((current) => current
    ? { ...current, certificate: update(current.certificate ?? blankCertificate()) }
    : current);
  const save = () => {
    if (!editing?.name.trim() || !editing.brand.trim() || !editing.model.trim() || !editing.serial.trim()) { Alert.alert('Data belum lengkap', 'Isi nama alat, merek, tipe, dan nomor seri.'); return; }
    if (data.devices.some((device) => device.id !== editing.id && device.serial.trim().toLowerCase() === editing.serial.trim().toLowerCase())) { Alert.alert('Nomor seri sudah terdaftar', 'Gunakan data alat yang sudah ada, atau periksa kembali nomor seri.'); return; }
    if (editing.isThermohygrometer) {
      const certificate = editing.certificate;
      const numeric = (value: string) => value.trim() ? Number(value.replace(',', '.')) : Number.NaN;
      const validPoints = (points: ThermohygrometerCertificate['temperature']) => points.length >= 2
        && points.every((point, index) => Number.isFinite(numeric(point.value)) && Number.isFinite(numeric(point.correction))
          && (index === 0 || numeric(point.value) > numeric(points[index - 1].value)));
      if (!certificate || !validPoints(certificate.temperature) || !validPoints(certificate.humidity)
        || !Number.isFinite(numeric(certificate.temperatureU95)) || numeric(certificate.temperatureU95) < 0
        || !Number.isFinite(numeric(certificate.humidityU95)) || numeric(certificate.humidityU95) < 0) {
        Alert.alert('Data sertifikat belum lengkap', 'Isi minimal dua titik suhu dan kelembaban berurutan, koreksi setiap titik, serta nilai U95.'); return;
      }
    }
    const device = editing;
    setConfirmation({ title: device.id ? 'Simpan perubahan alat ukur?' : 'Tambahkan alat ukur?', message: `${device.name} akan tersedia di daftar pilihan teknisi.`, confirmLabel: 'Simpan', onConfirm: () => { data.saveDevice(device); setEditing(null); setExpandedName(device.name.trim().toLowerCase()); setSelectedSerial(device.id || null); } });
  };
  const remove = (device: MeasuringDevice) => setConfirmation({ title: 'Hapus alat ukur?', message: `${device.name} · ${device.serial} akan dihapus dari daftar.`, confirmLabel: 'Hapus', danger: true, onConfirm: () => { data.deleteDevice(device.id); setSelectedSerial(null); } });
  return <ScreenPage title="Data alat ukur" hint="Kelola alat standar yang digunakan teknisi.">
    <StorageMessage message={data.storageError} />
    <ActionButton title="＋ Tambah alat ukur" onPress={() => setEditing(blankDevice())} disabled={locked} />
    <Text style={styles.groupInstruction}>Pilih nama alat untuk melihat nomor seri yang terdaftar.</Text>
    {deviceGroups.map((group) => {
      const expanded = expandedName === group.key;
      return <Card key={group.key} style={styles.groupCard}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => { setExpandedName(expanded ? null : group.key); if (expanded) setSelectedSerial(null); }} style={styles.groupHeader}>
          <View style={[styles.entityAvatar, styles.deviceAvatar]}><Text style={styles.entityAvatarText}>AM</Text></View>
          <View style={styles.entityCopy}><Text style={styles.entityTitle}>{group.name}</Text><Text style={styles.entitySubtitle}>{group.devices.length} nomor seri terdaftar</Text></View>
          <View style={styles.groupToggle}><Text style={styles.groupToggleText}>{expanded ? '−' : '+'}</Text></View>
        </Pressable>
        {expanded ? <View style={styles.serialList}>
          {group.devices.map((device, index) => {
            const selected = selectedSerial === device.id;
            return <View key={device.id} style={styles.serialItem}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSelectedSerial(selected ? null : device.id)} style={[styles.serialRow, selected && styles.serialRowSelected]}>
                <View style={styles.serialIndex}><Text style={styles.serialIndexText}>{String(index + 1).padStart(2, '0')}</Text></View>
                <View style={styles.serialCopy}><Text style={styles.serialNumber}>{device.serial}</Text><Text style={styles.serialMeta}>{device.brand} · {device.model}</Text></View>
                {device.isDemo ? <Badge text="Contoh" tone="wait" /> : null}
              </Pressable>
              {selected ? <View style={styles.serialDetail}>
                <View style={styles.detailLine}><Text style={styles.blockLabel}>MEREK</Text><Text style={styles.detailValue}>{device.brand}</Text></View>
                <View style={styles.detailLine}><Text style={styles.blockLabel}>TIPE / MODEL</Text><Text style={styles.detailValue}>{device.model}</Text></View>
                <View style={styles.detailLine}><Text style={styles.blockLabel}>JENIS ALAT</Text><Text style={styles.detailValue}>{device.isThermohygrometer ? 'Thermohygrometer' : 'Alat ukur lain'}</Text></View>
                {device.isThermohygrometer && device.certificate ? <View style={styles.certificateDetails}>
                  <Text style={styles.certificateHeading}>SERTIFIKAT ACUAN</Text>
                  <Text style={styles.certificateCaption}>TITIK SUHU · U95 {device.certificate.temperatureU95} °C</Text>
                  <View style={styles.pointChips}>{device.certificate.temperature.map((point, pointIndex) => <Text key={`t-${pointIndex}`} style={styles.pointChip}>{point.value}° → {point.correction}°</Text>)}</View>
                  <Text style={styles.certificateCaption}>TITIK KELEMBABAN · U95 {device.certificate.humidityU95}%</Text>
                  <View style={styles.pointChips}>{device.certificate.humidity.map((point, pointIndex) => <Text key={`h-${pointIndex}`} style={styles.pointChip}>{point.value}% → {point.correction}%</Text>)}</View>
                </View> : null}
                <View style={styles.actions}><ActionButton title="Ubah data" secondary onPress={() => editDevice(device)} disabled={locked} /><ActionButton title="Hapus" danger onPress={() => remove(device)} disabled={locked} /></View>
              </View> : null}
            </View>;
          })}
        </View> : null}
      </Card>;
    })}
    <Modal visible={Boolean(editing)} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditing(null)}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}>
            <Text style={styles.deviceModalTitle}>{editing?.id ? 'Ubah alat ukur' : 'Alat ukur baru'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup form alat ukur" onPress={() => setEditing(null)}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable>
          </View>
          {editing ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled">
            <Card>
              <Field label="Nama alat ukur" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
              <Field label="Merek" value={editing.brand} onChange={(brand) => setEditing({ ...editing, brand })} />
              <Field label="Tipe / model" value={editing.model} onChange={(model) => setEditing({ ...editing, model })} />
              <Field label="Nomor seri" value={editing.serial} onChange={(serial) => setEditing({ ...editing, serial })} />
              <Choice label="Jenis alat ukur" value={editing.isThermohygrometer} options={[{ value: false, label: 'Alat ukur lain' }, { value: true, label: 'Thermohygrometer' }]} onChange={(isThermohygrometer) => setEditing({ ...editing, isThermohygrometer, certificate: isThermohygrometer ? editing.certificate ?? blankCertificate() : editing.certificate })} />
              {editing.isThermohygrometer ? <>
                <Heading title="Data sertifikat thermohygrometer" hint="Isi titik sesuai sertifikat alat. Data ini dipakai menghitung koreksi suhu dan kelembaban." />
                <Field label="U95 suhu" value={editing.certificate?.temperatureU95} onChange={(temperatureU95) => updateCertificate((certificate) => ({ ...certificate, temperatureU95 }))} keyboard="decimal-pad" suffix="°C" />
                {editing.certificate?.temperature.map((point, index) => <View key={`temperature-${index}`} style={styles.correctionRow}>
                  <View style={styles.correctionInputs}><View style={styles.correctionInput}><Field label={`Suhu ${index + 1} · nilai`} value={point.value} onChange={(value) => updateCertificate((certificate) => ({ ...certificate, temperature: certificate.temperature.map((item, i) => i === index ? { ...item, value } : item) }))} keyboard="decimal-pad" suffix="°C" /></View>
                  <View style={styles.correctionInput}><Field label="Koreksi" value={point.correction} onChange={(correction) => updateCertificate((certificate) => ({ ...certificate, temperature: certificate.temperature.map((item, i) => i === index ? { ...item, correction } : item) }))} keyboard="decimal-pad" suffix="°C" /></View></View>
                  <ActionButton title="Hapus titik suhu" secondary danger onPress={() => setConfirmation({ title: 'Hapus titik suhu?', message: 'Titik koreksi ini akan dihapus dari sertifikat acuan.', confirmLabel: 'Hapus titik', danger: true, onConfirm: () => updateCertificate((certificate) => ({ ...certificate, temperature: certificate.temperature.filter((_, i) => i !== index) })) })} />
                </View>)}
                <ActionButton title="＋ Tambah titik suhu" secondary onPress={() => updateCertificate((certificate) => ({ ...certificate, temperature: [...certificate.temperature, { value: '', correction: '' }] }))} />
                <Field label="U95 kelembaban" value={editing.certificate?.humidityU95} onChange={(humidityU95) => updateCertificate((certificate) => ({ ...certificate, humidityU95 }))} keyboard="decimal-pad" suffix="%" />
                {editing.certificate?.humidity.map((point, index) => <View key={`humidity-${index}`} style={styles.correctionRow}>
                  <View style={styles.correctionInputs}><View style={styles.correctionInput}><Field label={`RH ${index + 1} · nilai`} value={point.value} onChange={(value) => updateCertificate((certificate) => ({ ...certificate, humidity: certificate.humidity.map((item, i) => i === index ? { ...item, value } : item) }))} keyboard="decimal-pad" suffix="%" /></View>
                  <View style={styles.correctionInput}><Field label="Koreksi" value={point.correction} onChange={(correction) => updateCertificate((certificate) => ({ ...certificate, humidity: certificate.humidity.map((item, i) => i === index ? { ...item, correction } : item) }))} keyboard="decimal-pad" suffix="%" /></View></View>
                  <ActionButton title="Hapus titik kelembaban" secondary danger onPress={() => setConfirmation({ title: 'Hapus titik kelembaban?', message: 'Titik koreksi ini akan dihapus dari sertifikat acuan.', confirmLabel: 'Hapus titik', danger: true, onConfirm: () => updateCertificate((certificate) => ({ ...certificate, humidity: certificate.humidity.filter((_, i) => i !== index) })) })} />
                </View>)}
                <ActionButton title="＋ Tambah titik kelembaban" secondary onPress={() => updateCertificate((certificate) => ({ ...certificate, humidity: [...certificate.humidity, { value: '', correction: '' }] }))} />
              </> : null}
              <View style={styles.actions}><ActionButton title="Simpan alat ukur" onPress={save} disabled={locked} /><ActionButton title="Batal" secondary onPress={() => setEditing(null)} /></View>
            </Card>
          </ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
