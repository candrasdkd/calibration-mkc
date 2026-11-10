import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Badge, Card, CompactEntityCard, ConfirmModal, Field, Heading, SearchField } from '../../../components/ui';
import { useAdminData } from '../hooks/useAdminData';
import type { TechnicianProfile } from '../../../core/admin-data';
import { supabaseConfigured } from '../../../core/supabase';
import { ScreenPage } from '../../../components/ScreenPage';
import { StorageMessage } from '../components/StorageMessage';
import { styles } from '../styles/AdminStyles';
import { styles as technicianStyles } from '../styles/TechniciansScreenStyles';
import type { Confirmation } from '../types/Confirmation';

const blankTechnician = (): TechnicianProfile => ({ id: '', name: '', email: '', phone: '', userId: null, accountStatus: 'unlinked' });

const accountBadges: Record<TechnicianProfile['accountStatus'], { text: string; tone: 'neutral' | 'good' | 'bad' | 'wait' }> = {
  unlinked: { text: 'Belum ditautkan', tone: 'neutral' as const },
  invited: { text: 'Undangan terkirim', tone: 'wait' as const },
  active: { text: 'Akun aktif', tone: 'good' as const },
  disabled: { text: 'Akun nonaktif', tone: 'bad' as const },
};

export function TechniciansScreen() {
  const data = useAdminData();
  const [editing, setEditing] = useState<TechnicianProfile | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<TechnicianProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [search, setSearch] = useState('');
  const [expandedTechnicianId, setExpandedTechnicianId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const locked = !data.loaded || Boolean(data.storageError);
  const query = search.trim().toLowerCase();
  const filteredTechnicians = data.technicians.filter((technician) => `${technician.name} ${technician.email} ${technician.phone}`.toLowerCase().includes(query));
  const sendInvitation = (technician: TechnicianProfile) => {
    setBusy(true);
    void data.inviteTechnician({ name: technician.name, email: technician.email.trim().toLowerCase(), phone: technician.phone }, Linking.createURL('/auth/callback'), technician.id || undefined, true)
      .then(({ invitationSent, technician: account }) => {
        setEditing(null);
        const title = invitationSent ? 'Undangan terkirim' : 'Akun teknisi ditautkan';
        const message = invitationSent
          ? `Email aktivasi sudah dikirim ke ${technician.email.trim()}.`
          : account.accountStatus === 'active'
            ? `Akun ${technician.email.trim()} ditautkan tanpa mengirim email. Jika password tidak diketahui, buka detail teknisi lalu pilih Atur kata sandi manual.`
            : `Akun ${technician.email.trim()} ditautkan. Atur kata sandi manual dari detail teknisi untuk mengonfirmasi email dan mengaktifkan akun.`;
        Alert.alert(title, message);
      })
      .catch((error) => Alert.alert('Teknisi gagal ditambahkan', error instanceof Error ? error.message : 'Periksa koneksi Supabase.'))
      .finally(() => setBusy(false));
  };
  const save = () => {
    if (!editing?.name.trim() || !editing.phone.trim()) { Alert.alert('Data belum lengkap', 'Isi nama dan nomor telepon teknisi.'); return; }
    const linkAccount = !editing.userId && (!editing.id || Boolean(editing.email.trim()));
    if (linkAccount && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email.trim())) { Alert.alert('Email belum valid', 'Masukkan email akun Supabase teknisi.'); return; }
    const technician = editing;
    if (linkAccount) {
      sendInvitation(technician);
      return;
    }
    setConfirmation({
      title: 'Simpan perubahan teknisi?',
      message: `Data ${technician.name} akan diperbarui.`,
      confirmLabel: 'Simpan',
      onConfirm: () => {
        data.saveTechnician(technician);
        setEditing(null);
      },
    });
  };
  const changeStatus = (technician: TechnicianProfile, status: 'active' | 'disabled') => setConfirmation({
    title: status === 'active' ? 'Aktifkan akun teknisi?' : 'Nonaktifkan akun teknisi?',
    message: status === 'active'
      ? `Akun ${technician.name} dapat login kembali.`
      : `${technician.name} tidak bisa login atau menyinkronkan data sampai diaktifkan kembali. Riwayat kalibrasi tetap tersimpan.`,
    confirmLabel: status === 'active' ? 'Aktifkan' : 'Nonaktifkan',
    danger: status === 'disabled',
    onConfirm: () => {
      setBusy(true);
      void data.setTechnicianAccountStatus(technician.id, status)
        .catch((error) => Alert.alert('Status gagal diperbarui', error instanceof Error ? error.message : 'Periksa koneksi Supabase.'))
        .finally(() => setBusy(false));
    },
  });
  const sendAccountLink = (technician: TechnicianProfile) => {
    const resetPassword = technician.accountStatus === 'active';
    return setConfirmation({
    title: resetPassword ? 'Kirim tautan setel kata sandi?' : 'Kirim ulang undangan?',
    message: resetPassword
      ? `Tautan untuk membuat kata sandi baru akan dikirim ke ${technician.email}.`
      : `Tautan aktivasi baru akan dikirim ke ${technician.email}.`,
    confirmLabel: resetPassword ? 'Kirim tautan' : 'Kirim ulang',
    onConfirm: () => {
      setBusy(true);
      void data.sendTechnicianAccessLink(technician.id, Linking.createURL('/auth/callback'))
        .then((linkType) => Alert.alert(
          linkType === 'password-reset' ? 'Tautan kata sandi terkirim' : 'Undangan terkirim',
          linkType === 'password-reset'
            ? `Tautan untuk membuat kata sandi baru sudah dikirim ke ${technician.email}.`
            : `Email aktivasi baru sudah dikirim ke ${technician.email}.`,
        ))
        .catch((error) => Alert.alert('Tautan akun gagal dikirim', error instanceof Error ? error.message : 'Periksa konfigurasi email Supabase.'))
        .finally(() => setBusy(false));
    },
  });
  };
  const openPasswordModal = (technician: TechnicianProfile) => {
    setNewPassword('');
    setPasswordConfirmation('');
    setPasswordTarget(technician);
  };
  const saveManualPassword = () => {
    if (!passwordTarget) return;
    if (newPassword.length < 8 || newPassword.length > 72) { Alert.alert('Kata sandi belum valid', 'Gunakan 8–72 karakter.'); return; }
    if (newPassword !== passwordConfirmation) { Alert.alert('Konfirmasi berbeda', 'Ketik ulang kata sandi yang sama.'); return; }
    const technician = passwordTarget;
    setConfirmation({
      title: 'Atur kata sandi teknisi?',
      message: `Kata sandi ${technician.name} langsung diganti tanpa email. Email akan dikonfirmasi dan akun diaktifkan. Berikan kata sandi baru lewat jalur yang aman.`,
      confirmLabel: 'Atur kata sandi',
      onConfirm: () => {
        setBusy(true);
        void data.setTechnicianPassword(technician.id, newPassword)
          .then(() => {
            setPasswordTarget(null);
            setNewPassword('');
            setPasswordConfirmation('');
            Alert.alert('Kata sandi diperbarui', `Akun ${technician.email} siap login dengan kata sandi baru.`);
          })
          .catch((error) => Alert.alert('Kata sandi gagal diatur', error instanceof Error ? error.message : 'Periksa koneksi Supabase.'))
          .finally(() => setBusy(false));
      },
    });
  };
  const remove = (technician: TechnicianProfile) => setConfirmation({
    title: 'Hapus data teknisi?',
    message: `Data ${technician.name} akan dihapus dari daftar teknisi.`,
    confirmLabel: 'Hapus', danger: true,
    onConfirm: () => data.deleteTechnician(technician.id),
  });
  return <ScreenPage title="Data teknisi" hint="Kelola akun teknisi. Admin bisa menautkan akun dan mengatur kata sandi tanpa email.">
    <StorageMessage message={data.storageError} />
    <View style={technicianStyles.listHeader}>
      <View><Text style={technicianStyles.listTitle}>Daftar teknisi</Text><Text style={technicianStyles.listSubtitle}>{query ? `${filteredTechnicians.length} dari ${data.technicians.length} teknisi` : 'Teknisi yang tersimpan'}</Text></View>
      <View style={technicianStyles.listCount}><Text style={technicianStyles.listCountText}>{data.technicians.length}</Text></View>
    </View>
    <SearchField accessibilityLabel="Cari teknisi" value={search} onChange={(value) => { setSearch(value); setExpandedTechnicianId(null); }} placeholder="Cari nama, email, atau nomor telepon" />
    <View style={technicianStyles.addAction}><ActionButton title="＋ Tambah teknisi" onPress={() => setEditing(blankTechnician())} disabled={locked || !supabaseConfigured} /></View>
    {!supabaseConfigured ? <Text style={technicianStyles.emptyHint}>Hubungkan Supabase untuk menautkan akun teknisi.</Text> : null}
    {!filteredTechnicians.length ? <Card style={technicianStyles.emptyCard}>
      <View style={technicianStyles.emptyMark}><Text style={technicianStyles.emptyMarkText}>TK</Text></View>
      <Text style={technicianStyles.emptyTitle}>{data.technicians.length ? 'Teknisi tidak ditemukan' : 'Belum ada teknisi'}</Text>
      <Text style={technicianStyles.emptyHint}>{data.technicians.length ? 'Coba kata kunci lain atau hapus pencarian.' : 'Buat akun di Supabase Authentication > Users, lalu tautkan teknisi di sini tanpa email.'}</Text>
      {search ? <ActionButton title="Hapus pencarian" secondary onPress={() => setSearch('')} /> : null}
    </Card> : filteredTechnicians.map((technician) => {
      const expanded = expandedTechnicianId === technician.id;
      const badge = accountBadges[technician.accountStatus];
      return <CompactEntityCard key={technician.id} avatar="TK" tone="amber" title={technician.name} subtitle={technician.email || 'Akun teknisi belum ditautkan'} expanded={expanded} onPress={() => setExpandedTechnicianId(expanded ? null : technician.id)}>
        <Badge text={badge.text} tone={badge.tone} />
        {technician.email ? <View style={technicianStyles.phoneBox}><Text style={technicianStyles.phoneLabel}>EMAIL AKUN</Text><Text style={technicianStyles.phoneValue}>{technician.email}</Text></View> : null}
        <View style={technicianStyles.phoneBox}><Text style={technicianStyles.phoneLabel}>NOMOR TELEPON</Text><Text style={technicianStyles.phoneValue}>{technician.phone}</Text></View>
        <View style={[styles.actions, technicianStyles.actions]}>
          <View style={technicianStyles.actionButton}><ActionButton title="Ubah data" secondary onPress={() => setEditing({ ...technician })} disabled={locked} /></View>
          <View style={technicianStyles.actionButton}>
            {technician.accountStatus === 'invited'
              ? <ActionButton title="Kirim ulang" secondary onPress={() => sendAccountLink(technician)} disabled={locked || busy} />
              : technician.userId
                ? <ActionButton title={technician.accountStatus === 'disabled' ? 'Aktifkan akun' : 'Nonaktifkan'} danger={technician.accountStatus !== 'disabled'} secondary={technician.accountStatus === 'disabled'} onPress={() => changeStatus(technician, technician.accountStatus === 'disabled' ? 'active' : 'disabled')} disabled={locked || busy} />
                : <ActionButton title="Hapus" danger onPress={() => remove(technician)} disabled={locked} />}
          </View>
        </View>
        {technician.userId && technician.accountStatus !== 'disabled' ? <View style={{ marginTop: 10 }}><ActionButton title="Atur kata sandi manual" secondary onPress={() => openPasswordModal(technician)} disabled={locked || busy} /></View> : null}
      </CompactEntityCard>;
    })}
    <Modal visible={Boolean(editing) && !confirmation} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setEditing(null)}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}>
            <Text style={styles.deviceModalTitle}>{editing?.id ? 'Ubah teknisi' : 'Tambah teknisi'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup form teknisi" onPress={() => setEditing(null)}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable>
          </View>
          {editing ? <ScrollView style={styles.deviceModalScroll} contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled">
            <Card>
              <Heading title={editing.id ? 'Data teknisi' : 'Tambah teknisi'} hint={editing.id ? 'Nama dan nomor telepon dapat diperbarui. Email akun tidak dapat diubah di sini.' : 'Buat user dan password di Supabase Authentication > Users terlebih dahulu. Masukkan email yang sama di sini untuk menautkan akun tanpa mengirim email.'} />
              <Field label="Nama teknisi" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
              {!editing.userId ? <Field label="Email akun" value={editing.email} onChange={(email) => setEditing({ ...editing, email })} placeholder="nama@rumah-sakit.id" keyboard="email-address" autoCapitalize="none" /> : <Field label="Email akun" value={editing.email || 'Belum ada akun tertaut'} onChange={() => {}} editable={false} />}
              <Field label="Nomor telepon" value={editing.phone} onChange={(phone) => setEditing({ ...editing, phone })} keyboard="phone-pad" />
            </Card>
          </ScrollView> : null}
          {editing ? <View style={styles.deviceModalFooter}>
            <View style={[styles.actions, styles.deviceModalFooterActions]}>
              <View style={styles.deviceModalFooterAction}><ActionButton title={busy ? 'Memproses akun…' : !editing.userId && (!editing.id || Boolean(editing.email.trim())) ? 'Tautkan akun' : 'Simpan teknisi'} onPress={save} disabled={locked || busy} /></View>
              <View style={styles.deviceModalFooterAction}><ActionButton title="Batal" secondary onPress={() => setEditing(null)} disabled={busy} /></View>
            </View>
          </View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <Modal visible={Boolean(passwordTarget) && !confirmation} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPasswordTarget(null)}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.deviceModal}>
        <KeyboardAvoidingView style={styles.deviceModalFlex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.deviceModalHeader}>
            <Text style={styles.deviceModalTitle}>Atur kata sandi manual</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Tutup pengaturan kata sandi" onPress={() => setPasswordTarget(null)}><Text style={styles.deviceModalClose}>Tutup</Text></Pressable>
          </View>
          {passwordTarget ? <ScrollView contentContainerStyle={styles.deviceModalContent} keyboardShouldPersistTaps="handled">
            <Card>
              <Heading title={passwordTarget.email} hint="Password langsung diganti tanpa email. Jika undangan belum diterima, email akan dikonfirmasi dan akun diaktifkan. Berikan password ini kepada teknisi melalui jalur aman." />
              <Field label="Kata sandi baru" value={newPassword} onChange={setNewPassword} placeholder="Minimal 8 karakter" secureTextEntry />
              <Field label="Ulangi kata sandi" value={passwordConfirmation} onChange={setPasswordConfirmation} placeholder="Ketik ulang kata sandi" secureTextEntry />
              <View style={styles.actions}>
                <ActionButton title="Atur kata sandi" onPress={saveManualPassword} disabled={busy} />
                <ActionButton title="Batal" secondary onPress={() => setPasswordTarget(null)} disabled={busy} />
              </View>
            </Card>
          </ScrollView> : null}
        </KeyboardAvoidingView>
      </SafeAreaView></SafeAreaProvider>
    </Modal>
    <ConfirmModal visible={Boolean(confirmation)} title={confirmation?.title ?? ''} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel ?? 'Konfirmasi'} danger={confirmation?.danger} onCancel={() => setConfirmation(null)} onConfirm={() => { const action = confirmation?.onConfirm; setConfirmation(null); action?.(); }} />
  </ScreenPage>;
}
