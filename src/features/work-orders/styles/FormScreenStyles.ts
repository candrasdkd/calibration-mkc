import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  storageWarning: { backgroundColor: colors.amberSoft, borderColor: '#E9D39D' },
  warningText: { color: colors.amber, fontSize: 13, lineHeight: 19 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  emptyCard: { alignItems: 'center', padding: 24 },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  selectionEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 2 },
  instrumentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  instrumentCard: { width: '48%', minHeight: 228, justifyContent: 'space-between', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 14, marginBottom: 0, shadowColor: colors.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.045, shadowRadius: 8, elevation: 1 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  instrumentCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 },
  instrumentIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  instrumentIconText: { color: colors.primary, fontWeight: '900', fontSize: 12, letterSpacing: 0.4 },
  instrumentCode: { color: colors.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.4, textAlign: 'right', marginTop: 3 },
  instrumentCopy: { flex: 1, justifyContent: 'center', paddingVertical: 10 },
  instrumentName: { color: colors.ink, fontSize: 15, lineHeight: 19, fontWeight: '900' },
  instrumentSubtitle: { color: colors.muted, fontSize: 10, marginTop: 4, lineHeight: 15 },
  instrumentMethodLabel: { color: colors.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 9 },
  instrumentMethod: { color: colors.ink, fontSize: 10, lineHeight: 14, marginTop: 3 },
  instrumentFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 9, marginTop: 8 },
  instrumentStart: { color: colors.primary, fontSize: 10, fontWeight: '900' },
  chevron: { color: colors.primary, fontSize: 18, fontWeight: '800' }
});
