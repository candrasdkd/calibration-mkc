import { supabase } from './supabase';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { getConfiguredInstruments, instruments } from './instruments';
import { defaultEnvironmentExpressions } from './methodFormulas';
import type { AdminDirectory, Customer, MeasuringDevice, TechnicianAccountStatus, TechnicianProfile } from './admin-data';
import type { CalibrationRecord, EnvironmentMethodDraft, EnvironmentMethodRevision, InstrumentMethodRevision, VersionedFormulaMethod } from './types';

function client() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  return supabase;
}

function check<T extends { error: unknown }>(result: T) {
  if (result.error) throw result.error;
  return result;
}

export async function loadAdminDirectory() {
  const db = client();
  const [customerResult, contactResult, deviceResult, technicianResult, equipmentResult, revisionResult] = await Promise.all([
    db.from('customers').select('*'),
    db.from('customer_contacts').select('*'),
    db.from('measuring_devices').select('*'),
    db.from('technicians').select('*'),
    db.from('equipment_catalog').select('*'),
    db.from('calibration_method_revisions').select('*').order('instrument_key').order('version'),
  ]);
  check(customerResult); check(contactResult); check(deviceResult); check(technicianResult); check(equipmentResult); check(revisionResult);

  const contacts = new Map<string, Customer['contacts']>();
  const customerIds = new Map<string, string>();
  for (const row of customerResult.data ?? []) customerIds.set(row.id, row.client_id);
  for (const row of contactResult.data ?? []) {
    const localCustomerId = customerIds.get(row.customer_id);
    if (!localCustomerId) continue;
    contacts.set(localCustomerId, [...(contacts.get(localCustomerId) ?? []), { id: row.client_id, name: row.name, phone: row.phone }]);
  }

  const equipment = (equipmentResult.data ?? []).filter((row) => row.is_active);
  const revisions = revisionResult.data ?? [];
  const methodRevisions: InstrumentMethodRevision[] = [];
  const methodDrafts: AdminDirectory['methodDrafts'] = [];
  const environmentMethodRevisions: EnvironmentMethodRevision[] = [];
  let environmentMethod: VersionedFormulaMethod = { version: 1, resolution: 0.1, expressions: { ...defaultEnvironmentExpressions } };
  let environmentDraft: AdminDirectory['environmentDraft'] = null;
  for (const row of revisions) {
    const metadata = { source: row.source ?? '', reason: row.change_reason ?? '', verificationNote: row.verification_note ?? '', verifiedBy: row.verified_by ?? '', effectiveDate: row.effective_date ?? '' };
    const config = row.method_config as Record<string, unknown>;
    if (row.instrument_key === '__environment__') {
      const revision = { ...(config as unknown as Omit<EnvironmentMethodRevision, 'version' | 'updatedAt'>), version: row.version, updatedAt: row.created_at, ...metadata } as EnvironmentMethodRevision;
      if (row.status === 'draft') environmentDraft = {
        ...(config as unknown as Omit<EnvironmentMethodDraft, 'source' | 'reason' | 'verificationNote' | 'verifiedBy' | 'effectiveDate' | 'updatedAt'>),
        updatedAt: row.created_at, ...metadata,
      };
      else {
        environmentMethodRevisions.push(revision);
        if (row.status === 'active') environmentMethod = revision;
      }
      continue;
    }
    const instrument = config as unknown as InstrumentMethodRevision['instrument'];
    if (row.status === 'draft') methodDrafts.push({ instrumentId: row.instrument_key, instrument, updatedAt: row.created_at, ...metadata });
    else methodRevisions.push({ instrumentId: row.instrument_key, instrument, version: row.version, updatedAt: row.created_at, ...metadata });
  }

  const standardMethods = equipment.filter((row) => !row.is_custom).map((row) => ({ instrumentId: row.template_key, method: row.method }));
  const customEquipment = equipment.filter((row) => row.is_custom).map((row) => ({ id: row.client_id, templateId: row.template_key, name: row.name, method: row.method, standardNames: row.standard_names ?? [] }));
  return {
    customers: (customerResult.data ?? []).map((row): Customer => ({
      id: row.client_id, name: row.name, province: row.province, provinceId: row.province_id ?? undefined,
      city: row.city, cityId: row.city_id ?? undefined, district: row.district, districtId: row.district_id ?? undefined,
      village: row.village, villageId: row.village_id ?? undefined, address: row.address,
      contacts: contacts.get(row.client_id) ?? [],
    })),
    devices: (deviceResult.data ?? []).map((row): MeasuringDevice => ({
      id: row.client_id, name: row.name, brand: row.brand, model: row.model, serial: row.serial,
      certificate: row.certificate, isThermohygrometer: row.is_thermohygrometer, weighingStandard: row.weighing_standard,
    })),
    technicians: (technicianResult.data ?? []).map((row): TechnicianProfile => ({
      id: row.client_id, name: row.name, email: row.email ?? '', phone: row.phone,
      userId: row.user_id ?? null,
      accountStatus: row.account_status ?? (row.user_id ? 'active' : 'unlinked'),
    })),
    equipmentMethods: standardMethods,
    customEquipment,
    methodRevisions,
    methodDrafts,
    environmentMethod,
    environmentMethodRevisions,
    environmentDraft,
  } satisfies Partial<AdminDirectory>;
}

