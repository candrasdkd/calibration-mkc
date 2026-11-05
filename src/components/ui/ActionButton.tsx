import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../../core/theme';

export function ActionButton({ title, onPress, secondary = false, danger = false, disabled = false }: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, danger && styles.danger, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.text, secondary && styles.secondaryText, danger && styles.dangerText]}>{title}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 18, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  danger: { borderWidth: 1, borderColor: '#F0D0D2', backgroundColor: colors.dangerSoft },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.78 },
  text: { color: 'white', fontWeight: '800', fontSize: 14 },
  secondaryText: { color: colors.ink },
  dangerText: { color: colors.danger },
});
