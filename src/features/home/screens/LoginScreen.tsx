import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ActionButton, Card, Field, Heading } from '../../../components/ui';
import type { Role } from '../../../core/role';
import { useRole } from '../hooks/useRole';
import { styles } from '../styles/LoginScreenStyles';

const roles: { id: Role; title: string; description: string; mark: string }[] = [
  { id: 'admin', title: 'Admin', description: 'Kelola data dan hasil', mark: 'AD' },
  { id: 'technician', title: 'Teknisi', description: 'Kerjakan kalibrasi', mark: 'TK' },
];

export default function LoginScreen() {
  const router = useRouter();
  const { role, signIn, backendConfigured } = useRole();
  const [selectedRole, setSelectedRole] = useState<Role>(role);
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const demoMode = __DEV__ && !backendConfigured;

  const submit = async () => {
    if (!userName.trim() || !password) {
      setError(backendConfigured || !demoMode ? 'Isi email dan kata sandi untuk melanjutkan.' : 'Isi nama pengguna dan kata sandi untuk melanjutkan.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await signIn(selectedRole, userName, password);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login gagal. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.brand}>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>K</Text></View>
          <Text style={styles.eyebrow}>MEDICAL WORKSPACE</Text>
          <Text style={styles.title}>Masuk ke ruang kerja</Text>
          <Text style={styles.subtitle}>Kalibrasi alat kesehatan, dalam satu alur.</Text>
        </View>

        <Card style={styles.loginCard}>
          <Heading title={demoMode ? 'Login demo lokal' : 'Login'} hint={backendConfigured ? 'Gunakan email akun yang dibuat admin. Peran mengikuti akun server.' : demoMode ? 'Pilih peran untuk menguji dashboard Admin atau Teknisi.' : 'Backend belum dikonfigurasi untuk build ini.'} />
          <Field label={demoMode ? 'Nama pengguna' : 'Email'} value={userName} onChange={setUserName} placeholder={demoMode ? 'Masukkan nama pengguna' : 'nama@rumah-sakit.id'} keyboard={demoMode ? 'default' : 'email-address'} autoCapitalize="none" />
          <Field label="Kata sandi" value={password} onChange={setPassword} placeholder="Masukkan kata sandi" secureTextEntry />
          {demoMode ? <>
            <Text style={styles.roleLabel}>MASUK SEBAGAI</Text>
            <View style={styles.roleOptions}>
              {roles.map((item) => {
                const selected = selectedRole === item.id;
                return <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSelectedRole(item.id)} style={[styles.roleOption, selected && styles.roleOptionSelected]}>
                  <View style={[styles.roleMark, selected && styles.roleMarkSelected]}><Text style={[styles.roleMarkText, selected && styles.roleMarkTextSelected]}>{item.mark}</Text></View>
                  <View style={styles.roleCopy}><Text style={[styles.roleName, selected && styles.roleNameSelected]}>{item.title}</Text><Text style={styles.roleDescription}>{item.description}</Text></View>
                  {selected ? <Text style={styles.selectedMark}>✓</Text> : null}
                </Pressable>;
              })}
            </View>
          </> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <ActionButton title={busy ? 'Menyiapkan sesi…' : 'Masuk'} onPress={submit} disabled={busy || (!backendConfigured && !demoMode)} />
          <Text style={styles.disclaimer}>{backendConfigured ? 'Akun dan peran diverifikasi server. Data operasional aplikasi masih tersimpan di perangkat pada tahap ini.' : demoMode ? 'Mode sementara: nama pengguna dan kata sandi belum diverifikasi server. Kata sandi tidak disimpan. Data aplikasi tetap tersimpan di perangkat saat logout.' : 'Konfigurasi Supabase wajib tersedia sebelum aplikasi dapat digunakan.'}</Text>
        </Card>
        <Text style={styles.footer}>KALIBRASI · MEDICAL WORKSPACE</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
