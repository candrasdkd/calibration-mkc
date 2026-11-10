create or replace function public.generate_document_number(p_kind text, p_reference_id text, p_document_date date)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  config public.document_number_settings%rowtype;
  next_sequence integer;
  period_key text;
  roman_month text[] := array['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
  generated_number text;
  existing_number text;
begin
  if p_kind is null or p_kind not in ('order', 'certificate') or nullif(btrim(p_reference_id), '') is null or p_document_date is null then
    raise exception 'Jenis, referensi, dan tanggal dokumen wajib diisi.' using errcode = '22023';
  end if;
  if p_kind = 'certificate' and not (select public.is_admin()) then
    raise exception 'Nomor sertifikat hanya dapat dibuat oleh admin.' using errcode = '42501';
  end if;
  if p_kind = 'order' and not ((select public.is_admin()) or (select public.is_active_technician())) then
    raise exception 'Nomor order hanya dapat dibuat oleh admin atau teknisi aktif.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_kind || ':' || p_reference_id, 0));
  select document_number into existing_number
  from public.document_number_assignments
  where kind = p_kind and reference_id = p_reference_id;
  if found then return existing_number; end if;

  select * into config from public.document_number_settings where setting_key = 'default' for share;
  if not found then raise exception 'Pengaturan nomor dokumen belum tersedia.' using errcode = '22023'; end if;

  period_key := to_char(p_document_date, 'YYYY-MM');
  loop
    insert into public.document_number_sequences (kind, period, last_sequence)
    values (p_kind, period_key, 1)
    on conflict (kind, period) do update
      set last_sequence = public.document_number_sequences.last_sequence + 1
    returning last_sequence into next_sequence;

    generated_number := lpad(next_sequence::text, 3, '0') || '/' || config.company_code || '/'
      || case when p_kind = 'order' then config.order_code else config.certificate_code end
      || '/' || roman_month[extract(month from p_document_date)::integer] || '/' || extract(year from p_document_date)::integer::text;

    perform pg_advisory_xact_lock(hashtextextended('document-number:' || generated_number, 0));
    exit when not exists (
      select 1 from public.document_number_assignments where document_number = generated_number
    );
  end loop;

  insert into public.document_number_assignments (kind, reference_id, document_number, created_by)
  values (p_kind, p_reference_id, generated_number, auth.uid());

  insert into public.audit_events (actor_id, entity_type, entity_id, action, details)
  values (auth.uid(), 'document_number', p_reference_id, 'assigned', jsonb_build_object('kind', p_kind, 'number', generated_number));
  return generated_number;
end;
$$;

revoke all on function public.generate_document_number(text, text, date) from public;
grant execute on function public.generate_document_number(text, text, date) to authenticated;
