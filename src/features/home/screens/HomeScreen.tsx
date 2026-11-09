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

const adminMenus = [
  { path: '/admin/customers', title: 'Pelanggan', subtitle: 'Rumah sakit dan PIC', countKey: 'customers' },
  { path: '/admin/devices', title: 'Standar kalibrasi', subtitle: 'Alat ukur dan sertifikat', countKey: 'devices' },
  { path: '/admin/technicians', title: 'Teknisi', subtitle: 'Petugas pelaksana', countKey: 'technicians' },
  { path: '/admin/instruments', title: 'Katalog Alkes', subtitle: 'Jenis alat & metode kerja', countKey: 'equipmentMethods' },
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const directory = useAdminData();
  const { records } = useRecords();
  const { role, setRole } = useRole();
  const draftCount = useMemo(() => records.filter((record) => {
    if (record.isDemo) return false;
    const instrument = getRecordInstrument(record);
    return instrument ? !calculateRecord(instrument, record.data).complete : false;
  }).length, [records]);
  const reviewCount = useMemo(() => records.filter((record) => !record.isDemo
    && (!record.data.identity.documentNumber.trim() || !record.data.identity.orderNumber?.trim() || !record.data.identity.issueDate.trim())).length, [records]);

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <Navbar title="KALIBRASI" subtitle="MEDICAL WORKSPACE" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={styles.welcomeBlock}>
        <Text style={styles.eyebrow}>RUANG KERJA</Text>
        <Text style={styles.welcomeTitle}>{role === 'admin' ? 'Halo, Admin.' : 'Halo, Teknisi.'}</Text>
        <Text style={styles.welcomeHint}>{role === 'admin' ? 'Semua data operasional kalibrasi ada di sini.' : 'Lanjutkan draft atau mulai pemeriksaan baru.'}</Text>
      </View>

      <View style={styles.roleSwitch} accessibilityRole="tablist">
        {(['admin', 'technician'] as const).map((option) => <Pressable key={option} accessibilityRole="tab" accessibilityState={{ selected: role === option }} onPress={() => setRole(option)} style={[styles.roleOption, role === option && styles.roleOptionActive]}>
          <Text style={[styles.roleOptionText, role === option && styles.roleOptionTextActive]}>{option === 'admin' ? 'Admin' : 'Teknisi'}</Text>
        </Pressable>)}
      </View>

      {role === 'admin' ? <>
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeading}><View><Text style={styles.overviewEyebrow}>RINGKASAN DATA</Text><Text style={styles.overviewTitle}>Operasional</Text></View><View style={styles.overviewMark}><Text style={styles.overviewMarkText}>K</Text></View></View>
          <View style={styles.metrics}>
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.customers.length}</Text><Text style={styles.metricLabel}>Pelanggan</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.devices.length}</Text><Text style={styles.metricLabel}>Standar</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricValue}>{directory.technicians.length}</Text><Text style={styles.metricLabel}>Teknisi</Text></View>
          </View>
        </View>

        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Kelola data</Text><Text style={styles.sectionMeta}>MASTER DATA</Text></View>
        <View style={styles.actionGrid}>
          {adminMenus.map((item, index) => <Pressable key={item.path} accessibilityRole="button" accessibilityLabel={`Buka data ${item.title}`} onPress={() => router.push(item.path as never)} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
            <View style={[styles.actionMark, index === 1 && styles.actionMarkBlue, index === 2 && styles.actionMarkGold]}><Text style={[styles.actionMarkText, index === 1 && styles.actionMarkTextBlue, index === 2 && styles.actionMarkTextGold]}>{['RS', 'AM', 'TK', 'AK'][index]}</Text></View>
            <Text style={styles.actionCount}>{item.countKey === 'equipmentMethods' ? directory.equipmentMethods.length + directory.customEquipment.length : directory[item.countKey].length} {item.countKey === 'equipmentMethods' ? 'alkes' : 'data'}</Text>
            <Text style={styles.actionTitle}>{item.title}</Text>
            <Text style={styles.actionSubtitle}>{item.subtitle}</Text>
            <Text style={styles.actionArrow}>↗</Text>
          </Pressable>)}
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="Cek hasil teknisi" onPress={() => router.push('/admin/results')} style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}>
          <View style={styles.reviewIcon}><Text style={styles.reviewIconText}>HASIL</Text></View>
          <View style={styles.reviewCopy}><Text style={styles.reviewTitle}>Cek hasil teknisi</Text><Text style={styles.reviewHint}>{reviewCount ? `${reviewCount} perlu dokumen admin` : 'Tinjau hasil dan dokumen sertifikat'}</Text></View>
          <Text style={styles.reviewArrow}>›</Text>
        </Pressable>
      </> : <>
        <View style={styles.technicianHero}>
          <Text style={styles.overviewEyebrow}>PEKERJAAN BARU</Text>
          <Text style={styles.technicianTitle}>Mulai kalibrasi</Text>
          <Text style={styles.technicianHint}>Pilih jenis kalibrasi, isi identitas, lalu masukkan hasil pengukuran.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/form')} style={({ pressed }) => [styles.startButton, pressed && styles.pressed]}><Text style={styles.startButtonText}>Pilih jenis kalibrasi</Text><Text style={styles.startArrow}>→</Text></Pressable>
        </View>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>Alat bantu</Text></View>
        <View style={styles.technicianActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/draft')} style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}>
            <View style={styles.toolTop}><Text style={styles.toolCode}>DRAFT</Text><Text style={styles.toolCount}>{draftCount}</Text></View>
            <Text style={styles.toolTitle}>Pekerjaan tertunda</Text><Text style={styles.toolHint}>Buka dan lanjutkan pengisian</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/rumus')} style={({ pressed }) => [styles.toolCard, pressed && styles.pressed]}>
            <View style={styles.toolTop}><Text style={styles.toolCode}>REFERENSI</Text><Text style={styles.toolCount}>ƒx</Text></View>
            <Text style={styles.toolTitle}>Rumus kalibrasi</Text><Text style={styles.toolHint}>Lihat formula dan standar alat</Text>
          </Pressable>
        </View>
      </>}

      <View style={styles.footer}><View style={styles.footerRule} /><Text style={styles.footerText}>DATA TERSIMPAN DI PERANGKAT INI</Text></View>
    </ScrollView>
  </SafeAreaView>;
}
