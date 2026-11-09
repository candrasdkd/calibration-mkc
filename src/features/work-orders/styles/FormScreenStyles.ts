import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  storageWarning: { backgroundColor: colors.amberSoft, borderColor: '#E9D39D' },
  warningText: { color: colors.amber, fontSize: 13, lineHeight: 19 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  sectionCopy: { flex: 1 },
  helperText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  taskGroup: { marginTop: 14, paddingTop: 13, borderTopWidth: 1, borderTopColor: colors.border },
  taskGroupHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskGroupCopy: { flex: 1 },
  taskCustomer: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  taskMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  taskRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  taskRowCopy: { flex: 1 },
  taskName: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  taskDetails: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  taskAction: { color: colors.primary, fontSize: 11, fontWeight: '900' },
  selectedInstrument: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  selectedInstrumentCopy: { flex: 1 },
  selectedInstrumentName: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  selectedInstrumentMethod: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
  removeSelection: { color: colors.danger, fontSize: 11, fontWeight: '800', padding: 7 },
  methodText: { color: colors.primary, fontSize: 10, lineHeight: 14, marginTop: 4 },
  startCard: { gap: 12 },
  startSummary: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  emptySearch: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', paddingVertical: 28 },
});
