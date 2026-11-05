import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { instruments, thermohygrometers } from './instruments';
import { adultScaleStandardWeights } from './weighingScales';
import type { Thermohygrometer } from './types';

export interface ContactPerson { id: string; name: string; phone: string }
export interface Customer { id: string; name: string; province: string; provinceId?: string; city: string; cityId?: string; district: string; districtId?: string; village: string; villageId?: string; address: string; contacts: ContactPerson[]; isDemo: boolean }
export interface CorrectionPoint { value: string; correction: string }
export interface ThermohygrometerCertificate { temperature: CorrectionPoint[]; humidity: CorrectionPoint[]; temperatureU95: string; humidityU95: string }
export interface WeighingStandardCalibration { nominalKg: string; uncertaintyU95G: string; conventionalMass2025G: string; conventionalMass2026G: string }
export interface MeasuringDevice { id: string; name: string; brand: string; model: string; serial: string; isThermohygrometer: boolean; certificate: ThermohygrometerCertificate | null; weighingStandard?: WeighingStandardCalibration | null; isDemo: boolean }
export interface TechnicianProfile { id: string; name: string; phone: string; isDemo: boolean }
export interface EquipmentMethod { instrumentId: string; method: string }
type AdminDirectory = { customers: Customer[]; devices: MeasuringDevice[]; technicians: TechnicianProfile[]; equipmentMethods: EquipmentMethod[]; seedVersion: number };

