create table public.document_number_settings (
  setting_key text primary key default 'default' check (setting_key = 'default'),
  company_code text not null default 'MKC' check (company_code ~ '^[A-Za-z0-9-]+$'),
  order_code text not null default 'FOC' check (order_code ~ '^[A-Za-z0-9-]+$'),
  certificate_code text not null default 'SK' check (certificate_code ~ '^[A-Za-z0-9-]+$'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.document_number_settings (setting_key) values ('default') on conflict do nothing;

create trigger document_number_settings_set_updated_at
  before update on public.document_number_settings
  for each row execute procedure public.set_updated_at();

alter table public.document_number_settings enable row level security;
grant select, insert, update, delete on public.document_number_settings to authenticated;
create policy "admins_manage_document_number_settings" on public.document_number_settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create table public.document_number_sequences (
  kind text not null check (kind in ('order', 'certificate')),
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  last_sequence integer not null check (last_sequence > 0),
  primary key (kind, period)
);

create table public.document_number_assignments (
  kind text not null check (kind in ('order', 'certificate')),
  reference_id text not null,
  document_number text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (kind, reference_id),
  unique (document_number)
);

alter table public.document_number_sequences enable row level security;
alter table public.document_number_assignments enable row level security;
revoke all on public.document_number_sequences, public.document_number_assignments from anon, authenticated;

create function public.generate_document_number(p_kind text, p_reference_id text, p_document_date date)
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
  if p_kind not in ('order', 'certificate') or nullif(btrim(p_reference_id), '') is null or p_document_date is null then
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
  insert into public.document_number_sequences (kind, period, last_sequence)
  values (p_kind, period_key, 1)
  on conflict (kind, period) do update
    set last_sequence = public.document_number_sequences.last_sequence + 1
  returning last_sequence into next_sequence;

  generated_number := lpad(next_sequence::text, 3, '0') || '/' || config.company_code || '/'
    || case when p_kind = 'order' then config.order_code else config.certificate_code end
    || '/' || roman_month[extract(month from p_document_date)::integer] || '/' || extract(year from p_document_date)::integer::text;

  insert into public.document_number_assignments (kind, reference_id, document_number, created_by)
  values (p_kind, p_reference_id, generated_number, auth.uid());

  insert into public.audit_events (actor_id, entity_type, entity_id, action, details)
  values (auth.uid(), 'document_number', p_reference_id, 'assigned', jsonb_build_object('kind', p_kind, 'number', generated_number));
  return generated_number;
end;
$$;

revoke all on function public.generate_document_number(text, text, date) from public;
grant execute on function public.generate_document_number(text, text, date) to authenticated;
