import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Card, ConfirmModal, Field, Heading } from '../../../components/ui';
import { defaultEnvironmentExpressions, environmentFormulaFields, validateEnvironmentFormulaExpressions } from '../../../core/methodFormulas';
import type { EnvironmentMethodDraft, MethodChangeMetadata, VersionedFormulaMethod } from '../../../core/types';
import { styles } from '../styles/FormulaEditorModalStyles';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export function EnvironmentFormulaModal({ visible, method, draft, onClose, onSaveDraft, onPublish, onDiscardDraft }: {
  visible: boolean;
  method: VersionedFormulaMethod;
  draft?: EnvironmentMethodDraft;
  onClose: () => void;
  onSaveDraft: (method: Omit<VersionedFormulaMethod, 'version'>, metadata: MethodChangeMetadata) => void;
  onPublish: (method: Omit<VersionedFormulaMethod, 'version'>, metadata: MethodChangeMetadata) => void;
  onDiscardDraft: () => void;
}) {
  const [resolution, setResolution] = useState(() => String(draft?.resolution ?? method.resolution));
  const [expressions, setExpressions] = useState(() => ({ ...defaultEnvironmentExpressions, ...(draft?.expressions ?? method.expressions) }));
  const [metadata, setMetadata] = useState<MethodChangeMetadata>(() => draft ? {
    source: draft.source, reason: draft.reason, verificationNote: draft.verificationNote,
    verifiedBy: draft.verifiedBy, effectiveDate: draft.effectiveDate,
  } : { source: '', reason: '', verificationNote: '', verifiedBy: '', effectiveDate: today() });
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [confirmDraftSave, setConfirmDraftSave] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const requestPublish = () => {
    const parsedResolution = Number(resolution.replace(',', '.'));
    if (!Number.isFinite(parsedResolution) || parsedResolution <= 0) {
      Alert.alert('Resolusi tidak valid', 'Masukkan resolusi thermohygrometer lebih dari nol.');
      return;
    }
    if (Object.values(expressions).some((expression) => expression.length > 512)) {
      Alert.alert('Rumus terlalu panjang', 'Maksimal 512 karakter untuk setiap persamaan.');
      return;
    }
    const error = validateEnvironmentFormulaExpressions(expressions);
    if (error) {
      Alert.alert('Rumus belum valid', error);
      return;
    }
    if (!metadata.source.trim() || !metadata.reason.trim() || !metadata.verificationNote.trim() || !metadata.verifiedBy.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.effectiveDate)) {
      Alert.alert('Data verifikasi belum lengkap', 'Isi sumber acuan, alasan perubahan, catatan hasil pembanding, nama pemeriksa, dan tanggal berlaku sebelum mengaktifkan metode.');
      return;
    }
    setConfirmPublish(true);
  };

  const saveDraft = () => {
    onSaveDraft({ resolution: Number(resolution.replace(',', '.')), expressions }, metadata);
    setConfirmDraftSave(false);
    onClose();
  };
  const publish = () => {
    onPublish({ resolution: Number(resolution.replace(',', '.')), expressions }, metadata);
    setConfirmPublish(false);
    onClose();
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
    <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerCopy}><Text style={styles.headerTitle}>{draft ? 'Lanjutkan draft lingkungan' : 'Edit draft lingkungan'}</Text><Text style={styles.headerSubtitle}>Aktif v{method.version} · draft v{method.version + 1}</Text></View>
          <Pressable accessibilityRole="button" onPress={onClose}><Text style={styles.close}>Tutup</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Heading title="Kondisi lingkungan" hint="Versi ini dipakai pada pekerjaan baru. Pekerjaan yang sudah dibuat menyimpan rumus lingkungan sendiri." />
            <Field label="Resolusi thermohygrometer" value={resolution} keyboard="decimal-pad" onChange={setResolution} />
            <View style={styles.sectionTitle}><Text style={styles.sectionName}>Sumber dan verifikasi</Text></View>
            <Field label="Sumber acuan / versi dokumen" value={metadata.source} onChange={(value) => setMetadata((current) => ({ ...current, source: value }))} placeholder="Contoh: Workbook lingkungan 2026" />
            <Field label="Alasan perubahan" value={metadata.reason} onChange={(value) => setMetadata((current) => ({ ...current, reason: value }))} multiline />
            <Field label="Catatan pembanding Excel / acuan" value={metadata.verificationNote} onChange={(value) => setMetadata((current) => ({ ...current, verificationNote: value }))} multiline placeholder="Tulis kasus uji dan hasil Excel vs aplikasi" />
            <View style={styles.twoColumns}>
              <View style={styles.column}><Field label="Diperiksa oleh" value={metadata.verifiedBy} onChange={(value) => setMetadata((current) => ({ ...current, verifiedBy: value }))} /></View>
              <View style={styles.column}><Field label="Tanggal berlaku (YYYY-MM-DD)" value={metadata.effectiveDate} onChange={(value) => setMetadata((current) => ({ ...current, effectiveDate: value }))} /></View>
            </View>
            <Text style={styles.formulaHint}>Pemeriksaan otomatis mengecek validitas rumus. Catatan pembanding wajib diisi dari Excel atau metode yang disetujui. Tanpa login, nama pemeriksa hanya tercatat lokal.</Text>
          </Card>
          <View style={styles.listHeading}><Text style={styles.sectionName}>Persamaan</Text></View>
          {environmentFormulaFields.map((field) => <Card key={field.key}>
            <Field label={field.label} value={expressions[field.key as keyof typeof expressions]} onChange={(value) => setExpressions((current) => ({ ...current, [field.key]: value }))} multiline />
            <Text style={styles.formulaHint}>{field.detail}</Text>
          </Card>)}
          <View style={styles.actions}>
            <ActionButton title="Simpan sebagai draft" secondary onPress={() => setConfirmDraftSave(true)} />
            <ActionButton title="Aktifkan versi terverifikasi" onPress={requestPublish} />
            {draft ? <ActionButton title="Hapus draft" secondary onPress={() => setConfirmDiscard(true)} /> : null}
            <ActionButton title="Batal" secondary onPress={onClose} />
          </View>
          <Text style={styles.footerNote}>Rumus diperiksa dengan contoh angka. Cocokkan kembali hasilnya dengan sertifikat dan workbook yang disetujui.</Text>
        </ScrollView>
        <ConfirmModal visible={confirmPublish} title="Aktifkan rumus lingkungan?" message={`Pekerjaan baru memakai versi ${method.version + 1}. Sumber: ${metadata.source}. Pembanding: ${metadata.verificationNote}. Pemeriksa: ${metadata.verifiedBy}.`} confirmLabel="Aktifkan" onCancel={() => setConfirmPublish(false)} onConfirm={publish} />
        <ConfirmModal visible={confirmDraftSave} title="Simpan draft rumus lingkungan?" message={`Rumus lingkungan aktif v${method.version} tidak berubah. Draft hanya tersimpan di perangkat.`} confirmLabel="Simpan draft" onCancel={() => setConfirmDraftSave(false)} onConfirm={saveDraft} />
        <ConfirmModal visible={confirmDiscard} title="Hapus draft rumus lingkungan?" message="Rumus lingkungan yang aktif tidak berubah." confirmLabel="Hapus draft" onCancel={() => setConfirmDiscard(false)} onConfirm={() => { onDiscardDraft(); setConfirmDiscard(false); onClose(); }} />
      </KeyboardAvoidingView>
    </SafeAreaView></SafeAreaProvider>
  </Modal>;
}