async function syncMethodRevisions(directory: AdminDirectory, userId: string) {
  const db = client();
  const { data: rows, error } = await db.from('calibration_method_revisions').select('id,instrument_key,version,status');
  if (error) throw error;
  const existing = new Map<string, { id: string; instrument_key: string; version: number; status: string }>((rows ?? []).map((row) => [`${row.instrument_key}:${row.version}`, row]));
  const publish = async (instrumentKey: string, version: number, methodConfig: unknown, metadata: Record<string, string>) => {
    const key = `${instrumentKey}:${version}`;
    let row = existing.get(key);
    if (row && row.status !== 'draft') return;
    if (!row) {
      const result = await db.from('calibration_method_revisions').insert({
        instrument_key: instrumentKey, version, status: 'draft', method_config: methodConfig,
        source: metadata.source, change_reason: metadata.reason, verification_note: metadata.verificationNote,
        verified_by: metadata.verifiedBy, effective_date: metadata.effectiveDate, created_by: userId,
      }).select('id,instrument_key,version,status').single();
      check(result);
      if (!result.data) throw new Error('Draft metode gagal disimpan ke Supabase.');
      row = result.data;
      existing.set(key, row);
    }
    const result = await db.rpc('publish_method_revision', { p_revision_id: row.id });
    check(result);
    existing.set(key, { ...row, status: 'active' });
  };
  const validMetadata = (entry: Partial<InstrumentMethodRevision | EnvironmentMethodRevision>) => Boolean(
    entry.source?.trim() && entry.reason?.trim() && entry.verificationNote?.trim() && entry.verifiedBy?.trim() && entry.effectiveDate,
  );
  for (const revision of [...directory.methodRevisions].sort((a, b) => a.instrumentId.localeCompare(b.instrumentId) || a.version - b.version)) {
    if (validMetadata(revision)) await publish(revision.instrumentId, revision.version, revision.instrument, revision as unknown as Record<string, string>);
  }
  for (const revision of [...directory.environmentMethodRevisions].sort((a, b) => a.version - b.version)) {
    if (validMetadata(revision)) {
      const { version, updatedAt: _updatedAt, ...methodConfig } = revision;
      await publish('__environment__', version, methodConfig, revision as unknown as Record<string, string>);
    }
  }

  const baselineMetadata = {
    source: 'Konfigurasi metode bawaan aplikasi',
    reason: 'Impor baseline metode yang sudah digunakan aplikasi ke Supabase',
    verificationNote: 'Snapshot konfigurasi yang sudah dipakai aplikasi; sinkronisasi tidak mengubah rumus. Belum diverifikasi ulang melalui panel admin.',
    verifiedBy: 'Impor otomatis aplikasi (belum diverifikasi ulang)',
    effectiveDate: '2026-11-09',
  };
  for (const instrument of getConfiguredInstruments(directory.methodRevisions)) {
    const hasRemoteRevision = [...existing.values()].some((row) => row.instrument_key === instrument.id);
    const hasLocalDraft = directory.methodDrafts.some((draft) => draft.instrumentId === instrument.id);
    if (!hasRemoteRevision && !hasLocalDraft) await publish(instrument.id, instrument.methodVersion ?? 1, instrument, baselineMetadata);
  }
  const hasEnvironmentRevision = [...existing.values()].some((row) => row.instrument_key === '__environment__');
  if (!hasEnvironmentRevision && !directory.environmentDraft) {
    const { version, ...environmentConfig } = directory.environmentMethod;
    await publish('__environment__', version, environmentConfig, baselineMetadata);
  }

  for (const draft of directory.methodDrafts) {
    const version = Math.max(0, ...directory.methodRevisions.filter((item) => item.instrumentId === draft.instrumentId).map((item) => item.version)) + 1;
    const key = `${draft.instrumentId}:${version}`;
    const current = existing.get(key);
    if (!current || current.status === 'draft') {
      const result = await db.from('calibration_method_revisions').upsert({
        ...(current ? { id: current.id } : {}), instrument_key: draft.instrumentId, version, status: 'draft',
        method_config: draft.instrument, source: draft.source, change_reason: draft.reason,
        verification_note: draft.verificationNote, verified_by: draft.verifiedBy, effective_date: draft.effectiveDate,
        created_by: userId,
      }, { onConflict: 'instrument_key,version' });
      check(result);
    }
  }
  if (directory.environmentDraft) {
    const draft = directory.environmentDraft;
    const version = directory.environmentMethod.version + 1;
    const { updatedAt: _updatedAt, ...methodConfig } = draft;
    const key = `__environment__:${version}`;
    const current = existing.get(key);
    if (!current || current.status === 'draft') {
      const result = await db.from('calibration_method_revisions').upsert({
        ...(current ? { id: current.id } : {}), instrument_key: '__environment__', version, status: 'draft',
        method_config: methodConfig, source: draft.source, change_reason: draft.reason,
        verification_note: draft.verificationNote, verified_by: draft.verifiedBy, effective_date: draft.effectiveDate,
        created_by: userId,
      }, { onConflict: 'instrument_key,version' });
      check(result);
    }
  }
}

