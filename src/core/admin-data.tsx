import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { instruments, thermohygrometers } from './instruments';
import type { CustomEquipment, EnvironmentMethodDraft, EnvironmentMethodRevision, Instrument, InstrumentMethodDraft, InstrumentMethodRevision, MethodChangeMetadata, Thermohygrometer, VersionedFormulaMethod } from './types';
import { defaultEnvironmentExpressions } from './methodFormulas';
import { supabase } from './supabase';
import { deleteAdminRow, deleteMethodDraft, inviteTechnicianAccount, loadAdminDirectory, saveAdminDirectory, sendTechnicianAccessLink, setTechnicianPassword, updateTechnicianAccountStatus } from './supabaseSync';

export interface ContactPerson { id: string; name: string; phone: string }
export interface Customer { id: string; name: string; province: string; provinceId?: string; city: string; cityId?: string; district: string; districtId?: string; village: string; villageId?: string; address: string; contacts: ContactPerson[] }
export interface CorrectionPoint { value: string; correction: string }
export interface ThermohygrometerCertificate { temperature: CorrectionPoint[]; humidity: CorrectionPoint[]; temperatureU95: string; humidityU95: string }
export interface WeighingStandardCalibration { nominalKg: string; uncertaintyU95G: string; conventionalMass2025G: string; conventionalMass2026G: string }
export interface MeasuringDevice { id: string; name: string; brand: string; model: string; serial: string; isThermohygrometer: boolean; certificate: ThermohygrometerCertificate | null; weighingStandard?: WeighingStandardCalibration | null }
export type TechnicianAccountStatus = 'unlinked' | 'invited' | 'active' | 'disabled';
export interface TechnicianProfile { id: string; name: string; email: string; phone: string; userId: string | null; accountStatus: TechnicianAccountStatus }
export interface EquipmentMethod { instrumentId: string; method: string }
export type AdminDirectory = { customers: Customer[]; devices: MeasuringDevice[]; technicians: TechnicianProfile[]; equipmentMethods: EquipmentMethod[]; customEquipment: CustomEquipment[]; methodRevisions: InstrumentMethodRevision[]; methodDrafts: InstrumentMethodDraft[]; environmentMethod: VersionedFormulaMethod; environmentMethodRevisions: EnvironmentMethodRevision[]; environmentDraft: EnvironmentMethodDraft | null };

const STORAGE_KEY = 'kalibrasi-admin-directory-v1';
const defaultEnvironmentMethod: VersionedFormulaMethod = { version: 1, resolution: 0.1, expressions: { ...defaultEnvironmentExpressions } };
const certificateFrom = (reference: Thermohygrometer): ThermohygrometerCertificate => ({
  temperature: reference.temperature.map(({ value, correction }) => ({ value: String(value), correction: String(correction) })),
  humidity: reference.humidity.map(({ value, correction }) => ({ value: String(value), correction: String(correction) })),
  temperatureU95: String(reference.temperatureU95), humidityU95: String(reference.humidityU95),
});
const emptyDirectory = (): AdminDirectory => ({
  customers: [], devices: [], technicians: [], equipmentMethods: [], customEquipment: [],
  methodRevisions: [], methodDrafts: [], environmentMethod: { ...defaultEnvironmentMethod },
  environmentMethodRevisions: [], environmentDraft: null,
});

