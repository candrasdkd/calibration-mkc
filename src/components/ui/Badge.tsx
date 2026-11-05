import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'good' | 'bad' | 'wait' }) {
  return <View style={[styles.badge, tone === 'good' && styles.good, tone === 'bad' && styles.bad, tone === 'wait' && styles.wait]}>
    <Text style={[styles.text, tone === 'good' && styles.goodText, tone === 'bad' && styles.badText, tone === 'wait' && styles.waitText]}>{text}</Text>
  </View>;
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#EDF2F4' },
  text: { color: colors.muted, fontSize: 11, fontWeight: '800' },
  good: { backgroundColor: colors.primarySoft }, goodText: { color: colors.primary },
  bad: { backgroundColor: colors.dangerSoft }, badText: { color: colors.danger },
  wait: { backgroundColor: colors.amberSoft }, waitText: { color: colors.amber },
});
