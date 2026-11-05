import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';

export function ValueLine({ label, value, strong = false }: { label: string; value?: ReactNode; strong?: boolean }) {
  return <View style={styles.line}><Text style={[styles.label, strong && styles.strong]}>{label}</Text><Text style={[styles.value, strong && styles.strong]}>{value ?? '—'}</Text></View>;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  label: { color: colors.muted, fontSize: 12, lineHeight: 18, flex: 1 },
  value: { color: colors.ink, fontSize: 13, lineHeight: 19, fontWeight: '600', textAlign: 'right', flex: 1.2 },
  strong: { color: colors.ink, fontWeight: '800' },
});
