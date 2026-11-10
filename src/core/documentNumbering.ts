import { supabase } from './supabase';

export type DocumentNumberKind = 'order' | 'certificate';
export type DocumentNumberSettings = { companyCode: string; orderCode: string; certificateCode: string };

const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export const defaultDocumentNumberSettings: DocumentNumberSettings = { companyCode: 'MKC', orderCode: 'FOC', certificateCode: 'SK' };

function client() {
  if (!supabase) throw new Error('Supabase belum dikonfigurasi.');
  return supabase;
}

export function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function previewDocumentNumber(settings: DocumentNumberSettings, kind: DocumentNumberKind, date = localDateString()) {
  const [year, month] = date.split('-').map(Number);
  const code = kind === 'order' ? settings.orderCode : settings.certificateCode;
  return `001/${settings.companyCode || 'MKC'}/${code || (kind === 'order' ? 'FOC' : 'SK')}/${romanMonths[month - 1] ?? romanMonths[0]}/${year || new Date().getFullYear()}`;
}

export async function loadDocumentNumberSettings(): Promise<DocumentNumberSettings> {
  const { data, error } = await client().from('document_number_settings').select('company_code,order_code,certificate_code').eq('setting_key', 'default').single();
  if (error) throw error;
  return { companyCode: data.company_code, orderCode: data.order_code, certificateCode: data.certificate_code };
}

export async function saveDocumentNumberSettings(settings: DocumentNumberSettings) {
  const normalized = Object.fromEntries(Object.entries(settings).map(([key, value]) => [key, value.trim().toUpperCase()])) as DocumentNumberSettings;
  if (Object.values(normalized).some((value) => !/^[A-Z0-9-]+$/.test(value))) throw new Error('Gunakan huruf, angka, atau tanda hubung pada kode dokumen.');
  const db = client();
  const { data: { user }, error: userError } = await db.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('Sesi admin tidak ditemukan. Login ulang lalu coba lagi.');
  const { error } = await db.from('document_number_settings').upsert({
    setting_key: 'default', company_code: normalized.companyCode, order_code: normalized.orderCode,
    certificate_code: normalized.certificateCode, updated_by: user.id,
  }, { onConflict: 'setting_key' });
  if (error) throw error;
  return normalized;
}

export async function reserveDocumentNumber(kind: DocumentNumberKind, referenceId: string, date: string) {
  const { data, error } = await client().rpc('generate_document_number', {
    p_kind: kind, p_reference_id: referenceId, p_document_date: date,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('Server tidak mengembalikan nomor dokumen.');
  return data;
}
