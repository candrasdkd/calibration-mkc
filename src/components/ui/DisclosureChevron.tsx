import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../core/theme';

export function DisclosureChevron({ expanded }: { expanded: boolean }) {
  return <View style={styles.container}><View style={[styles.chevron, expanded && styles.up]} /></View>;
}

const styles = StyleSheet.create({
  container: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  chevron: { width: 9, height: 9, marginTop: -4, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.primary, transform: [{ rotate: '45deg' }] },
  up: { marginTop: 4, transform: [{ rotate: '225deg' }] },
});
