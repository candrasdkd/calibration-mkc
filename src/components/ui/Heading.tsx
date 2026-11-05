import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';

export function Heading({ title, hint }: { title: string; hint?: string }) {
  return <View style={styles.heading}><Text style={styles.title}>{title}</Text>{hint ? <Text style={styles.hint}>{hint}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  heading: { marginBottom: 14 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  hint: { color: colors.muted, fontSize: 13, marginTop: 5, lineHeight: 19 },
});
