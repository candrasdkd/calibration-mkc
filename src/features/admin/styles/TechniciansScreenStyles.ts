import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 12 },
  listTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  listSubtitle: { color: colors.muted, fontSize: 11, marginTop: 3 },
  listCount: { minWidth: 34, height: 34, paddingHorizontal: 9, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  listCountText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  addAction: { marginBottom: 15 },
  phoneBox: { padding: 12, marginTop: 12, borderRadius: 13, backgroundColor: '#F4F7F8' },
  phoneLabel: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  phoneValue: { color: colors.ink, fontSize: 15, fontWeight: '900', marginTop: 5 },
  actions: { flexWrap: 'nowrap', marginTop: 12, marginBottom: 0 },
  actionButton: { flex: 1 },
  emptyCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  emptyMark: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: 12 },
  emptyMarkText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  emptyHint: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
});