export type AdminDataContextValue = AdminDirectory & {
  loaded: boolean;
  localReady: boolean;
  storageError: string;
  saveCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  saveDevice: (device: MeasuringDevice) => void;
  deleteDevice: (id: string) => void;
  saveTechnician: (technician: TechnicianProfile) => void;
  inviteTechnician: (technician: Pick<TechnicianProfile, 'name' | 'email' | 'phone'>, redirectTo: string, existingId?: string, manualOnly?: boolean) => Promise<{ technician: TechnicianProfile; invitationSent: boolean }>;
  sendTechnicianAccessLink: (id: string, redirectTo: string) => Promise<'invitation' | 'password-reset'>;
  setTechnicianPassword: (id: string, password: string) => Promise<void>;
  setTechnicianAccountStatus: (id: string, status: 'active' | 'disabled') => Promise<void>;
  deleteTechnician: (id: string) => void;
  saveEquipmentMethod: (entry: EquipmentMethod) => void;
  deleteEquipmentMethod: (instrumentId: string) => void;
  saveCustomEquipment: (entry: CustomEquipment) => void;
  deleteCustomEquipment: (id: string) => void;
  saveInstrumentMethodDraft: (instrument: Instrument, metadata: MethodChangeMetadata) => void;
  publishInstrumentMethod: (instrument: Instrument, metadata: MethodChangeMetadata) => void;
  discardInstrumentMethodDraft: (instrumentId: string) => void;
  saveEnvironmentMethodDraft: (method: Omit<VersionedFormulaMethod, 'version'>, metadata: MethodChangeMetadata) => void;
  publishEnvironmentMethod: (method: Omit<VersionedFormulaMethod, 'version'>, metadata: MethodChangeMetadata) => void;
  discardEnvironmentMethodDraft: () => void;
};

export const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function newAdminId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function upsert<T extends { id: string }>(items: T[], item: T, prefix: string): T[] {
  const saved = { ...item, id: item.id || newAdminId(prefix) };
  return items.some((current) => current.id === saved.id)
    ? items.map((current) => current.id === saved.id ? saved : current)
    : [saved, ...items];
}

function withoutLegacyDemo<T extends object>(items: T[]): T[] {
  return items.flatMap((item) => {
    if ((item as T & { isDemo?: boolean }).isDemo) return [];
    const { isDemo: _isDemo, ...clean } = item as T & { isDemo?: boolean };
    return [clean as T];
  });
}

