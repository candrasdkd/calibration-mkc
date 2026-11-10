import { useCallback, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ActionButton, Card, Field, Heading } from '../../../components/ui';
import { defaultDocumentNumberSettings, loadDocumentNumberSettings, localDateString, previewDocumentNumber, saveDocumentNumberSettings, type DocumentNumberSettings } from '../../../core/documentNumbering';
import { colors } from '../../../core/theme';

export function DocumentNumberSettingsCard() {
  const [settings, setSettings] = useState(defaultDocumentNumberSettings);
  const [loaded, setLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState('');
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoaded(false);
    void loadDocumentNumberSettings().then((value) => {
      if (active) { setSettings(value); setLoadingError(''); }
    }).catch((error) => {
      if (active) setLoadingError(error instanceof Error ? error.message : 'Pengaturan nomor dokumen gagal dimuat.');
    }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []));

  const update = (key: keyof DocumentNumberSettings, value: string) => setSettings((current) => ({ ...current, [key]: value.toUpperCase() }));
  const save = async () => {
    setSaving(true);
    try {
      setSettings(await saveDocumentNumberSettings(settings));
      setLoadingError('');
      Alert.alert('Tersimpan', 'Kode nomor dokumen yang baru berlaku untuk nomor berikutnya. Nomor yang sudah terbit tidak berubah.');
    } catch (error) {
      Alert.alert('Pengaturan gagal disimpan', error instanceof Error ? error.message : 'Periksa koneksi lalu coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return <Card>
    <Heading title="Penomoran dokumen" hint="Nomor berjalan lintas pelanggan dan alat, lalu mulai lagi dari 001 setiap bulan. Kode dapat diganti; nomor lama tetap." />
    {loadingError ? <Text style={{ color: colors.danger, fontSize: 12, lineHeight: 18, marginBottom: 10 }}>{loadingError}</Text> : null}
    <Field label="Kode perusahaan" value={settings.companyCode} onChange={(value) => update('companyCode', value)} placeholder="MKC" autoCapitalize="characters" />
    <Field label="Kode order" value={settings.orderCode} onChange={(value) => update('orderCode', value)} placeholder="FOC" autoCapitalize="characters" />
    <Field label="Kode sertifikat" value={settings.certificateCode} onChange={(value) => update('certificateCode', value)} placeholder="SK" autoCapitalize="characters" />
    <View style={{ backgroundColor: colors.canvas, borderRadius: 12, padding: 12, gap: 5, marginBottom: 14 }}>
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800' }}>CONTOH FORMAT BULAN INI</Text>
      <Text style={{ color: colors.ink, fontSize: 13 }}>Order · {previewDocumentNumber(settings, 'order', localDateString())}</Text>
      <Text style={{ color: colors.ink, fontSize: 13 }}>Sertifikat · {previewDocumentNumber(settings, 'certificate', localDateString())}</Text>
    </View>
    <ActionButton title={saving ? 'Menyimpan…' : 'Simpan format nomor'} onPress={() => { void save(); }} disabled={!loaded || saving} />
  </Card>;
}
