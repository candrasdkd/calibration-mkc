import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Badge } from '../ui';
import { colors } from '../../core/theme';

export function PickerOption({ label, detail, index, selected, disabled = false, status, statusTone = 'neutral', accessibilityLabel, onPress, children, accessory }: {
  label: string;
  detail: string;
  index?: number;
  selected: boolean;
  disabled?: boolean;
  status: string;
  statusTone?: 'neutral' | 'good' | 'bad' | 'wait';
  accessibilityLabel?: string;
  onPress: () => void;
  children?: ReactNode;
  accessory?: ReactNode;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.option, selected && styles.selected, disabled && styles.disabled]}>
    {index !== undefined ? <View style={styles.index}><Text style={styles.indexText}>{String(index).padStart(2, '0')}</Text></View> : null}
    <View style={styles.copy}><Text style={styles.label}>{label}</Text><Text style={styles.detail}>{detail}</Text>{children}</View>
    <View style={styles.accessory}>{accessory}<Badge text={status} tone={statusTone} /></View>
  </Pressable>;
}

const styles = StyleSheet.create({
  option: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 5, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  selected: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.5 },
  index: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3F5' },
  indexText: { color: colors.muted, fontSize: 9, fontWeight: '900' },
  copy: { flex: 1 },
  label: { color: colors.ink, fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },
  detail: { color: colors.muted, fontSize: 10, marginTop: 3 },
  accessory: { alignItems: 'flex-end', gap: 4 },
});
