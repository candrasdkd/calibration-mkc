import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  recordCard: { padding: 15 },
  recordMain: { paddingBottom: 13 },
  recordTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  recordTitleWrap: { flex: 1 },
  recordEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  recordName: { color: colors.ink, fontWeight: '900', fontSize: 15, lineHeight: 20, marginTop: 3 },
  recordDevice: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: '#F4F7F8' },
  recordDetails: { color: colors.ink, fontSize: 12, marginTop: 5, lineHeight: 18, fontWeight: '700' },
  recordSerial: { color: colors.muted, fontSize: 11, marginTop: 3 },
  recordMeta: { gap: 8, marginTop: 12 },
  recordMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  recordMetaLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  recordMetaValue: { color: colors.ink, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  missingBlock: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: colors.amberSoft },
  missingTitle: { color: colors.amber, fontSize: 12, fontWeight: '900' },
  missingPreview: { color: colors.amber, fontSize: 11, marginTop: 4, lineHeight: 16 },
  recordAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 10, marginTop: 12 },
  recordActionText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  recordActionArrow: { color: colors.primary, fontSize: 22, lineHeight: 23 },
  storageWarning: { backgroundColor: colors.amberSoft, borderColor: '#E9D39D' },
  warningText: { color: colors.amber, fontSize: 13, lineHeight: 19 },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  emptyCard: { alignItems: 'center', padding: 24 },
  emptyTitle: { color: colors.ink, fontWeight: '800', fontSize: 16 },
  completedToggle: { marginTop: 8, marginBottom: 12, paddingHorizontal: 4, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completedTitle: { color: colors.muted, fontSize: 13, fontWeight: '800' },
  formulaChevron: { color: colors.primary, fontSize: 24, fontWeight: '700', paddingHorizontal: 5 }
});
