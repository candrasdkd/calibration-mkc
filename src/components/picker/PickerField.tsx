import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';

export function PickerField({ label, value, placeholder, disabled = false, onPress }: { label: string; value?: string; placeholder: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.field, disabled && styles.disabled]}>
    <View style={styles.copy}><Text style={styles.label}>{label}</Text><Text numberOfLines={1} style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text></View>
    <Text style={styles.chevron}>⌄</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  field: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, marginTop: 8, marginBottom: 14, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: '#FBFDFD' },
  disabled: { opacity: 0.55 },
  copy: { flex: 1 },
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', marginBottom: 3 },
  value: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  placeholder: { color: '#75878D', fontSize: 14 },
  chevron: { color: colors.primary, fontSize: 21, fontWeight: '800' },
});
