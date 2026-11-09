import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../../core/theme';

export function SearchField({ value, onChange, placeholder, accessibilityLabel }: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
}) {
  return <View style={styles.container}>
    <View style={styles.glyph}><View style={styles.lens} /><View style={styles.handle} /></View>
    <TextInput accessibilityLabel={accessibilityLabel} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#75878D" returnKeyType="search" style={styles.input} />
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="Hapus pencarian" onPress={() => onChange('')}><Text style={styles.clear}>×</Text></Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginBottom: 11, borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.surface },
  glyph: { width: 21, height: 21, alignItems: 'center', justifyContent: 'center' },
  lens: { width: 13, height: 13, borderWidth: 2, borderColor: colors.primary, borderRadius: 8 },
  handle: { position: 'absolute', width: 7, height: 2, right: 1, bottom: 3, borderRadius: 1, backgroundColor: colors.primary, transform: [{ rotate: '45deg' }] },
  input: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 13, paddingVertical: 10 },
  clear: { color: colors.muted, fontSize: 24, lineHeight: 27, paddingHorizontal: 3 },
});
