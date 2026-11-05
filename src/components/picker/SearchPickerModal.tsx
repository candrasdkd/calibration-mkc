import React, { type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../core/theme';

export function SearchPickerModal({ visible, title, search, placeholder, onSearch, onClose, children }: {
  visible: boolean;
  title: string;
  search: string;
  placeholder: string;
  onSearch: (value: string) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.modal}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}><Text style={styles.title}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Tutup ${title.toLowerCase()}`} onPress={onClose}><Text style={styles.close}>Selesai</Text></Pressable></View>
        <TextInput accessibilityLabel={`Cari ${title.toLowerCase()}`} placeholder={placeholder} placeholderTextColor={colors.muted} value={search} onChangeText={onSearch} autoCapitalize="none" autoCorrect={false} returnKeyType="search" style={styles.search} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  modal: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  header: { minHeight: 64, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  title: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  close: { color: colors.primary, fontSize: 14, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 12 },
  search: { minHeight: 50, marginHorizontal: 16, marginTop: 14, marginBottom: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.surface, color: colors.ink, fontSize: 14 },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
});
