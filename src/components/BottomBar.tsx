import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { usePathname, useRouter } from 'expo-router';
import { type Role } from '../core/role';
import { useRole } from '../features/home/hooks/useRole';
import { colors } from '../core/theme';

const menuItems: Record<Role, { path: string; title: string; subtitle: string; mark: string }[]> = {
  admin: [
    { path: '/admin/customers', title: 'Pelanggan', subtitle: 'Rumah sakit dan PIC', mark: 'RS' },
    { path: '/admin/devices', title: 'Standar kalibrasi', subtitle: 'Alat ukur dan data sertifikat', mark: 'AM' },
    { path: '/admin/technicians', title: 'Teknisi', subtitle: 'Data petugas pelaksana', mark: 'TK' },
    { path: '/admin/instruments', title: 'Katalog Alkes', subtitle: 'Jenis alat dan metode kerja', mark: 'AK' },
    { path: '/admin/results', title: 'Cek hasil teknisi', subtitle: 'Tinjau hasil dan dokumen', mark: 'HASIL' },
  ],
  technician: [
    { path: '/form', title: 'Mulai kalibrasi', subtitle: 'Buat pengerjaan baru', mark: 'MULAI' },
    { path: '/draft', title: 'Pekerjaan tertunda', subtitle: 'Lanjutkan draft kalibrasi', mark: 'DRAFT' },
    { path: '/rumus', title: 'Rumus kalibrasi', subtitle: 'Lihat formula dan standar alat', mark: 'ƒx' },
  ],
};

function TabIcon({ kind, active }: { kind: 'dashboard' | 'profile' | 'menu'; active?: boolean }) {
  const color = active ? colors.primary : colors.muted;
  if (kind === 'dashboard') return <Text style={[styles.dashboardGlyph, { color }]}>⌂</Text>;
  if (kind === 'profile') return <View style={styles.profileIcon}>
    <View style={[styles.profileHead, { backgroundColor: color }]} />
    <View style={[styles.profileShoulders, { backgroundColor: color }]} />
  </View>;
  return <View style={styles.menuGrid}>{[0, 1, 2, 3].map((item) => <View key={item} style={styles.menuTile} />)}</View>;
}

export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { role } = useRole();
  const [menuVisible, setMenuVisible] = useState(false);
  if (pathname !== '/' && pathname !== '/profile') return null;

  const isDashboard = pathname === '/';
  const barHeight = 70;
  const center = width / 2;
  const barPath = `M 0 18 Q 0 0 18 0 H ${center - 62} C ${center - 39} 0 ${center - 43} 27 ${center - 23} 38 C ${center - 12} 45 ${center + 12} 45 ${center + 23} 38 C ${center + 43} 27 ${center + 39} 0 ${center + 62} 0 H ${width - 18} Q ${width} 0 ${width} 18 V ${barHeight - 15} Q ${width} ${barHeight} ${width - 15} ${barHeight} H 15 Q 0 ${barHeight} 0 ${barHeight - 15} Z`;
  const closeMenu = () => setMenuVisible(false);
  const openDestination = (path: string) => {
    closeMenu();
    router.push(path as never);
  };

  return <SafeAreaView edges={['bottom']} style={styles.safe}>
    <View style={styles.barArea}>
      <Svg pointerEvents="none" width={width} height={barHeight} viewBox={`0 0 ${width} ${barHeight}`} style={StyleSheet.absoluteFill}>
        <Path d={barPath} fill={colors.surface} stroke={colors.border} strokeWidth={1} />
      </Svg>
      <View style={styles.tabsRow}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: isDashboard }} accessibilityLabel="Dashboard" onPress={() => router.replace('/')} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <TabIcon kind="dashboard" active={isDashboard} />
          <Text style={[styles.tabLabel, isDashboard && styles.tabLabelActive]}>Dashboard</Text>
        </Pressable>
        <View style={styles.menuSpace} />
        <Pressable accessibilityRole="button" accessibilityState={{ selected: pathname === '/profile' }} accessibilityLabel="Profil" onPress={() => router.replace('/profile')} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <TabIcon kind="profile" active={pathname === '/profile'} />
          <Text style={[styles.tabLabel, pathname === '/profile' && styles.tabLabelActive]}>Profil</Text>
        </Pressable>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: menuVisible }} accessibilityLabel="Menu" onPress={() => setMenuVisible(true)} style={({ pressed }) => [styles.menuTab, { left: center - 32 }, pressed && styles.pressed]}>
        <View style={styles.menuButton}><TabIcon kind="menu" /></View>
      </Pressable>
    </View>

    <Modal transparent animationType="fade" statusBarTranslucent visible={menuVisible} onRequestClose={closeMenu}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup menu" onPress={closeMenu} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View><Text style={styles.sheetTitle}>Menu {role === 'admin' ? 'Admin' : 'Teknisi'}</Text><Text style={styles.sheetSubtitle}>Pilih halaman yang ingin dibuka</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup menu" onPress={closeMenu} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
          </View>
          {menuItems[role].map((item) => <Pressable key={item.path} accessibilityRole="button" onPress={() => openDestination(item.path)} style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}>
            <View style={styles.menuItemMark}><Text style={styles.menuItemMarkText}>{item.mark}</Text></View>
            <View style={styles.menuItemCopy}><Text style={styles.menuItemTitle}>{item.title}</Text><Text style={styles.menuItemSubtitle}>{item.subtitle}</Text></View>
            <Text style={styles.menuItemArrow}>›</Text>
          </Pressable>)}
        </SafeAreaView>
      </View>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', paddingTop: 31, zIndex: 10 },
  barArea: { height: 70, width: '100%', position: 'relative', overflow: 'visible' },
  tabsRow: { height: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  tab: { flex: 1, minWidth: 0, height: 70, alignItems: 'center', justifyContent: 'center', gap: 7 },
  menuSpace: { width: 64 },
  tabLabel: { color: colors.muted, fontSize: 10, lineHeight: 13, fontWeight: '700' },
  tabLabelActive: { color: colors.primary, fontWeight: '900' },
  dashboardGlyph: { fontSize: 27, lineHeight: 30, fontWeight: '700' },
  profileIcon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'flex-end' },
  profileHead: { position: 'absolute', top: 1, width: 8, height: 8, borderRadius: 4 },
  profileShoulders: { width: 18, height: 9, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  menuTab: { position: 'absolute', top: -31, width: 64, height: 72, alignItems: 'center', justifyContent: 'flex-start' },
  menuButton: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  menuGrid: { width: 21, height: 21, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'space-between', justifyContent: 'space-between' },
  menuTile: { width: 8, height: 8, borderRadius: 2, borderWidth: 1.7, borderColor: 'white' },
  pressed: { opacity: 0.7 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(19, 43, 50, 0.42)' },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingHorizontal: 18, paddingTop: 9, paddingBottom: 8 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, marginBottom: 16, borderRadius: 3, backgroundColor: '#C7D4D8' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  sheetSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.surface },
  closeText: { color: colors.muted, fontSize: 24, lineHeight: 28 },
  menuItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingHorizontal: 12, borderRadius: 15, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  menuItemPressed: { backgroundColor: colors.primarySoft },
  menuItemMark: { minWidth: 40, height: 40, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primarySoft },
  menuItemMarkText: { color: colors.primary, fontSize: 9, fontWeight: '900' },
  menuItemCopy: { flex: 1 },
  menuItemTitle: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  menuItemSubtitle: { color: colors.muted, fontSize: 10, marginTop: 3 },
  menuItemArrow: { color: colors.primary, fontSize: 25, fontWeight: '500' },
});
