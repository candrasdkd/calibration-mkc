import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card } from '../../../components/ui';
import { ScreenPage } from '../../../components/ScreenPage';
import { useAdminData } from '../../admin/hooks/useAdminData';
import { instruments } from '../../../core/instruments';
import { useRecords } from '../hooks/useRecords';
import { styles } from '../styles/FormScreenStyles';


export function FormScreen() {
  const router = useRouter();
  const { loaded, storageError, createRecord } = useRecords();
  const directory = useAdminData();
  const availableInstruments = instruments.flatMap((instrument) => {
    const method = directory.equipmentMethods.find((item) => item.instrumentId === instrument.id)?.method.trim();
    return method ? [{ instrument, method }] : [];
  });
  const blocked = !loaded || !directory.loaded || Boolean(storageError || directory.storageError);
  const startNew = (instrumentId: string, method: string) => {
    const id = createRecord(instrumentId, method);
    if (id) router.push(`/calibration/${id}`);
  };
  return <ScreenPage title="Form pengerjaan" hint="Pilih jenis alat yang sudah disiapkan admin. Metode kerja akan terisi otomatis di formulir.">
    {storageError || directory.storageError ? <Card style={styles.storageWarning}><Text style={styles.warningText}>{storageError || directory.storageError}</Text></Card> : null}
    {!directory.loaded ? <Card><Text style={styles.emptyText}>Memuat jenis alat…</Text></Card> : null}
    {directory.loaded && !availableInstruments.length ? <Card style={styles.emptyCard}><Text style={styles.emptyTitle}>Jenis alat belum tersedia</Text><Text style={styles.emptyText}>Minta admin menambahkan jenis alat dan mengisi metode kerjanya di menu Data alat kesehatan.</Text></Card> : null}
    {availableInstruments.length ? <Text style={styles.selectionEyebrow}>JENIS ALAT TERSEDIA · {availableInstruments.length}</Text> : null}
    <View style={styles.instrumentGrid}>{availableInstruments.map(({ instrument, method }, index) => <Pressable
      key={instrument.id}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked }}
      accessibilityLabel={`Mulai pengerjaan ${instrument.name}`}
      disabled={blocked}
      onPress={() => startNew(instrument.id, method)}
      style={({ pressed }) => [styles.instrumentCard, blocked && styles.disabled, pressed && styles.pressed]}
    >
      <View style={styles.instrumentCardTop}><View style={styles.instrumentIcon}><Text style={styles.instrumentIconText}>{String(index + 1).padStart(2, '0')}</Text></View><Text style={styles.instrumentCode}>INSTRUMEN {String(index + 1).padStart(2, '0')}</Text></View>
      <View style={styles.instrumentCopy}><Text style={styles.instrumentName}>{instrument.name}</Text><Text style={styles.instrumentSubtitle}>{instrument.subtitle}</Text><Text style={styles.instrumentMethodLabel}>METODE KERJA</Text><Text numberOfLines={3} style={styles.instrumentMethod}>{method}</Text></View>
      <View style={styles.instrumentFooter}><Text style={styles.instrumentStart}>Mulai isi form</Text><Text style={styles.chevron}>→</Text></View>
    </Pressable>)}</View>
  </ScreenPage>;
}
