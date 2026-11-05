import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';

type ChoiceValue = string | number | boolean;

export function Choice<T extends ChoiceValue>({ label, value, options, onChange }: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return <View style={styles.wrap}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <View style={styles.choices}>
      {options.map((option) => {
        const selected = value === option.value;
        return <Pressable key={String(option.value)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={option.label} onPress={() => onChange(option.value)} style={[styles.choice, selected && styles.selected]}>
          <Text style={[styles.text, selected && styles.textSelected]}>{option.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 42, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: '#FBFDFD' },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  text: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  textSelected: { color: colors.primary },
});
