import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { DisclosureChevron } from './DisclosureChevron';
import { colors } from '../../core/theme';

export function CompactEntityCard({ avatar, title, subtitle, expanded, onPress, tone = 'teal', children }: {
  avatar: string;
  title: string;
  subtitle: string;
  expanded: boolean;
  onPress: () => void;
  tone?: 'teal' | 'amber';
  children: ReactNode;
}) {
  return <Card style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={onPress} style={styles.header}>
      <View style={[styles.avatar, tone === 'amber' && styles.avatarAmber]}><Text style={styles.avatarText}>{avatar}</Text></View>
      <View style={styles.copy}><Text numberOfLines={2} style={styles.title}>{title}</Text><Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text></View>
      <DisclosureChevron expanded={expanded} />
    </Pressable>
    {expanded ? <View style={styles.details}>{children}</View> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  header: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  avatar: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F2F0' },
  avatarAmber: { backgroundColor: '#FBF0DE' },
  avatarText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.ink, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 3 },
  details: { paddingHorizontal: 13, paddingTop: 12, paddingBottom: 14, borderTopWidth: 1, borderTopColor: colors.border },
});
