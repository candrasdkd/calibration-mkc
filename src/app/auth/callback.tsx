import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { ActionButton, Card, Field, Heading } from '../../components/ui';
import { ScreenPage } from '../../components/ScreenPage';
import { supabase } from '../../core/supabase';
import { useRole } from '../../features/home/hooks/useRole';

export default function TechnicianInviteCallbackScreen() {
  const router = useRouter();
  const { signIn } = useRole();
  const url = Linking.useURL();
  const handledUrl = useRef('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!url || handledUrl.current === url) return;
    handledUrl.current = url;
    const client = supabase;

    const establishSession = async () => {
      setBusy(true);
      try {
        if (!client) throw new Error('Supabase belum dikonfigurasi pada aplikasi.');
        const callback = new URL(url);
        const params = new URLSearchParams(callback.search);
        new URLSearchParams(callback.hash.slice(1)).forEach((value, key) => params.set(key, value));
        const linkError = params.get('error_description') || params.get('error');
        if (linkError) throw new Error(linkError);

        if (params.get('code')) {
          const result = await client.auth.exchangeCodeForSession(params.get('code')!);
          if (result.error) throw result.error;
        } else if (params.get('access_token') && params.get('refresh_token')) {
          const result = await client.auth.setSession({
            access_token: params.get('access_token')!,
            refresh_token: params.get('refresh_token')!,
          });
          if (result.error) throw result.error;
        } else if (params.get('token_hash')) {
          const result = await client.auth.verifyOtp({ token_hash: params.get('token_hash')!, type: 'invite' });
          if (result.error) throw result.error;
        } else {
          throw new Error('Tautan undangan tidak lengkap atau sudah kedaluwarsa. Minta admin mengirim undangan baru.');
        }

        const session = await client.auth.getSession();
        if (session.error) throw session.error;
        if (!session.data.session?.user.email) throw new Error('Email pada undangan tidak ditemukan.');
        setEmail(session.data.session.user.email);
        setReady(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Undangan tidak bisa diverifikasi.');
      } finally {
        setBusy(false);
      }
    };
    void establishSession();
  }, [url]);

  const activate = async () => {
    if (!supabase || !ready) return;
    if (password.length < 8) { setError('Kata sandi minimal 8 karakter.'); return; }
    if (password !== confirmation) { setError('Konfirmasi kata sandi belum sama.'); return; }
    setBusy(true);
    setError('');
    try {
      const update = await supabase.auth.updateUser({ password });
      if (update.error) throw update.error;
      await signIn('technician', email, password);
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Akun teknisi belum bisa diaktifkan.');
    } finally {
      setBusy(false);
    }
  };

  return <ScreenPage title="Aktivasi akun" hint="Buat kata sandi untuk mulai menggunakan akun teknisi.">
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Card>
          <Heading title={ready ? 'Buat kata sandi' : busy ? 'Memeriksa undangan' : 'Undangan teknisi'} hint={ready ? `Akun akan diaktifkan untuk ${email}.` : 'Tautan email sedang diverifikasi.'} />
          {ready ? <>
            <Field label="Email akun" value={email} onChange={() => {}} editable={false} />
            <Field label="Kata sandi baru" value={password} onChange={setPassword} placeholder="Minimal 8 karakter" secureTextEntry />
            <Field label="Ulangi kata sandi" value={confirmation} onChange={setConfirmation} placeholder="Ketik ulang kata sandi" secureTextEntry />
            {error ? <Text accessibilityRole="alert" style={{ color: '#B4233C', marginBottom: 12 }}>{error}</Text> : null}
            <ActionButton title={busy ? 'Mengaktifkan akun…' : 'Aktifkan akun'} onPress={() => void activate()} disabled={busy} />
          </> : <>
            {error ? <Text accessibilityRole="alert" style={{ color: '#B4233C', marginBottom: 12 }}>{error}</Text> : <Text style={{ color: '#617985', marginBottom: 12 }}>Tunggu sebentar, tautan undangan sedang diperiksa.</Text>}
            {error ? <ActionButton title="Kembali ke login" secondary onPress={() => router.replace('/login')} /> : null}
          </>}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  </ScreenPage>;
}
