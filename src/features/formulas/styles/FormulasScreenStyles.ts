import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  formulaCard: { padding: 0, overflow: 'hidden' },
  formulaToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 17 },
  formulaTitleWrap: { flex: 1 },
  formulaTitle: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  formulaSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4, lineHeight: 18 },
  formulaChevron: { color: colors.primary, fontSize: 24, fontWeight: '700', paddingHorizontal: 5 },
  formulaBody: { paddingHorizontal: 17, paddingBottom: 17 },
  formulaGroup: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 13, marginTop: 5 },
  formulaGroupTitle: { color: colors.ink, fontSize: 12, fontWeight: '800', marginBottom: 9, lineHeight: 18 },
  equation: { color: colors.ink, backgroundColor: '#F2F6F7', borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 11, marginBottom: 7, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 },
  equationStrong: { color: colors.primary, fontSize: 12, fontWeight: '800', lineHeight: 19, marginTop: 4 },
  formulaWarning: { color: colors.amber, backgroundColor: colors.amberSoft, borderRadius: 11, padding: 12, marginTop: 11, fontSize: 12, lineHeight: 18 },
  readOnlyNote: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 10 }
});
