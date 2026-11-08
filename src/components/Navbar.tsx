import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../core/theme';

export function Navbar({ title, subtitle, onBack, backLabel = 'Kembali', action }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  action?: { label: ReactNode; accessibilityLabel: string; onPress: () => void };
}) {
  return <View style={styles.navbar}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} style={styles.back}><Text style={styles.backArrow}>‹</Text></Pressable>
      : <View style={styles.brandMark}><Text style={styles.brandMarkText}>K</Text></View>}
    <View style={styles.copy}>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
    {action ? <Pressable accessibilityRole="button" accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} style={styles.action}>{action.label}</Pressable> : null}
    <View style={styles.local}><View style={styles.dot} /><Text style={styles.localText}>LOKAL</Text></View>
  </View>;
}

const styles = StyleSheet.create({
  navbar: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: colors.primarySoft },
  backArrow: { color: colors.primary, fontSize: 30, lineHeight: 34, marginTop: -3 },
  brandMark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  brandMarkText: { color: 'white', fontWeight: '900', fontSize: 21 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  subtitle: { color: colors.muted, fontSize: 9, fontWeight: '700', marginTop: 2 },
  action: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  local: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.primarySoft },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  localText: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
});
