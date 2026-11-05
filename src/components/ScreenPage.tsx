import { colors } from '../core/theme';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';


export function ScreenPage({ title, hint, children, backLabel = 'Menu utama' }: { title: string; hint: string; children: ReactNode; backLabel?: string }) {
  const router = useRouter();
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <KeyboardAvoidingView style={styles.pageFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.pageBanner}>
          <View style={styles.bannerTop}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Kembali ke ${backLabel.toLowerCase()}`} onPress={() => router.back()} style={styles.back}>
              <Text style={styles.backArrow}>‹</Text><Text style={styles.backText}>{backLabel}</Text>
            </Pressable>
            <View style={styles.bannerLocal}><View style={styles.bannerDot} /><Text style={styles.bannerLocalText}>LOKAL</Text></View>
          </View>
          <Text style={styles.pageEyebrow}>KALIBRASI MEDIS</Text>
          <Text style={styles.pageTitle}>{title}</Text>
          <Text style={styles.pageHint}>{hint}</Text>
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}


const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F7F8' },
  pageFlex: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 36 },
  pageBanner: { backgroundColor: colors.ink, borderRadius: 23, padding: 19, marginBottom: 21 },
  bannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 34, paddingRight: 10 },
  backArrow: { color: 'white', fontSize: 25, lineHeight: 27, marginTop: -2 },
  backText: { color: '#E0E9EB', fontSize: 12, fontWeight: '800' },
  bannerLocal: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6 },
  bannerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7AD2B5' },
  bannerLocalText: { color: '#E0F3EC', fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  pageEyebrow: { color: '#A4D9CC', fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  pageTitle: { color: 'white', fontSize: 26, lineHeight: 31, fontWeight: '900', letterSpacing: -0.4, marginTop: 5 },
  pageHint: { color: '#D3E2E5', fontSize: 13, lineHeight: 19, marginTop: 6 }
});
