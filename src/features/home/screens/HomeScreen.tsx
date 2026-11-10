import React, { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Navbar } from '../../../components/Navbar';
import { calculateRecord } from '../../../core/calculations';
import { useAdminData } from '../../admin/hooks/useAdminData';
import { getRecordInstrument } from '../../../core/instruments';
import { useRecords } from '../../work-orders/hooks/useRecords';
import { useRole } from '../hooks/useRole';
import { styles } from '../styles/HomeScreenStyles';

export default function HomeScreen() {
  const router = useRouter();
  const directory = useAdminData();
  const { records } = useRecords();
  const { role } = useRole();
  const taskCounts = useMemo(() => {
    let drafts = 0;
    let pendingDocuments = 0;
    records.forEach((record) => {
      const instrument = getRecordInstrument(record);
      if (!instrument) return;
      const complete = calculateRecord(instrument, record.data).complete;
      if (!complete) drafts += 1;
      else if (!record.data.identity.issueDate.trim()) pendingDocuments += 1;
    });
    return { drafts, pendingDocuments };
  }, [records]);

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <Navbar title="KALIBRASI" subtitle="MEDICAL WORKSPACE" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.welcomeBlock}>
        <Text style={styles.eyebrow}>{role === 'admin' ? 'RUANG KERJA ADMIN' : 'RUANG KERJA TEKNISI'}</Text>
        <Text style={styles.welcomeTitle}>{role === 'admin' ? 'Halo, Admin.' : 'Halo, Teknisi.'}</Text>
        <Text style={styles.welcomeHint}>{role === 'admin' ? 'Pantau data operasional dan hasil kalibrasi.' : 'Mulai pekerjaan baru atau lanjutkan draft.'}</Text>
      </View>

      {role === 'admin' ? <>
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeading}>
            <View><Text style={styles.overviewEyebrow}>RINGKASAN</Text><Text style={styles.overviewTitle}>Data operasional</Text></View>
            <View style={styles.overviewMark}><Text style={styles.overviewMarkText}>K</Text></View>
          </View>
          <View style={styles.metricsGrid}>
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.customers.length}</Text><Text style={styles.metricLabel}>Pelanggan</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.devices.length}</Text><Text style={styles.metricLabel}>Standar kalibrasi</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.technicians.length}</Text><Text style={styles.metricLabel}>Teknisi</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.equipmentMethods.length + directory.customEquipment.length}</Text><Text style={styles.metricLabel}>Jenis alkes</Text></View>
          </View>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusCard}><Text style={styles.statusValue}>{taskCounts.drafts}</Text><Text style={styles.statusTitle}>Pengerjaan belum selesai</Text><Text style={styles.statusHint}>Draft teknisi</Text></View>
          <View style={[styles.statusCard, styles.statusCardAccent]}><Text style={styles.statusValue}>{taskCounts.pendingDocuments}</Text><Text style={styles.statusTitle}>Perlu dokumen admin</Text><Text style={styles.statusHint}>Hasil siap ditinjau</Text></View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Cek hasil teknisi" onPress={() => router.push('/admin/results')} style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}>
          <View style={styles.reviewIcon}><Text style={styles.reviewIconText}>HASIL</Text></View>
          <View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Tinjau hasil teknisi</Text><Text style={styles.reviewHint}>{taskCounts.pendingDocuments ? `${taskCounts.pendingDocuments} hasil menunggu tanggal terbit sertifikat.` : 'Buka daftar hasil dan kelola dokumennya.'}</Text></View>
          <Text style={styles.reviewArrow}>›</Text>
        </Pressable>
        <Text style={styles.menuHint}>Pelanggan, standar, teknisi, dan katalog alkes tersedia di Menu.</Text>
      </> : <>
        <View style={styles.technicianHero}>
          <Text style={styles.overviewEyebrow}>PEKERJAAN BARU</Text>
          <Text style={styles.technicianTitle}>Mulai kalibrasi</Text>
          <Text style={styles.technicianHint}>Pilih pelanggan dan alat yang akan dikalibrasi, lalu isi hasil pengujiannya.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/form')} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}><Text style={styles.startButtonText}>Mulai pengerjaan</Text><Text style={styles.startArrow}>→</Text></Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Buka pekerjaan tertunda" onPress={() => router.push('/draft')} style={({ pressed }) => [styles.draftCard, pressed && styles.pressed]}>
          <View style={styles.draftIcon}><Text style={styles.draftIconText}>D</Text></View>
          <View style={styles.draftCopy}><Text style={styles.draftTitle}>Pekerjaan tertunda</Text><Text style={styles.draftHint}>{taskCounts.drafts ? `${taskCounts.drafts} draft menunggu dilanjutkan.` : 'Belum ada draft yang perlu dilanjutkan.'}</Text></View>
          <View style={styles.draftCount}><Text style={styles.draftCountText}>{taskCounts.drafts}</Text></View>
        </Pressable>
        <Text style={styles.menuHint}>Rumus dan standar kalibrasi dapat dibuka dari Menu.</Text>
      </>}

      <View style={styles.footer}><View style={styles.footerRule} /><Text style={styles.footerText}>DATA TERSIMPAN DI PERANGKAT INI</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
