import { colors } from '../core/theme';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navbar } from './Navbar';


export function ScreenPage({ title, hint, children, backLabel = 'Menu utama' }: { title: string; hint: string; children: ReactNode; backLabel?: string }) {
  const router = useRouter();
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.pageFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Navbar title={title} onBack={() => router.back()} backLabel={`Kembali ke ${backLabel.toLowerCase()}`} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.pageHint}>{hint}</Text>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  pageFlex: { flex: 1 },
  scroll: { flex: 1, backgroundColor: colors.canvas },
  content: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 36 },
  pageHint: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 16 }
});
