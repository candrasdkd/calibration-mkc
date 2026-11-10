import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Navbar } from '../../../components/Navbar';
import { ActionButton, Card, ConfirmModal, Heading } from '../../../components/ui';
import { useRole } from '../hooks/useRole';
import { styles } from '../styles/ProfileScreenStyles';

export default function ProfileScreen() {
  const router = useRouter();
  const { role, userName, signOut, isServerSession } = useRole();
  const isAdmin = role === 'admin';
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      router.replace('/login');
    } catch {
      Alert.alert('Logout gagal', 'Sesi belum bisa dihapus. Periksa koneksi lalu coba lagi.');
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <Navbar title="Profil" subtitle="AKUN DAN PREFERENSI" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROFIL PERAN</Text>
      <Card style={styles.profileCard}>
        <View style={[styles.avatar, isAdmin ? styles.adminAvatar : styles.technicianAvatar]}><Text style={styles.avatarText}>{isAdmin ? 'AD' : 'TK'}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.roleLabel}>SESI AKTIF · {isAdmin ? 'ADMIN' : 'TEKNISI'}</Text>
          <Text style={styles.profileTitle}>{userName || (isAdmin ? 'Admin lokal' : 'Teknisi lokal')}</Text>
          <Text style={styles.profileSubtitle}>{isServerSession ? 'Akun Supabase' : 'Login demo lokal'}</Text>
        </View>
      </Card>

      <Card>
        <Heading title={isServerSession ? 'Sesi server' : 'Sesi lokal'} hint={isServerSession ? 'Akun diverifikasi Supabase. Data operasional disinkronkan ke server dan disimpan di perangkat sebagai cache.' : 'Autentikasi server belum terhubung. Logout akan menutup sesi, tetapi tidak menghapus data kalibrasi di perangkat.'} />
        <ActionButton title={loggingOut ? 'Keluar…' : 'Logout'} danger onPress={() => setConfirmLogout(true)} disabled={loggingOut} />
      </Card>

      <Card style={styles.localCard}>
        <Text style={styles.localTitle}>{isServerSession ? 'Data lokal & Supabase' : 'Data tersimpan lokal'}</Text>
        <Text style={styles.localHint}>{isServerSession ? 'Saat akun server aktif dan koneksi tersedia, data pelanggan, standar, metode, dan pengerjaan disinkronkan ke Supabase. Salinan lokal dipakai sebagai cache dan tidak dihapus saat logout.' : 'Nama pengguna dan peran sesi demo tersimpan di perangkat ini. Data pelanggan, standar, metode, dan pengerjaan tetap ada setelah logout.'}</Text>
      </Card>
    </ScrollView>
    <ConfirmModal visible={confirmLogout} title="Keluar dari sesi?" message="Kamu akan kembali ke halaman login. Data lokal tidak akan dihapus." confirmLabel="Logout" onCancel={() => setConfirmLogout(false)} onConfirm={logout} />
  </SafeAreaView>;
}
