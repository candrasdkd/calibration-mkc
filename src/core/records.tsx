import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { createInitialData, getInstrument, getInstrumentTemplateId } from './instruments';
import type { Customer } from './admin-data';
import type { CalibrationRecord, Instrument, VersionedFormulaMethod } from './types';
import { supabase } from './supabase';
import { deleteRemoteCalibrationRecord, loadCalibrationRecords, saveCalibrationRecords } from './supabaseSync';

const STORAGE_KEY = 'kalibrasi-mobile-records-v1';
export type RecordsContextValue = {
  records: CalibrationRecord[];
  loaded: boolean;
  localReady: boolean;
  storageError: string;
  createRecord: (instrument: Instrument, method: string, customer?: Pick<Customer, 'id' | 'name' | 'address' | 'city' | 'province'>, environmentMethod?: VersionedFormulaMethod, technicianName?: string, orderGroupId?: string) => string | null;
  assignOrderNumber: (orderGroupId: string, orderNumber: string) => void;
  updateRecord: (id: string, update: Partial<Pick<CalibrationRecord, 'data'>>) => void;
  deleteRecord: (id: string) => void;
};

export const RecordsContext = createContext<RecordsContextValue | null>(null);

function migrateRecord(value: unknown): CalibrationRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format catatan lokal tidak sesuai.');
  return value as CalibrationRecord;
}

export function RecordsProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [cloudError, setCloudError] = useState('');
  const [cloudReady, setCloudReady] = useState(false);
  const [cloudUserId, setCloudUserId] = useState('');
  const recordsRef = useRef(records);
  const cloudWrites = useRef(0);
  const realtimeRefreshPending = useRef(false);
  const refreshCloud = useRef<() => void>(() => {});

  useEffect(() => { recordsRef.current = records; }, [records]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(async (value) => {
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error('Format catatan lokal tidak sesuai.');
          const storedRecords = parsed.map(migrateRecord);
          const cleanRecords = storedRecords.flatMap((record) => {
            const { isDemo, ...clean } = record as CalibrationRecord & { isDemo?: boolean };
            return isDemo ? [] : [clean];
          });
          if (JSON.stringify(storedRecords) !== JSON.stringify(cleanRecords)) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleanRecords));
          }
          setRecords(cleanRecords);
        }
      })
      .catch(() => {
        setLoadFailed(true);
        setStorageError('Data lokal tidak dapat dibaca; penyimpanan dijeda agar catatan lama tidak tertimpa.');
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
        if (active) { setCloudReady(false); setCloudUserId(''); }
        return;
      }
      const remote = await loadCalibrationRecords();
      const merged = new Map(remote.map((record) => [record.id, record]));
      for (const local of recordsRef.current) {
        const current = merged.get(local.id);
        if (!current || Date.parse(local.updatedAt) > Date.parse(current.updatedAt)) merged.set(local.id, local);
      }
      if (!active) return;
      const next = [...merged.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
      if (JSON.stringify(recordsRef.current) !== JSON.stringify(next)) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        recordsRef.current = next;
        setRecords(next);
      }
      setCloudUserId(session.user.id);
      setCloudReady(true);
      setCloudError('');
    };
    const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setCloudReady(false); setCloudUserId(''); return; }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') setTimeout(() => { void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi pengerjaan gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); }); }, 0);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi pengerjaan gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); });
    });
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (!active) return;
      if (cloudWrites.current) { realtimeRefreshPending.current = true; return; }
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = undefined;
        if (cloudWrites.current) { realtimeRefreshPending.current = true; return; }
        void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi pengerjaan gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); });
      }, 450);
    };
    refreshCloud.current = scheduleRefresh;
    const realtime = db.channel('calibration-records-sync').on('postgres_changes', {
      event: '*', schema: 'public', table: 'calibration_records',
    }, (payload) => {
      const change = payload as unknown as { eventType: string; old?: Record<string, unknown> };
      if (change.eventType === 'DELETE' && typeof change.old?.id === 'string') {
        const id = change.old.id;
        const next = recordsRef.current.filter((record) => record.id !== id);
        recordsRef.current = next;
        setRecords(next);
      }
      scheduleRefresh();
    });
    realtime.subscribe();
    void syncFromCloud().catch((error) => { if (active) setCloudError(`Sinkronisasi pengerjaan gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); });
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
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records))
        .then(() => setStorageError(''))
        .catch(() => setStorageError('Data tidak tersimpan di perangkat. Pastikan ruang penyimpanan cukup.'));
    }, 300);
    return () => clearTimeout(timeout);
  }, [loaded, loadFailed, records]);

  useEffect(() => {
    if (!cloudReady || !cloudUserId || loadFailed) return undefined;
    let active = true;
    const timeout = setTimeout(() => {
      cloudWrites.current += 1;
      void saveCalibrationRecords(records, cloudUserId)
        .then(() => { if (active) setCloudError(''); })
        .catch((error) => { if (active) setCloudError(`Sinkronisasi pengerjaan gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`); })
        .finally(() => {
          cloudWrites.current -= 1;
          if (!cloudWrites.current && realtimeRefreshPending.current) {
            realtimeRefreshPending.current = false;
            refreshCloud.current();
          }
        });
    }, 350);
    return () => { active = false; clearTimeout(timeout); };
  }, [cloudReady, cloudUserId, loadFailed, records]);

  const value = useMemo<RecordsContextValue>(() => ({
    records,
    loaded,
    localReady: loaded && !loadFailed,
    storageError: cloudError || storageError,
    createRecord(instrument, method, customer, environmentMethod, technicianName = '', orderGroupId = '') {
      if (!getInstrument(getInstrumentTemplateId(instrument)) || !instrument.name.trim() || !method.trim()) return null;
      const now = new Date().toISOString();
      const data = createInitialData(instrument);
      if (environmentMethod) data.environment.formulaMethod = environmentMethod;
      if (orderGroupId) data.orderGroupId = orderGroupId;
      data.identity = {
        ...data.identity,
        method: method.trim(),
        technician: technicianName.trim(),
        ...(customer ? {
          customerId: customer.id,
          customer: customer.name,
          address: customer.address,
          city: `${customer.city}, ${customer.province}`,
        } : {}),
      };
      const record = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        instrumentId: instrument.id,
        instrumentSnapshot: instrument,
        createdAt: now,
        updatedAt: now,
        data,
      };
      setRecords((current) => [record, ...current]);
      return record.id;
    },
    assignOrderNumber(orderGroupId, orderNumber) {
      setRecords((current) => current.map((record) => record.data.orderGroupId === orderGroupId && !record.data.identity.orderNumber
        ? { ...record, data: { ...record.data, identity: { ...record.data.identity, orderNumber } }, updatedAt: new Date().toISOString() }
        : record));
    },
    updateRecord(id, update) {
      setRecords((current) => current.map((record) => record.id === id
        ? { ...record, ...update, updatedAt: new Date().toISOString() }
        : record));
    },
    deleteRecord(id) {
      setRecords((current) => current.filter((record) => record.id !== id));
      if (cloudReady) void deleteRemoteCalibrationRecord(id).catch((error) => setCloudError(`Penghapusan pengerjaan gagal: ${error instanceof Error ? error.message : 'periksa koneksi Supabase.'}`));
    },
  }), [cloudReady, cloudError, loaded, loadFailed, records, storageError]);

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

