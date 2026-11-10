import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 18, paddingTop: 21, paddingBottom: 132 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 17 },
  avatar: { width: 58, height: 58, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  adminAvatar: { backgroundColor: colors.primarySoft },
  technicianAvatar: { backgroundColor: colors.amberSoft },
  avatarText: { color: colors.primary, fontSize: 14, fontWeight: '900' },
  profileCopy: { flex: 1 },
  roleLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  profileTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', marginTop: 3 },
  profileSubtitle: { color: colors.muted, fontSize: 11, marginTop: 4 },
  localCard: { backgroundColor: '#F7FAFA' },
  localTitle: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  localHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
});