const STORAGE_KEY = 'kalibrasi-admin-directory-v1';
const certificateFrom = (reference: Thermohygrometer): ThermohygrometerCertificate => ({
  temperature: reference.temperature.map(({ value, correction }) => ({ value: String(value), correction: String(correction) })),
  humidity: reference.humidity.map(({ value, correction }) => ({ value: String(value), correction: String(correction) })),
  temperatureU95: String(reference.temperatureU95), humidityU95: String(reference.humidityU95),
});
const demoDirectory: AdminDirectory = {
  customers: [
    { id: 'demo-customer-1', name: 'RS Demo Sehat', province: 'Jawa Barat', city: 'Bandung', district: 'Coblong', village: 'Dago', address: 'Jl. Contoh Sehat No. 10', contacts: [{ id: 'demo-pic-1', name: 'Rina Demo', phone: '0812-0000-0001' }], isDemo: true },
    { id: 'demo-customer-2', name: 'RS Contoh Nusantara', province: 'DKI Jakarta', city: 'Jakarta Selatan', district: 'Kebayoran Baru', village: 'Selong', address: 'Jl. Contoh Medika No. 20', contacts: [{ id: 'demo-pic-2', name: 'Budi Contoh', phone: '0812-0000-0002' }, { id: 'demo-pic-3', name: 'Sari Contoh', phone: '0812-0000-0003' }], isDemo: true },
  ],
  devices: [
    { id: 'demo-device-1', name: 'Electrical Safety Analyzer', brand: 'Gossen Metrawatt', model: 'Seculife ST Pro', serial: 'FC7267170003', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-3', name: 'Tachometer', brand: 'Lutron', model: 'DT-1236L', serial: 'I. 52947', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-4', name: 'Stopwatch', brand: 'Seiko', model: 'S23589P7', serial: '740487', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-2', name: 'Thermohygrometer', brand: 'Elitech', model: 'GSP-6', serial: thermohygrometers[0].serial, isThermohygrometer: true, certificate: certificateFrom(thermohygrometers[0]), isDemo: true },
    ...thermohygrometers.slice(1).map((reference, index): MeasuringDevice => ({ id: `demo-device-thermo-${index + 2}`, name: 'Thermohygrometer', brand: 'Elitech', model: 'GSP-6', serial: reference.serial, isThermohygrometer: true, certificate: certificateFrom(reference), isDemo: true })),
    { id: 'demo-device-5', name: 'Vital Sign Simulator', brand: 'Gossen Metrawatt', model: 'Seculife BP Pro', serial: '735AE9911141', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-6', name: 'Gas Flow Analyzer', brand: 'IMT Medical', model: 'PF-300', serial: '2012BA104380', isThermohygrometer: false, certificate: null, isDemo: true },
    ...adultScaleStandardWeights.map((weight, index): MeasuringDevice => ({
      id: `demo-scale-weight-${index + 1}`, name: weight.name, brand: weight.brand, model: weight.model, serial: weight.serial,
      isThermohygrometer: false, certificate: null, weighingStandard: {
        nominalKg: String(weight.nominalKg), uncertaintyU95G: String(weight.uncertaintyU95G),
        conventionalMass2025G: String(weight.conventionalMass2025G), conventionalMass2026G: String(weight.conventionalMass2026G),
      }, isDemo: true,
    })),
  ],
  technicians: [
    { id: 'demo-technician-1', name: 'Dina Teknisi Demo', phone: '0812-0000-0011', isDemo: true },
    { id: 'demo-technician-2', name: 'Rafi Teknisi Demo', phone: '0812-0000-0012', isDemo: true },
  ],
  equipmentMethods: [],
  seedVersion: 4,
};

export type AdminDataContextValue = AdminDirectory & {
  loaded: boolean;
  storageError: string;
  saveCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => void;
  saveDevice: (device: MeasuringDevice) => void;
  deleteDevice: (id: string) => void;
  saveTechnician: (technician: TechnicianProfile) => void;
  deleteTechnician: (id: string) => void;
  saveEquipmentMethod: (entry: EquipmentMethod) => void;
  deleteEquipmentMethod: (instrumentId: string) => void;
};

export const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function newAdminId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function upsert<T extends { id: string; isDemo: boolean }>(items: T[], item: T, prefix: string): T[] {
  const saved = { ...item, id: item.id || newAdminId(prefix), isDemo: false };
  return items.some((current) => current.id === saved.id)
    ? items.map((current) => current.id === saved.id ? saved : current)
    : [saved, ...items];
}

function parseDirectory(value: unknown): AdminDirectory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Format data admin tidak sesuai.');
  const directory = value as Partial<AdminDirectory>;
  if (!Array.isArray(directory.customers) || !Array.isArray(directory.devices) || !Array.isArray(directory.technicians)) {
    throw new Error('Daftar data admin tidak lengkap.');
  }
  const devices: MeasuringDevice[] = directory.devices.map((item) => {
    const legacyDemo = item.isDemo && item.id === 'demo-device-2';
    const reference = thermohygrometers.find((thermo) => thermo.serial === item.serial) ?? (legacyDemo ? thermohygrometers[0] : undefined);
    const weight = item.weighingStandard;
    const validWeight = weight && typeof weight.nominalKg === 'string' && typeof weight.uncertaintyU95G === 'string'
      && typeof weight.conventionalMass2025G === 'string' && typeof weight.conventionalMass2026G === 'string' ? weight : null;
    return {
      ...item,
      serial: legacyDemo && reference ? reference.serial : item.id === 'demo-device-1' && item.isDemo ? 'FC7267170003' : item.serial,
      isThermohygrometer: item.isThermohygrometer ?? Boolean(reference),
      certificate: item.certificate ?? (reference ? certificateFrom(reference) : null),
      weighingStandard: validWeight,
    };
  });
  if (!directory.seedVersion || directory.seedVersion < 3) {
    for (const demoDevice of demoDirectory.devices) if (!devices.some((item) => item.id === demoDevice.id)) devices.push(demoDevice);
  }
  if (!directory.seedVersion || directory.seedVersion < 4) {
    for (const demoDevice of demoDirectory.devices.filter((item) => item.weighingStandard)) {
      if (!devices.some((item) => item.id === demoDevice.id)) devices.push(demoDevice);
    }
  }
  return {
    customers: directory.customers,
    devices,
    technicians: directory.technicians,
    equipmentMethods: Array.isArray(directory.equipmentMethods)
      ? directory.equipmentMethods.filter((entry): entry is EquipmentMethod => Boolean(entry && typeof entry.instrumentId === 'string' && typeof entry.method === 'string' && instruments.some((instrument) => instrument.id === entry.instrumentId)))
      : [],
    seedVersion: 4,
  };
}

export function AdminDataProvider({ children }: PropsWithChildren) {
  const [directory, setDirectory] = useState<AdminDirectory>(demoDirectory);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [storageError, setStorageError] = useState('');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => { if (value) setDirectory(parseDirectory(JSON.parse(value) as unknown)); })
      .catch(() => {
        setLoadFailed(true);
        setStorageError('Data admin lokal tidak dapat dibaca; penyimpanan dijeda agar data lama tidak tertimpa.');
      })
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || loadFailed) return undefined;
    const timeout = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(directory))
        .then(() => setStorageError(''))
        .catch(() => setStorageError('Data admin tidak tersimpan di perangkat. Pastikan ruang penyimpanan cukup.'));
    }, 300);
    return () => clearTimeout(timeout);
  }, [directory, loaded, loadFailed]);

  const value = useMemo<AdminDataContextValue>(() => ({
    ...directory,
    loaded,
    storageError,
    saveCustomer: (customer) => setDirectory((current) => ({ ...current, customers: upsert(current.customers, customer, 'customer') })),
    deleteCustomer: (id) => setDirectory((current) => ({ ...current, customers: current.customers.filter((item) => item.id !== id) })),
    saveDevice: (device) => setDirectory((current) => ({ ...current, devices: upsert(current.devices, device, 'device') })),
    deleteDevice: (id) => setDirectory((current) => ({ ...current, devices: current.devices.filter((item) => item.id !== id) })),
    saveTechnician: (technician) => setDirectory((current) => ({ ...current, technicians: upsert(current.technicians, technician, 'technician') })),
    deleteTechnician: (id) => setDirectory((current) => ({ ...current, technicians: current.technicians.filter((item) => item.id !== id) })),
    saveEquipmentMethod: (entry) => setDirectory((current) => ({ ...current, equipmentMethods: [...current.equipmentMethods.filter((item) => item.instrumentId !== entry.instrumentId), entry] })),
    deleteEquipmentMethod: (instrumentId) => setDirectory((current) => ({ ...current, equipmentMethods: current.equipmentMethods.filter((item) => item.instrumentId !== instrumentId) })),
  }), [directory, loaded, storageError]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