function parseDirectory(value: unknown): AdminDirectory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format data admin tidak sesuai.');
  const directory = value as Partial<AdminDirectory>;
  if (!Array.isArray(directory.customers) || !Array.isArray(directory.devices) || !Array.isArray(directory.technicians)) {
    throw new Error('Daftar data admin tidak lengkap.');
  }
  const devices: MeasuringDevice[] = withoutLegacyDemo(directory.devices).map((item) => {
    const reference = thermohygrometers.find((thermo) => thermo.serial === item.serial);
    const weight = item.weighingStandard;
    const validWeight = weight && typeof weight.nominalKg === 'string' && typeof weight.uncertaintyU95G === 'string'
      && typeof weight.conventionalMass2025G === 'string' && typeof weight.conventionalMass2026G === 'string' ? weight : null;
    return {
      ...item,
      isThermohygrometer: item.isThermohygrometer ?? Boolean(reference),
      certificate: item.certificate ?? (reference ? certificateFrom(reference) : null),
      weighingStandard: validWeight,
    };
  });
  return {
    customers: withoutLegacyDemo(directory.customers),
    devices,
    technicians: withoutLegacyDemo(directory.technicians).map((technician) => ({
      ...technician,
      email: typeof technician.email === 'string' ? technician.email : '',
      userId: typeof technician.userId === 'string' ? technician.userId : null,
      accountStatus: ['unlinked', 'invited', 'active', 'disabled'].includes(technician.accountStatus)
        ? technician.accountStatus
        : technician.userId ? 'active' : 'unlinked',
    })),
    equipmentMethods: Array.isArray(directory.equipmentMethods)
      ? directory.equipmentMethods.filter((entry): entry is EquipmentMethod => Boolean(entry && typeof entry.instrumentId === 'string' && typeof entry.method === 'string' && instruments.some((instrument) => instrument.id === entry.instrumentId)))
      : [],
    customEquipment: Array.isArray(directory.customEquipment)
      ? directory.customEquipment.filter((entry): entry is CustomEquipment => Boolean(entry && typeof entry.id === 'string' && entry.id && typeof entry.templateId === 'string' && instruments.some((instrument) => instrument.id === entry.templateId) && typeof entry.name === 'string' && entry.name.trim() && typeof entry.method === 'string' && entry.method.trim() && Array.isArray(entry.standardNames) && entry.standardNames.every((name) => typeof name === 'string')))
      : [],
    methodRevisions: Array.isArray(directory.methodRevisions)
      ? directory.methodRevisions.filter((entry): entry is InstrumentMethodRevision => Boolean(entry && typeof entry.instrumentId === 'string'
        && instruments.some((instrument) => instrument.id === entry.instrumentId) && Number.isInteger(entry.version) && entry.version > 0
        && typeof entry.updatedAt === 'string' && entry.instrument && entry.instrument.id === entry.instrumentId
        && Array.isArray(entry.instrument.performanceRows) && Array.isArray(entry.instrument.inspectionItems)
        && Array.isArray(entry.instrument.standards) && entry.instrument.score && entry.instrument.references))
      : [],
    methodDrafts: Array.isArray(directory.methodDrafts)
      ? directory.methodDrafts.filter((entry): entry is InstrumentMethodDraft => Boolean(entry && typeof entry.instrumentId === 'string'
        && instruments.some((instrument) => instrument.id === entry.instrumentId) && typeof entry.updatedAt === 'string'
        && entry.instrument && entry.instrument.id === entry.instrumentId && Array.isArray(entry.instrument.performanceRows)
        && typeof entry.source === 'string' && typeof entry.reason === 'string' && typeof entry.verificationNote === 'string'
        && typeof entry.verifiedBy === 'string' && typeof entry.effectiveDate === 'string'))
      : [],
    environmentMethod: directory.environmentMethod && Number.isInteger(directory.environmentMethod.version)
      && typeof directory.environmentMethod.resolution === 'number'
      && directory.environmentMethod.expressions && typeof directory.environmentMethod.expressions === 'object'
      ? directory.environmentMethod as VersionedFormulaMethod
      : { ...defaultEnvironmentMethod },
    environmentMethodRevisions: Array.isArray(directory.environmentMethodRevisions)
      ? directory.environmentMethodRevisions.filter((entry): entry is EnvironmentMethodRevision => Boolean(entry && Number.isInteger(entry.version)
        && typeof entry.updatedAt === 'string' && typeof entry.resolution === 'number' && entry.expressions && typeof entry.expressions === 'object'))
      : [],
    environmentDraft: directory.environmentDraft && typeof directory.environmentDraft.updatedAt === 'string'
      && typeof directory.environmentDraft.resolution === 'number' && directory.environmentDraft.expressions
      && typeof directory.environmentDraft.source === 'string' && typeof directory.environmentDraft.reason === 'string'
      && typeof directory.environmentDraft.verificationNote === 'string' && typeof directory.environmentDraft.verifiedBy === 'string'
      && typeof directory.environmentDraft.effectiveDate === 'string' ? directory.environmentDraft as EnvironmentMethodDraft : null,
  };
}

