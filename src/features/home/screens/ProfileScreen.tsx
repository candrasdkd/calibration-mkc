import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Navbar } from '../../../components/Navbar';
import { Card, Heading } from '../../../components/ui';
import { useRole } from '../hooks/useRole';
import { styles } from '../styles/ProfileScreenStyles';

export default function ProfileScreen() {
  const { role, setRole } = useRole();
  const isAdmin = role === 'admin';
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <Navbar title="Profil" subtitle="PENGATURAN MODE" />
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROFIL PERAN</Text>
      <Card style={styles.profileCard}>
        <View style={[styles.avatar, isAdmin ? styles.adminAvatar : styles.technicianAvatar]}><Text style={styles.avatarText}>{isAdmin ? 'AD' : 'TK'}</Text></View>
        <View style={styles.profileCopy}>
          <Text style={styles.roleLabel}>ROLE AKTIF</Text>
          <Text style={styles.profileTitle}>{isAdmin ? 'Admin' : 'Teknisi'}</Text>
          <Text style={styles.profileSubtitle}>Mode uji aplikasi · tanpa login</Text>
        </View>
      </Card>

      <Card>
        <Heading title="Pilih role" hint="Role menentukan dashboard dan menu yang tersedia. Kamu bisa menggantinya kapan saja." />
        <View style={styles.roleOptions}>
          {(['admin', 'technician'] as const).map((option) => {
            const selected = role === option;
            return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setRole(option)} style={[styles.roleOption, selected && styles.roleOptionSelected]}>
              <View style={[styles.roleMark, selected && styles.roleMarkSelected]}><Text style={[styles.roleMarkText, selected && styles.roleMarkTextSelected]}>{option === 'admin' ? 'AD' : 'TK'}</Text></View>
              <View style={styles.roleCopy}><Text style={[styles.roleName, selected && styles.roleNameSelected]}>{option === 'admin' ? 'Admin' : 'Teknisi'}</Text><Text style={styles.roleDescription}>{option === 'admin' ? 'Kelola data dan hasil' : 'Kerjakan kalibrasi'}</Text></View>
              {selected ? <Text style={styles.selectedMark}>✓</Text> : null}
            </Pressable>;
          })}
        </View>
      </Card>

      <Card style={styles.localCard}>
        <Text style={styles.localTitle}>Data tersimpan lokal</Text>
        <Text style={styles.localHint}>Data aplikasi saat ini disimpan di perangkat ini. Profil akun dan sinkronisasi belum digunakan.</Text>
      </Card>
    </ScrollView>
  </SafeAreaView>;
}
