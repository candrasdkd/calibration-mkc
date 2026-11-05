import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton } from '../../../components/ui';
import type { Customer } from '../../../core/admin-data';
import { colors } from '../../../core/theme';
import { styles } from '../styles/AdminStyles';
import { useRegionOptions } from '../hooks/useRegionOptions';
import type { RegionOption } from '../types/RegionOption';

function RegionPicker({ label, value, options, placeholder, disabled, loading, error, onRetry, onSelect }: {
  label: string;
  value: string;
  options: RegionOption[];
  placeholder: string;
  disabled?: boolean;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (region: RegionOption) => void;
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = options.filter((region) => region.name.toLowerCase().includes(query.trim().toLowerCase()));
  const open = () => { setQuery(''); setVisible(true); };
  const close = () => setVisible(false);
  return <View style={styles.regionFieldWrap}>
    <Text style={styles.regionFieldLabel}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} disabled={disabled} onPress={open} style={[styles.regionField, disabled && styles.regionFieldDisabled]}>
      <Text numberOfLines={1} style={value ? styles.regionValue : styles.regionPlaceholder}>{value || (loading ? 'Memuat pilihan…' : placeholder)}</Text>
      {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.regionChevron}>⌄</Text>}
    </Pressable>
    {error ? <Text style={styles.regionError}>{error}</Text> : null}
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaProvider><SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.regionModal}>
        <View style={styles.regionModalHeader}>
          <Pressable accessibilityRole="button" onPress={close} style={styles.regionBack}><Text style={styles.regionBackText}>‹</Text><Text style={styles.regionBackLabel}>Kembali</Text></Pressable>
          <Text style={styles.regionModalTitle}>Pilih {label.toLowerCase()}</Text>
          <Text style={styles.regionModalCount}>{options.length}</Text>
        </View>
        <TextInput accessibilityLabel={`Cari ${label.toLowerCase()}`} value={query} onChangeText={setQuery} placeholder={`Cari ${label.toLowerCase()}…`} placeholderTextColor="#84959B" autoCorrect={false} returnKeyType="search" style={styles.regionSearch} />
        {loading ? <View style={styles.regionState}><ActivityIndicator color={colors.primary} /><Text style={styles.regionStateText}>Memuat daftar wilayah…</Text></View> : error ? <View style={styles.regionState}><Text style={styles.regionError}>{error}</Text><ActionButton title="Coba lagi" secondary onPress={onRetry} /></View> : <ScrollView style={styles.regionOptionList} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.regionOptions}>
          {filtered.length ? filtered.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => { onSelect(item); close(); }} style={({ pressed }) => [styles.regionOption, pressed && styles.regionOptionPressed]}>
            <Text style={styles.regionOptionName}>{item.name}</Text><Text style={styles.regionOptionArrow}>›</Text>
          </Pressable>) : <Text style={styles.regionEmpty}>Tidak ada wilayah yang cocok.</Text>}
        </ScrollView>}
      </SafeAreaView></SafeAreaProvider>
    </Modal>
  </View>;
}

function normalizedRegionName(name: string) {
  return name.trim().replace(/^(kota(?:\s+administrasi)?|kabupaten)\s+/i, '').toLowerCase();
}

function resolveRegionId(id: string, name: string, options: RegionOption[]) {
  return id || options.find((item) => normalizedRegionName(item.name) === normalizedRegionName(name))?.id || '';
}

export function CustomerLocationFields({ customer, onChange }: { customer: Customer; onChange: (patch: Partial<Customer>) => void }) {
  const [provinceId, setProvinceId] = useState(customer.provinceId ?? '');
  const [cityId, setCityId] = useState(customer.cityId ?? '');
  const [districtId, setDistrictId] = useState(customer.districtId ?? '');
  const provinces = useRegionOptions('provinces.json');
  const selectedProvinceId = resolveRegionId(provinceId, customer.province, provinces.options);
  const cities = useRegionOptions(selectedProvinceId ? `regencies/${encodeURIComponent(selectedProvinceId)}.json` : null);
  const selectedCityId = resolveRegionId(cityId, customer.city, cities.options);
  const districts = useRegionOptions(selectedCityId ? `districts/${encodeURIComponent(selectedCityId)}.json` : null);
  const selectedDistrictId = resolveRegionId(districtId, customer.district, districts.options);
  const villages = useRegionOptions(selectedDistrictId ? `villages/${encodeURIComponent(selectedDistrictId)}.json` : null);

  return <View style={styles.locationFields}>
    <RegionPicker label="Provinsi" value={customer.province} options={provinces.options} placeholder="Pilih provinsi" loading={provinces.loading} error={provinces.error} onRetry={provinces.retry} onSelect={(item) => {
      if (item.id === selectedProvinceId) return;
      setProvinceId(item.id); setCityId(''); setDistrictId('');
      onChange({ province: item.name, provinceId: item.id, city: '', cityId: '', district: '', districtId: '', village: '', villageId: '' });
    }} />
    <RegionPicker label="Kota / kabupaten" value={customer.city} options={cities.options} placeholder="Pilih kota / kabupaten" disabled={!selectedProvinceId} loading={cities.loading} error={cities.error} onRetry={cities.retry} onSelect={(item) => {
      if (item.id === selectedCityId) return;
      setCityId(item.id); setDistrictId('');
      onChange({ provinceId: selectedProvinceId, city: item.name, cityId: item.id, district: '', districtId: '', village: '', villageId: '' });
    }} />
    <RegionPicker label="Kecamatan" value={customer.district} options={districts.options} placeholder="Pilih kecamatan" disabled={!selectedCityId} loading={districts.loading} error={districts.error} onRetry={districts.retry} onSelect={(item) => {
      if (item.id === selectedDistrictId) return;
      setDistrictId(item.id);
      onChange({ provinceId: selectedProvinceId, cityId: selectedCityId, district: item.name, districtId: item.id, village: '', villageId: '' });
    }} />
    <RegionPicker label="Kelurahan / desa" value={customer.village} options={villages.options} placeholder="Pilih kelurahan / desa" disabled={!selectedDistrictId} loading={villages.loading} error={villages.error} onRetry={villages.retry} onSelect={(item) => {
      onChange({ provinceId: selectedProvinceId, cityId: selectedCityId, districtId: selectedDistrictId, village: item.name, villageId: item.id });
    }} />
  </View>;
}