export function AdminDataProvider({ children }: PropsWithChildren) {
  const [directory, setDirectory] = useState<AdminDirectory>(emptyDirectory);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudAdmin, setCloudAdmin] = useState(false);
  const [cloudUserId, setCloudUserId] = useState('');
  const directoryRef = useRef(directory);
  const cloudWrites = useRef(0);
  const realtimeRefreshPending = useRef(false);
  const refreshCloud = useRef<() => void>(() => {});

  useEffect(() => { directoryRef.current = directory; }, [directory]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (value) => {
        if (!value) return;
        const stored = JSON.parse(value) as unknown;
        const parsed = parseDirectory(stored);
        if (JSON.stringify(stored) !== JSON.stringify(parsed)) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        setDirectory(parsed);
      })
      .catch(() => {
        setLoadFailed(true);
        setStorageError('Data admin lokal tidak dapat dibaca; penyimpanan dijeda agar data lama tidak tertimpa.');
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const db = supabase;
    if (!loaded || !db) return undefined;
    let active = true;
    const syncFromCloud = async () => {
      const { data: { session }, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        if (active) { setCloudReady(false); setCloudAdmin(false); setCloudUserId(''); }
        return;
      }
      const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', session.user.id).single();
      if (profileError) throw profileError;
      const remote = await loadAdminDirectory();
      const local = directoryRef.current;
      const includeLocal = profile.role === 'admin';
      const merge = <T extends { id?: string; instrumentId?: string; version?: number }>(remoteItems: T[], localItems: T[], key: (item: T) => string) => {
        const merged = new Map(remoteItems.map((item) => [key(item), item]));
        for (const item of localItems) if (includeLocal && !merged.has(key(item))) merged.set(key(item), item);
        return [...merged.values()];
      };
      const merged = parseDirectory({
        ...local, ...remote,
        customers: merge(remote.customers, local.customers, (item) => item.id),
        devices: merge(remote.devices, local.devices, (item) => item.id),
        technicians: merge(remote.technicians, local.technicians, (item) => item.id),
        equipmentMethods: merge(remote.equipmentMethods, local.equipmentMethods, (item) => item.instrumentId),
        customEquipment: merge(remote.customEquipment, local.customEquipment, (item) => item.id),
        methodRevisions: merge(remote.methodRevisions, local.methodRevisions, (item) => `${item.instrumentId}:${item.version}`),
        methodDrafts: merge(remote.methodDrafts, local.methodDrafts, (item) => item.instrumentId),
        environmentMethodRevisions: merge(remote.environmentMethodRevisions, local.environmentMethodRevisions, (item) => String(item.version)),
        environmentMethod: remote.environmentMethodRevisions.length ? remote.environmentMethod : local.environmentMethod,
        environmentDraft: remote.environmentDraft ?? (includeLocal ? local.environmentDraft : null),
      });
      if (!active) return;
      if (JSON.stringify(directoryRef.current) !== JSON.stringify(merged)) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        directoryRef.current = merged;
        setDirectory(merged);
      }
      setCloudUserId(session.user.id);
      setCloudAdmin(profile.role === 'admin');
      setCloudReady(true);
      setCloudError('');
    };
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setCloudReady(false); setCloudAdmin(false); setCloudUserId(''); return; }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setTimeout(() => { void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi data admin gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); }); }, 0);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi data admin gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); });
    });
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (!active) return;
      if (cloudWrites.current) { realtimeRefreshPending.current = true; return; }
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (cloudWrites.current) { realtimeRefreshPending.current = true; return; }
        void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi data admin gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); });
      }, 450);
    };
    refreshCloud.current = scheduleRefresh;
    const realtime = db.channel('admin-directory-sync');
    const realtimeTables = ['customers', 'customer_contacts', 'measuring_devices', 'technicians', 'equipment_catalog', 'calibration_method_revisions'] as const;
    realtimeTables.forEach((table) => realtime.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      const change = payload as unknown as { eventType: string; old?: Record<string, unknown>; new?: Record<string, unknown> };
      const row = change.eventType === 'DELETE' ? change.old : change.new;
      if (table === 'customers' && change.eventType === 'DELETE' && typeof row?.client_id === 'string') {
        const id = row.client_id;
        const next = { ...directoryRef.current, customers: directoryRef.current.customers.filter((item) => item.id !== id) };
        directoryRef.current = next;
        setDirectory(next);
      } else if (table === 'measuring_devices' && change.eventType === 'DELETE' && typeof row?.client_id === 'string') {
        const id = row.client_id;
        const next = { ...directoryRef.current, devices: directoryRef.current.devices.filter((item) => item.id !== id) };
        directoryRef.current = next;
        setDirectory(next);
      } else if (table === 'technicians' && change.eventType === 'DELETE' && typeof row?.client_id === 'string') {
        const id = row.client_id;
        const next = { ...directoryRef.current, technicians: directoryRef.current.technicians.filter((item) => item.id !== id) };
        directoryRef.current = next;
        setDirectory(next);
      } else if (table === 'equipment_catalog' && (change.eventType === 'DELETE' || row?.is_active === false)) {
        const next = row?.is_custom
          ? { ...directoryRef.current, customEquipment: directoryRef.current.customEquipment.filter((item) => item.id !== row.client_id) }
          : { ...directoryRef.current, equipmentMethods: directoryRef.current.equipmentMethods.filter((item) => item.instrumentId !== (row?.template_key ?? row?.client_id)) };
        directoryRef.current = next;
        setDirectory(next);
      } else if (table === 'calibration_method_revisions' && (change.eventType === 'DELETE' || row?.status === 'active') && typeof row?.instrument_key === 'string') {
        const instrumentKey = row.instrument_key;
        const next = instrumentKey === '__environment__'
          ? { ...directoryRef.current, environmentDraft: null }
          : { ...directoryRef.current, methodDrafts: directoryRef.current.methodDrafts.filter((item) => item.instrumentId !== instrumentKey) };
        directoryRef.current = next;
        setDirectory(next);
      }
      scheduleRefresh();
    }));
    realtime.subscribe();
    void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi data admin gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); });
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshCloud.current = () => {};
      void realtime.unsubscribe();
      subscription.unsubscribe();
      appState.remove();
    };
  }, [loaded]);

  useEffect(() => {
    if (!loaded || loadFailed) return undefined;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(directory))
        .then(() => setStorageError(''))
        .catch(() => setStorageError('Data admin tidak tersimpan di perangkat. Pastikan ruang penyimpanan cukup.'));
    }, 300);
    return () => clearTimeout(timeout);
  }, [directory, loaded, loadFailed]);

  useEffect(() => {
    if (!cloudReady || !cloudAdmin || !cloudUserId || loadFailed) return undefined;
    let active = true;
    const timeout = setTimeout(() => {
      cloudWrites.current += 1;
      void saveAdminDirectory(directory, cloudUserId)
        .then(() => { if (active) setCloudError(''); })
        .catch((error) => { if (active) setCloudError(`Sinkronisasi data admin gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); })
        .finally(() => {
          cloudWrites.current -= 1;
          if (!cloudWrites.current && realtimeRefreshPending.current) {
            realtimeRefreshPending.current = false;
            refreshCloud.current();
          }
        });
    }, 350);
    return () => { active = false; clearTimeout(timeout); };
  }, [cloudAdmin, cloudReady, cloudUserId, directory, loadFailed]);

  const removeRemote = useCallback((table: Parameters<typeof deleteAdminRow>[0], id: string) => {
    if (cloudAdmin) void deleteAdminRow(table, id).catch((error) => setCloudError(`Penghapusan cloud gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`));
  }, [cloudAdmin]);

  const value = useMemo<AdminDataContextValue>(() => ({
    ...directory,
    loaded,
    localReady: loaded && !loadFailed,
    storageError: cloudError || storageError,
    saveCustomer: (customer) => setDirectory((current) => ({ ...current, customers: upsert(current.customers, customer, 'customer') })),
    deleteCustomer: (id) => { setDirectory((current) => ({ ...current, customers: current.customers.filter((item) => item.id !== id) })); removeRemote('customers', id); },
    saveDevice: (device) => setDirectory((current) => ({ ...current, devices: upsert(current.devices, device, 'device') })),
    deleteDevice: (id) => { setDirectory((current) => ({ ...current, devices: current.devices.filter((item) => item.id !== id) })); removeRemote('measuring_devices', id); },
    saveTechnician: (technician) => setDirectory((current) => ({ ...current, technicians: upsert(current.technicians, technician, 'technician') })),
    inviteTechnician: async (technician, redirectTo, existingId, manualOnly) => {
      const result = await inviteTechnicianAccount(technician, redirectTo, existingId, manualOnly);
      setDirectory((current) => ({ ...current, technicians: upsert(current.technicians, result.technician, 'technician') }));
      return result;
    },
    sendTechnicianAccessLink: (id, redirectTo) => sendTechnicianAccessLink(id, redirectTo),
    setTechnicianPassword: async (id, password) => {
      await setTechnicianPassword(id, password);
      setDirectory((current) => ({ ...current, technicians: current.technicians.map((item) => item.id === id ? { ...item, accountStatus: 'active' } : item) }));
    },
    setTechnicianAccountStatus: async (id, status) => {
      await updateTechnicianAccountStatus(id, status);
      setDirectory((current) => ({ ...current, technicians: current.technicians.map((item) => item.id === id ? { ...item, accountStatus: status } : item) }));
    },
    deleteTechnician: (id) => { setDirectory((current) => ({ ...current, technicians: current.technicians.filter((item) => item.id !== id) })); removeRemote('technicians', id); },
    saveEquipmentMethod: (entry) => setDirectory((current) => ({ ...current, equipmentMethods: [...current.equipmentMethods.filter((item) => item.instrumentId !== entry.instrumentId), entry] })),
    deleteEquipmentMethod: (instrumentId) => { setDirectory((current) => ({ ...current, equipmentMethods: current.equipmentMethods.filter((item) => item.instrumentId !== instrumentId) })); removeRemote('equipment_catalog', instrumentId); },
    saveCustomEquipment: (entry) => setDirectory((current) => ({ ...current, customEquipment: [...current.customEquipment.filter((item) => item.id !== entry.id), entry] })),
    deleteCustomEquipment: (id) => { setDirectory((current) => ({ ...current, customEquipment: current.customEquipment.filter((item) => item.id !== id) })); removeRemote('equipment_catalog', id); },
    saveInstrumentMethodDraft: (instrument, metadata) => setDirectory((current) => ({
      ...current,
      methodDrafts: [...current.methodDrafts.filter((draft) => draft.instrumentId !== instrument.id), {
        ...metadata, instrumentId: instrument.id, instrument, updatedAt: new Date().toISOString(),
      }],
    })),
    publishInstrumentMethod: (instrument, metadata) => setDirectory((current) => {
      const version = Math.max(0, ...current.methodRevisions.filter((entry) => entry.instrumentId === instrument.id).map((entry) => entry.version)) + 1;
      const revision: InstrumentMethodRevision = {
        ...metadata, instrumentId: instrument.id, version, updatedAt: new Date().toISOString(),
        instrument: { ...instrument, methodVersion: version },
      };
      return {
        ...current,
        methodRevisions: [...current.methodRevisions, revision],
        methodDrafts: current.methodDrafts.filter((draft) => draft.instrumentId !== instrument.id),
      };
    }),
    discardInstrumentMethodDraft: (instrumentId) => {
      setDirectory((current) => ({ ...current, methodDrafts: current.methodDrafts.filter((draft) => draft.instrumentId !== instrumentId) }));
      if (cloudAdmin) void deleteMethodDraft(instrumentId).catch((error) => setCloudError(`Draft metode gagal dihapus: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`));
    },
    saveEnvironmentMethodDraft: (method, metadata) => setDirectory((current) => ({
      ...current, environmentDraft: { ...method, ...metadata, updatedAt: new Date().toISOString() },
    })),
    publishEnvironmentMethod: (method, metadata) => setDirectory((current) => {
      const version = current.environmentMethod.version + 1;
      const revision: EnvironmentMethodRevision = { ...method, ...metadata, version, updatedAt: new Date().toISOString() };
      return {
        ...current,
        environmentMethod: revision,
        environmentMethodRevisions: [...current.environmentMethodRevisions, revision],
        environmentDraft: null,
      };
    }),
    discardEnvironmentMethodDraft: () => {
      setDirectory((current) => ({ ...current, environmentDraft: null }));
      if (cloudAdmin) void deleteMethodDraft('__environment__').catch((error) => setCloudError(`Draft metode gagal dihapus: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`));
    },
  }), [cloudAdmin, cloudError, directory, loaded, loadFailed, removeRemote, storageError]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