export async function saveAdminDirectory(directory: AdminDirectory, userId: string) {
  const db = client();
  const customers = directory.customers;
  const devices = directory.devices;
  const technicians = directory.technicians;
  const customerRows = customers.map((item) => ({
    client_id: item.id, name: item.name, province: item.province, province_id: item.provinceId ?? null,
    city: item.city, city_id: item.cityId ?? null, district: item.district, district_id: item.districtId ?? null,
    village: item.village, village_id: item.villageId ?? null, address: item.address, created_by: userId,
  }));
  if (customerRows.length) check(await db.from('customers').upsert(customerRows, { onConflict: 'client_id' }));
  const { data: customerMap, error: customerMapError } = await db.from('customers').select('id,client_id');
  if (customerMapError) throw customerMapError;
  const customerIdByClientId = new Map((customerMap ?? []).map((item) => [item.client_id, item.id]));
  const contactRows = customers.flatMap((customer) => customer.contacts.map((contact) => ({
    client_id: contact.id, customer_id: customerIdByClientId.get(customer.id), name: contact.name, phone: contact.phone,
  })).filter((row) => row.customer_id));
  if (contactRows.length) check(await db.from('customer_contacts').upsert(contactRows, { onConflict: 'client_id' }));
  const { data: currentContacts, error: contactsError } = await db.from('customer_contacts').select('id,client_id');
  if (contactsError) throw contactsError;
  const contactIds = new Set(contactRows.map((row) => row.client_id));
  const staleContacts = (currentContacts ?? []).filter((row) => !contactIds.has(row.client_id)).map((row) => row.id);
  if (staleContacts.length) check(await db.from('customer_contacts').delete().in('id', staleContacts));

  const deviceRows = devices.map((item) => ({
    client_id: item.id, name: item.name, brand: item.brand, model: item.model, serial: item.serial,
    certificate: item.certificate, weighing_standard: item.weighingStandard ?? null, is_thermohygrometer: item.isThermohygrometer, created_by: userId,
  }));
  if (deviceRows.length) check(await db.from('measuring_devices').upsert(deviceRows, { onConflict: 'client_id' }));
  const technicianRows = technicians.map((item) => ({
    client_id: item.id, name: item.name, phone: item.phone, created_by: userId,
  }));
  if (technicianRows.length) check(await db.from('technicians').upsert(technicianRows, { onConflict: 'client_id' }));

  const configuredMethods = new Map(directory.equipmentMethods.map((entry) => [entry.instrumentId, entry.method]));
  const catalogRows = [
    ...instruments.map((instrument) => {
      const method = configuredMethods.get(instrument.id);
      return {
        client_id: instrument.id, name: instrument.name, template_key: instrument.id, method: method ?? '',
        standard_names: instrument.standards.map((standard) => standard[0]), is_custom: false,
        is_active: method !== undefined, created_by: userId,
      };
    }),
    ...directory.customEquipment.map((entry) => ({
      client_id: entry.id, name: entry.name, template_key: entry.templateId, method: entry.method,
      standard_names: entry.standardNames, is_custom: true, is_active: true, created_by: userId,
    })),
  ];
  if (catalogRows.length) check(await db.from('equipment_catalog').upsert(catalogRows, { onConflict: 'client_id' }));
  await syncMethodRevisions(directory, userId);
}

