import { StyleSheet } from 'react-native';
import { colors } from '../../../core/theme';

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scroll: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: 18, paddingBottom: 34 },
  qrCard: { alignItems: 'center' },
  qrFrame: { width: 270, height: 270, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white', borderRadius: 18, marginVertical: 8 },
  scanHint: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 11 },
  resultTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 7 },
  resultStatus: { marginTop: 12 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 10 },
  action: { marginBottom: 9 },
  missingText: { color: colors.amber, backgroundColor: colors.amberSoft, borderRadius: 12, padding: 12, fontSize: 12, lineHeight: 18, marginTop: 6 },
});
