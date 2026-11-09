import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File, Paths } from 'expo-file-system';
import { ActionButton, Card, Heading } from '../../../components/ui';
import { colors } from '../../../core/theme';
import type { EquipmentPhotos } from '../../../core/types';
import { styles } from '../styles/CalibrationScreenStyles';

const sides: { key: keyof EquipmentPhotos; label: string }[] = [
  { key: 'front', label: 'Depan' },
  { key: 'back', label: 'Belakang' },
  { key: 'left', label: 'Samping kiri' },
  { key: 'right', label: 'Samping kanan' },
];

const emptyPhotos: EquipmentPhotos = { front: '', back: '', left: '', right: '' };

export function EquipmentPhotoStep({ photos, onChange }: {
  photos?: EquipmentPhotos;
  onChange: (side: keyof EquipmentPhotos, uri: string) => void;
}) {
  const [busy, setBusy] = useState<keyof EquipmentPhotos | null>(null);
  const current = photos ?? emptyPhotos;

  const choosePhoto = async (side: keyof EquipmentPhotos, useCamera: boolean) => {
    setBusy(side);
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Izin kamera diperlukan', 'Izinkan akses kamera di pengaturan perangkat untuk mengambil foto alat.');
          return;
        }
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.75 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.75 });
      const asset = result.canceled ? undefined : result.assets[0];
      if (!asset) return;

      const extension = asset.fileName?.match(/\.([^.]+)$/)?.[1]
        ?? asset.uri.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1]
        ?? asset.mimeType?.split('/')[1]
        ?? 'jpg';
      const fileName = `kalibrasi-${Date.now()}-${side}.${extension.replace(/[^a-z0-9]/gi, '') || 'jpg'}`;
      const destination = new File(Paths.document, fileName);
      await new File(asset.uri).copy(destination);
      // shortcut: replaced photo files remain on-device; clean them up once record storage can confirm persistence.
      onChange(side, destination.uri);
    } catch {
      Alert.alert('Foto gagal disimpan', 'Coba ambil atau pilih foto lagi.');
    } finally {
      setBusy(null);
    }
  };

  return <Card>
      <Heading title="Foto alat" hint="Dokumentasikan alat dari empat sisi. Foto bersifat opsional dan tersimpan bersama draft pengerjaan." />
      {sides.map(({ key, label }) => <View key={key} style={styles.equipmentPhotoCard}>
        <View style={styles.equipmentPhotoHeading}>
          <Text style={styles.equipmentPhotoTitle}>{label}</Text>
          <Text style={styles.equipmentPhotoStatus}>{current[key] ? 'TERSIMPAN' : 'BELUM ADA'}</Text>
        </View>
        {current[key]
          ? <Image accessibilityLabel={`Foto alat sisi ${label}`} source={{ uri: current[key] }} resizeMode="cover" style={styles.equipmentPhotoPreview} />
          : <View style={styles.equipmentPhotoPlaceholder}><Text style={styles.equipmentPhotoPlaceholderText}>Foto sisi {label.toLowerCase()} belum ditambahkan</Text></View>}
        <View style={styles.equipmentPhotoActions}>
          <View style={styles.equipmentPhotoAction}><ActionButton title={busy === key ? 'Memproses…' : 'Ambil foto'} onPress={() => choosePhoto(key, true)} disabled={busy !== null} /></View>
          <View style={styles.equipmentPhotoAction}><ActionButton title="Pilih foto" secondary onPress={() => choosePhoto(key, false)} disabled={busy !== null} /></View>
        </View>
        {busy === key ? <View style={styles.equipmentPhotoBusy}><ActivityIndicator color={colors.primary} /><Text style={styles.equipmentPhotoBusyText}>Menyimpan foto…</Text></View> : null}
      </View>)}
  </Card>;
}
