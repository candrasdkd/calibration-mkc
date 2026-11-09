import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createInitialData, getInstrument, getInstrumentTemplateId } from './instruments';
import type { Customer } from './admin-data';
import type { CalibrationRecord, Instrument } from './types';

const STORAGE_KEY = 'kalibrasi-mobile-records-v1';
export type RecordsContextValue = {
  records: CalibrationRecord[];
  loaded: boolean;
  storageError: string;
  createRecord: (instrument: Instrument, method: string, customer?: Pick<Customer, 'id' | 'name' | 'address' | 'city' | 'province'>) => string | null;
  updateRecord: (id: string, update: Partial<Pick<CalibrationRecord, 'data'>>) => void;
  deleteRecord: (id: string) => void;
};

export const RecordsContext = createContext<RecordsContextValue | null>(null);

function migrateRecord(value: unknown): CalibrationRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format catatan lokal tidak sesuai.');
  return value as CalibrationRecord;
}

function demoRecord(): CalibrationRecord {
  const data = createInitialData('centrifuge');
  data.identity = { ...data.identity, labelNumber: 'DEMO-001', brand: 'SIMULASI', model: 'CONTOH', serial: 'DEMO-CF-001', technician: 'Dina Teknisi Demo', testDate: '2026-10-15', customer: 'RS Demo Sehat', method: 'Simulasi aplikasi' };
  return { id: 'demo-result-1', instrumentId: 'centrifuge', createdAt: '2026-10-15T09:00:00.000Z', updatedAt: '2026-10-15T09:00:00.000Z', isDemo: true, data };
}

export function RecordsProvider({ children }: PropsWithChildren) {
  const [records, setRecords] = useState<CalibrationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value) {
          const parsed: unknown = JSON.parse(value);
          if (!Array.isArray(parsed)) throw new Error('Format catatan lokal tidak sesuai.');
          setRecords(parsed.map(migrateRecord));
        } else setRecords([demoRecord()]);
      })
      .catch(() => {
        setLoadFailed(true);
        setStorageError('Data lokal tidak dapat dibaca; penyimpanan dijeda agar catatan lama tidak tertimpa.');
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || loadFailed) return undefined;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records))
        .then(() => setStorageError(''))
        .catch(() => setStorageError('Data tidak tersimpan di perangkat. Pastikan ruang penyimpanan cukup.'));
    }, 300);
    return () => clearTimeout(timeout);
  }, [loaded, loadFailed, records]);

  const value = useMemo<RecordsContextValue>(() => ({
    records,
    loaded,
    storageError,
    createRecord(instrument, method, customer) {
      if (!getInstrument(getInstrumentTemplateId(instrument)) || !instrument.name.trim() || !method.trim()) return null;
      const now = new Date().toISOString();
      const data = createInitialData(getInstrumentTemplateId(instrument));
      data.identity = {
        ...data.identity,
        method: method.trim(),
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
    updateRecord(id, update) {
      setRecords((current) => current.map((record) => record.id === id
        ? { ...record, ...update, updatedAt: new Date().toISOString() }
        : record));
    },
    deleteRecord(id) {
      setRecords((current) => current.filter((record) => record.id !== id));
    },
  }), [loaded, records, storageError]);

  return <RecordsContext.Provider value={value}>{children}</RecordsContext.Provider>;
}

