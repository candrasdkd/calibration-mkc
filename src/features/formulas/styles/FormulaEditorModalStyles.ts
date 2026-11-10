import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: { minHeight: 66, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  headerSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  close: { color: colors.primary, fontSize: 13, fontWeight: '900', padding: 10 },
  content: { padding: 16, paddingBottom: 34, gap: 12 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  sectionName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 3, marginTop: 4 },
  twoColumns: { flexDirection: 'row', gap: 9 },
  column: { flex: 1 },
  formulaHint: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: -8, marginBottom: 10 },
  variables: { color: colors.muted, backgroundColor: '#F2F6F7', borderRadius: 11, padding: 10, fontSize: 10, lineHeight: 16, marginBottom: 10 },
  delete: { color: colors.danger, fontSize: 12, fontWeight: '900', padding: 8 },
  actions: { gap: 9, marginTop: 2 },
  footerNote: { color: colors.amber, fontSize: 11, lineHeight: 17, paddingHorizontal: 3 },
});
