import React, { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { colors } from '../../core/theme';

function parseDate(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
    ? date
    : new Date();
}

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  const [draftDate, setDraftDate] = useState(() => parseDate(value));
  const open = () => { setDraftDate(parseDate(value)); setVisible(true); };
  const close = () => setVisible(false);

  return <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}, pilih tanggal`} onPress={open} style={styles.input}>
      <Text style={value ? styles.value : styles.placeholder}>{value ? value.split('-').reverse().join('-') : 'Pilih tanggal'}</Text>
      <Text style={styles.icon}>▦</Text>
    </Pressable>
    {Platform.OS === 'android' && visible ? <DateTimePicker
      value={draftDate}
      mode="date"
      presentation="dialog"
      accentColor={colors.primary}
      themeVariant="light"
      positiveButton={{ label: 'Pilih' }}
      negativeButton={{ label: 'Batal' }}
      onValueChange={(_, date) => { onChange(isoDate(date)); close(); }}
      onDismiss={close}
    /> : null}
    {Platform.OS === 'ios' ? <Modal transparent animationType="slide" visible={visible} onRequestClose={close}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Tutup kalender" onPress={close} style={StyleSheet.absoluteFill} />
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Pressable accessibilityRole="button" onPress={close}><Text style={styles.action}>Batal</Text></Pressable>
            <Text style={styles.modalTitle}>{label}</Text>
            <Pressable accessibilityRole="button" onPress={() => { onChange(isoDate(draftDate)); close(); }}><Text style={styles.action}>Pilih</Text></Pressable>
          </View>
          <DateTimePicker value={draftDate} mode="date" display="inline" locale="id_ID" accentColor={colors.primary} themeVariant="light" onValueChange={(_, date) => setDraftDate(date)} />
        </View>
      </View>
    </Modal> : null}
  </View>;
}

const styles = StyleSheet.create({
  fieldWrap: { marginBottom: 14 },
  label: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { minHeight: 50, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FBFDFD', borderColor: colors.border, borderWidth: 1 },
  value: { color: colors.ink, fontSize: 15 },
  placeholder: { color: '#748893', fontSize: 15 },
  icon: { color: colors.primary, fontSize: 18 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(18, 39, 48, 0.42)' },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 28 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 8 },
  modalTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  action: { color: colors.primary, fontSize: 14, fontWeight: '800', paddingVertical: 8 },
});