export type AdminSyncTable = 'customers' | 'measuring_devices' | 'technicians' | 'equipment_catalog';

type TechnicianFunctionResult = {
  technician?: TechnicianProfile;
  invitationSent?: boolean;
  accountStatus?: string;
  linkType?: 'invitation' | 'password-reset';
};

async function invokeTechnicianFunction(body: Record<string, unknown>) {
  const result = await client().functions.invoke<TechnicianFunctionResult>('manage-technician', { body });
  if (result.error) {
    const context = (result.error as Error & { context?: unknown }).context;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { error?: unknown } | null;
      if (typeof payload?.error === 'string') throw new Error(payload.error);
      if (context.status === 404) throw new Error('Fungsi undangan teknisi belum tersedia di Supabase.');
    }
    throw result.error;
  }
  if (!result.data) throw new Error('Server tidak mengembalikan respons akun teknisi.');
  return result.data;
}

export async function deleteAdminRow(table: AdminSyncTable, clientId: string) {
  const result = await client().from(table).delete().eq('client_id', clientId);
  check(result);
}

export async function inviteTechnicianAccount(technician: Pick<TechnicianProfile, 'name' | 'email' | 'phone'>, redirectTo: string, existingId?: string, manualOnly?: boolean): Promise<{ technician: TechnicianProfile; invitationSent: boolean }> {
  const result = await invokeTechnicianFunction({ action: 'invite', ...technician, redirectTo, ...(existingId ? { clientId: existingId } : {}), ...(manualOnly ? { manualOnly: true } : {}) });
  const invited = result.technician;
  if (!invited?.id || !['invited', 'active'].includes(invited.accountStatus)) throw new Error('Server tidak mengembalikan data akun teknisi.');
  return { technician: invited, invitationSent: Boolean(result.invitationSent) };
}

export async function updateTechnicianAccountStatus(id: string, status: Extract<TechnicianAccountStatus, 'active' | 'disabled'>) {
  const result = await invokeTechnicianFunction({ action: 'set-status', id, status });
  if (result.accountStatus !== status) throw new Error('Status akun teknisi tidak berhasil diperbarui.');
}

export async function setTechnicianPassword(id: string, password: string) {
  const result = await invokeTechnicianFunction({ action: 'set-password', id, password });
  if (result.accountStatus !== 'active') throw new Error('Kata sandi teknisi tidak berhasil diatur.');
}

export async function sendTechnicianAccessLink(id: string, redirectTo: string): Promise<'invitation' | 'password-reset'> {
  const result = await invokeTechnicianFunction({ action: 'resend', id, redirectTo });
  if (result.linkType !== 'invitation' && result.linkType !== 'password-reset') throw new Error('Tautan akun teknisi tidak berhasil dikirim.');
  return result.linkType;
}

export async function deleteMethodDraft(instrumentKey: string) {
  const result = await client().from('calibration_method_revisions').delete().eq('instrument_key', instrumentKey).eq('status', 'draft');
  check(result);
}

const MAX_CALIBRATION_PHOTO_BYTES = 1024 * 1024;
const MIN_TARGET_CALIBRATION_PHOTO_BYTES = 300 * 1024;
const PHOTO_COMPRESSION_STEPS = [
  { dimension: 1920, quality: 1 },
  { dimension: 1920, quality: 0.92 },
  { dimension: 1920, quality: 0.82 },
  { dimension: 1600, quality: 0.76 },
  { dimension: 1280, quality: 0.68 },
  { dimension: 1024, quality: 0.6 },
  { dimension: 800, quality: 0.52 },
];

