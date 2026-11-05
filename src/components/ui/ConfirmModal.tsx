import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../core/theme';

export function ConfirmModal({ visible, title, message, confirmLabel, danger = false, onCancel, onConfirm }: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <Modal transparent animationType="fade" visible={visible} statusBarTranslucent onRequestClose={onCancel}>
    <View style={styles.overlay}>
      <Pressable accessibilityRole="button" accessibilityLabel="Tutup konfirmasi" onPress={onCancel} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={styles.card}>
        <View style={[styles.mark, danger && styles.markDanger]}><Text style={[styles.markText, danger && styles.markTextDanger]}>{danger ? '!' : '?'}</Text></View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onCancel} style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}><Text style={[styles.buttonText, styles.cancelText]}>Batal</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={onConfirm} style={({ pressed }) => [styles.button, danger ? styles.danger : styles.primary, pressed && styles.pressed]}><Text style={styles.buttonText}>{confirmLabel}</Text></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(16, 35, 42, 0.48)' },
  card: { width: '100%', maxWidth: 360, padding: 22, backgroundColor: colors.surface, borderRadius: 23, borderWidth: 1, borderColor: colors.border, shadowColor: colors.ink, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 12 },
  mark: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, marginBottom: 15 },
  markDanger: { backgroundColor: colors.dangerSoft },
  markText: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  markTextDanger: { color: colors.danger },
  title: { color: colors.ink, fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.3 },
  message: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 22 },
  button: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 13, paddingHorizontal: 10 },
  cancel: { backgroundColor: '#F1F5F6' },
  primary: { backgroundColor: colors.primary },
  danger: { backgroundColor: colors.danger },
  pressed: { opacity: 0.78 },
  buttonText: { color: 'white', fontSize: 13, fontWeight: '900' },
  cancelText: { color: colors.ink },
});
