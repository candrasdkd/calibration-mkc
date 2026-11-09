import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { instruments, thermohygrometers } from './instruments';
import { adultScaleStandardWeights } from './weighingScales';
import type { CustomEquipment, Thermohygrometer } from './types';

export interface ContactPerson { id: string; name: string; phone: string }
export interface Customer { id: string; name: string; province: string; provinceId?: string; city: string; cityId?: string; district: string; districtId?: string; village: string; villageId?: string; address: string; contacts: ContactPerson[]; isDemo: boolean }
export interface CorrectionPoint { value: string; correction: string }
export interface ThermohygrometerCertificate { temperature: CorrectionPoint[]; humidity: CorrectionPoint[]; temperatureU95: string; humidityU95: string }
export interface WeighingStandardCalibration { nominalKg: string; uncertaintyU95G: string; conventionalMass2025G: string; conventionalMass2026G: string }
export interface MeasuringDevice { id: string; name: string; brand: string; model: string; serial: string; isThermohygrometer: boolean; certificate: ThermohygrometerCertificate | null; weighingStandard?: WeighingStandardCalibration | null; isDemo: boolean }
export interface TechnicianProfile { id: string; name: string; phone: string; isDemo: boolean }
export interface EquipmentMethod { instrumentId: string; method: string }
type AdminDirectory = { customers: Customer[]; devices: MeasuringDevice[]; technicians: TechnicianProfile[]; equipmentMethods: EquipmentMethod[]; customEquipment: CustomEquipment[]; seedVersion: number };

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
    { id: 'demo-device-dpm-analog', name: 'Digital Pressure Meter', brand: 'Gossen Metrawatt', model: 'Seculife DP Pro', serial: '732129100NNS081037', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-dpm-digital', name: 'Digital Pressure Meter', brand: 'Gossen Metrawatt', model: 'Seculife DP Pro', serial: '732129100NNS081012', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-2', name: 'Thermohygrometer', brand: 'Elitech', model: 'GSP-6', serial: thermohygrometers[0].serial, isThermohygrometer: true, certificate: certificateFrom(thermohygrometers[0]), isDemo: true },
    ...thermohygrometers.slice(1).map((reference, index): MeasuringDevice => ({ id: `demo-device-thermo-${index + 2}`, name: 'Thermohygrometer', brand: 'Elitech', model: 'GSP-6', serial: reference.serial, isThermohygrometer: true, certificate: certificateFrom(reference), isDemo: true })),
    { id: 'demo-device-5', name: 'Vital Sign Simulator', brand: 'Gossen Metrawatt', model: 'Seculife BP Pro', serial: '735AE9911141', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-6', name: 'Gas Flow Analyzer', brand: 'IMT Medical', model: 'PF-300', serial: '2012BA104380', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-ida', name: 'Infusion Device Analyzer', brand: 'Gossen Metrawatt', model: 'Seculife IF Pro', serial: '73199911066', isThermohygrometer: false, certificate: null, isDemo: true },
    ...adultScaleStandardWeights.map((weight, index): MeasuringDevice => ({
      id: `demo-scale-weight-${index + 1}`, name: weight.name, brand: weight.brand, model: weight.model, serial: weight.serial,
      isThermohygrometer: false, certificate: null, weighingStandard: {
        nominalKg: String(weight.nominalKg), uncertaintyU95G: String(weight.uncertaintyU95G),
        conventionalMass2025G: String(weight.conventionalMass2025G), conventionalMass2026G: String(weight.conventionalMass2026G),
      }, isDemo: true,
    })),
    { id: 'demo-device-extra-defib', name: 'Defibrillator Analyzer', brand: 'Gossen Metrawatt', model: 'TC-920', serial: '73969912072', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-thermometer', name: 'Thermometer', brand: 'Lutron', model: 'TC-920', serial: 'I.479807', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-thermometer-digital', name: 'Thermometer Digital', brand: 'Lutron', model: 'TC-920', serial: 'I.479807', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-incubator', name: 'Incubator Analyzer', brand: 'Fluke', model: 'Incu 1', serial: '6050763', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-vital-sign', name: 'Vital Sign Simulator', brand: 'Fluke', model: 'Prosim 4 Vital Sign Simulator', serial: '3904012', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-spo2', name: 'SpO₂ Simulator', brand: 'Fluke', model: 'Prosim SPOT Light SpO₂', serial: '3904012', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-vapor-sevo', name: 'Vaporizer Analyzer Sevoflurane', brand: 'HEYER', model: 'VP 300', serial: 'VP300ES1XYZR00221', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-vapor-iso', name: 'Vaporizer Analyzer Isoflurane', brand: 'HEYER', model: 'VP 300', serial: 'VP300EI1XYZR00255', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-particle', name: 'Particle Counter', brand: 'Extech Instrument', model: 'VPC 300', serial: '170526242', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-light', name: 'Light Meter', brand: 'Lutron', model: 'LM-8010', serial: 'AL.89713', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-sound', name: 'Sound Level Meter', brand: 'Krisbow', model: '-', serial: '-', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-anemometer', name: 'Anemometer', brand: 'Krisbow', model: 'KW06-053', serial: '-', isThermohygrometer: false, certificate: null, isDemo: true },
    { id: 'demo-device-extra-uv', name: 'UV Radiometer', brand: 'Lutron', model: 'UV-340A', serial: 'EFG19BE02496', isThermohygrometer: false, certificate: null, isDemo: true },
  ],
  technicians: [
    { id: 'demo-technician-1', name: 'Dina Teknisi Demo', phone: '0812-0000-0011', isDemo: true },
    { id: 'demo-technician-2', name: 'Rafi Teknisi Demo', phone: '0812-0000-0012', isDemo: true },
  ],
  equipmentMethods: [],
  customEquipment: [],
  seedVersion: 7,
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
  saveCustomEquipment: (entry: CustomEquipment) => void;
  deleteCustomEquipment: (id: string) => void;
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
  if (!directory.seedVersion || directory.seedVersion < 5) {
    for (const demoDevice of demoDirectory.devices.filter((item) => item.id.startsWith('demo-device-dpm-'))) {
      if (!devices.some((item) => item.id === demoDevice.id || item.serial === demoDevice.serial)) devices.push(demoDevice);
    }
  }
  if (!directory.seedVersion || directory.seedVersion < 6) {
    for (const demoDevice of demoDirectory.devices.filter((item) => item.id === 'demo-device-ida')) {
      if (!devices.some((item) => item.id === demoDevice.id || item.serial === demoDevice.serial)) devices.push(demoDevice);
    }
  }
  if (!directory.seedVersion || directory.seedVersion < 7) {
    for (const demoDevice of demoDirectory.devices.filter((item) => item.id.startsWith('demo-device-extra-'))) {
      const exists = devices.some((item) => item.id === demoDevice.id
        || item.name.trim().toLowerCase() === demoDevice.name.toLowerCase() && item.serial === demoDevice.serial);
      if (!exists) devices.push(demoDevice);
    }
  }
  return {
    customers: directory.customers,
    devices,
    technicians: directory.technicians,
    equipmentMethods: Array.isArray(directory.equipmentMethods)
      ? directory.equipmentMethods.filter((entry): entry is EquipmentMethod => Boolean(entry && typeof entry.instrumentId === 'string' && typeof entry.method === 'string' && instruments.some((instrument) => instrument.id === entry.instrumentId)))
      : [],
    customEquipment: Array.isArray(directory.customEquipment)
      ? directory.customEquipment.filter((entry): entry is CustomEquipment => Boolean(entry && typeof entry.id === 'string' && entry.id && typeof entry.templateId === 'string' && instruments.some((instrument) => instrument.id === entry.templateId) && typeof entry.name === 'string' && entry.name.trim() && typeof entry.method === 'string' && entry.method.trim() && Array.isArray(entry.standardNames) && entry.standardNames.every((name) => typeof name === 'string')))
      : [],
    seedVersion: 7,
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
    saveCustomEquipment: (entry) => setDirectory((current) => ({ ...current, customEquipment: [...current.customEquipment.filter((item) => item.id !== entry.id), entry] })),
    deleteCustomEquipment: (id) => setDirectory((current) => ({ ...current, customEquipment: current.customEquipment.filter((item) => item.id !== id) })),
  }), [directory, loaded, storageError]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

