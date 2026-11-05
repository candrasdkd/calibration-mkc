import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePathname, useRouter } from 'expo-router';
import { type Role } from '../core/role';
import { useRole } from '../features/home/hooks/useRole';
import { colors } from '../core/theme';

const tabs: Record<Role, { path: string; label: string; mark: string }[]> = {
  admin: [
    { path: '/', label: 'Beranda', mark: 'H' },
    { path: '/admin/customers', label: 'Pelanggan', mark: 'RS' },
    { path: '/admin/devices', label: 'Alat ukur', mark: 'AM' },
    { path: '/admin/technicians', label: 'Teknisi', mark: 'TK' },
    { path: '/admin/results', label: 'Hasil', mark: 'CEK' },
  ],
  technician: [
    { path: '/', label: 'Beranda', mark: 'H' },
    { path: '/form', label: 'Pengerjaan', mark: 'MULAI' },
    { path: '/draft', label: 'Draft', mark: 'D' },
    { path: '/rumus', label: 'Rumus', mark: 'fx' },
  ],
};

function activeTab(tabPath: string, pathname: string) {
  return pathname === tabPath;
}

export function BottomBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { role: selectedRole } = useRole();
  const role = pathname.startsWith('/admin') ? 'admin' : pathname === '/' ? selectedRole : 'technician';
  if (!tabs[role].some((tab) => activeTab(tab.path, pathname))) return null;

  return <SafeAreaView edges={['bottom']} style={styles.safe}>
    <View style={styles.row}>
      {tabs[role].map((tab) => {
        const selected = activeTab(tab.path, pathname);
        return <Pressable key={tab.path} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={tab.label} onPress={() => router.replace(tab.path as never)} style={({ pressed }) => [styles.tab, pressed && styles.pressed]}>
          <View style={[styles.mark, selected && styles.markSelected]}><Text style={[styles.markText, selected && styles.markTextSelected]}>{tab.mark}</Text></View>
          <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 61, paddingHorizontal: 5, paddingTop: 5, borderTopWidth: 1, borderTopColor: colors.border },
  tab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 52, paddingHorizontal: 2 },
  mark: { minWidth: 35, height: 24, paddingHorizontal: 7, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  markSelected: { backgroundColor: colors.primarySoft }, markText: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.2 }, markTextSelected: { color: colors.primary },
  label: { color: colors.muted, fontSize: 9, lineHeight: 12, fontWeight: '700' }, labelSelected: { color: colors.primary, fontWeight: '900' }, pressed: { opacity: 0.65 },
});