async function compressCalibrationPhoto(uri: string) {
  let best: File | null = null;
  for (const step of PHOTO_COMPRESSION_STEPS) {
    const context = ImageManipulator.manipulate(uri, { maxWidth: step.dimension, maxHeight: step.dimension });
    let output: File | null = null;
    try {
      const image = await context.renderAsync();
      try {
        const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: step.quality });
        output = new File(result.uri);
        const size = output.size;
        if (size !== null && size <= MAX_CALIBRATION_PHOTO_BYTES && (!best || size > (best.size ?? 0))) {
          best?.delete();
          best = output;
          output = null;
          if (size >= MIN_TARGET_CALIBRATION_PHOTO_BYTES) return best;
        }
      } finally {
        image.release();
      }
    } finally {
      context.release();
      output?.delete();
    }
  }
  if (best) return best;
  throw new Error('Foto alat tetap lebih dari 1 MB setelah dikompres. Coba ambil ulang foto.');
}

export async function loadCalibrationRecords() {
  const db = client();
  const result = await db.from('calibration_records').select('*').order('updated_at', { ascending: false });
  check(result);
  const records = await Promise.all((result.data ?? []).map(async (row): Promise<CalibrationRecord> => {
    const data = row.payload as CalibrationRecord['data'];
    const paths = data.equipmentPhotoPaths;
    const photos = data.equipmentPhotos;
    if (paths && photos) {
      for (const side of ['front', 'back', 'left', 'right'] as const) {
        const path = paths[side];
        if (!path) continue;
        const signed = await db.storage.from('calibration-photos').createSignedUrl(path, 3600);
        if (!signed.error && signed.data?.signedUrl) photos[side] = signed.data.signedUrl;
      }
    }
    return {
      id: row.id, instrumentId: row.instrument_key, instrumentSnapshot: row.instrument_snapshot,
      createdAt: row.created_at, updatedAt: row.updated_at, data,
    };
  }));
  return records;
}

export async function saveCalibrationRecords(records: CalibrationRecord[], userId: string) {
  const db = client();
  const remote = await db.from('calibration_records').select('id,customer_id,technician_id,created_by,status,updated_at');
  check(remote);
  const remoteById = new Map((remote.data ?? []).map((item) => [item.id, item]));
  const customerMapResult = await db.from('customers').select('id,client_id');
  check(customerMapResult);
  const customerIdByClientId = new Map((customerMapResult.data ?? []).map((item) => [item.client_id, item.id]));
  const technicianResult = await db.from('technicians').select('id,user_id');
  check(technicianResult);
  const technicianId = (technicianResult.data ?? []).find((item) => item.user_id === userId)?.id ?? null;
  for (const record of records) {
    const previous = remoteById.get(record.id);
    const data = { ...record.data, equipmentPhotoPaths: { ...(record.data.equipmentPhotoPaths ?? {}) } };
    const photos = { ...(data.equipmentPhotos ?? { front: '', back: '', left: '', right: '' }) };
    for (const side of ['front', 'back', 'left', 'right'] as const) {
      const uri = photos[side];
      if (!uri || /^https?:\/\//i.test(uri)) continue;
      const path = `${userId}/${record.id}/${side}.jpg`;
      const compressed = await compressCalibrationPhoto(uri);
      try {
        const bytes = await compressed.bytes();
        if (bytes.byteLength > MAX_CALIBRATION_PHOTO_BYTES) throw new Error(`Foto sisi ${side} melebihi batas 1 MB.`);
        const upload = await db.storage.from('calibration-photos').upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
        if (upload.error) throw upload.error;
        data.equipmentPhotoPaths[side] = path;
      } finally {
        compressed.delete();
      }
    }
    data.equipmentPhotos = photos;
    const cloudRow = {
      id: record.id,
      customer_id: customerIdByClientId.get(record.data.identity.customerId) ?? null,
      technician_id: technicianId ?? previous?.technician_id ?? null,
      instrument_key: record.instrumentId,
      instrument_snapshot: record.instrumentSnapshot ?? {},
      payload: data,
      status: previous?.status ?? 'draft',
      updated_at: record.updatedAt,
    };
    if (previous) {
      if (new Date(record.updatedAt).getTime() <= new Date(previous.updated_at).getTime()) continue;
      const update = await db.from('calibration_records').update(cloudRow).eq('id', record.id);
      check(update);
    } else {
      const insert = await db.from('calibration_records').insert({ ...cloudRow, created_by: userId, created_at: record.createdAt });
      check(insert);
    }
  }
}

export async function deleteRemoteCalibrationRecord(id: string) {
  if (!supabase) return;
  const result = await supabase.from('calibration_records').delete().eq('id', id);
  check(result);
}
