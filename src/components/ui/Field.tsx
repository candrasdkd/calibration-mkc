import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors } from '../../core/theme';

export function Field({ label, value, onChange, keyboard = 'default', placeholder = '', multiline = false, suffix, editable = true }: {
  label: string;
  value?: string | number | null;
  onChange: (value: string) => void;
  keyboard?: TextInputProps['keyboardType'];
  placeholder?: string;
  multiline?: boolean;
  suffix?: string;
  editable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputRow}>
      <TextInput
        accessibilityLabel={label}
        value={value == null ? '' : String(value)}
        onChangeText={onChange}
        editable={editable}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor="#8995A1"
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused, multiline && styles.multiline, suffix && styles.inputWithSuffix, !editable && styles.inputDisabled]}
      />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: 14 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  inputRow: { flexDirection: 'row', alignItems: 'center', position: 'relative' },
  input: { flex: 1, minHeight: 50, borderRadius: 12, paddingHorizontal: 14, color: colors.ink, backgroundColor: '#FBFDFD', borderColor: colors.border, borderWidth: 1, fontSize: 15 },
  inputDisabled: { backgroundColor: '#EEF2F3', color: colors.muted },
  inputFocused: { borderColor: colors.primary, backgroundColor: colors.surface },
  inputWithSuffix: { paddingRight: 54 },
  suffix: { color: colors.muted, fontSize: 12, position: 'absolute', right: 12 },
  multiline: { minHeight: 82, paddingTop: 12 },
});
