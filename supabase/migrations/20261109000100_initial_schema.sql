create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  role text not null default 'technician' check (role in ('admin', 'technician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  province text not null default '',
  province_id text,
  city text not null default '',
  city_id text,
  district text not null default '',
  district_id text,
  village text not null default '',
  village_id text,
  address text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

create table public.measuring_devices (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null default '',
  model text not null default '',
  serial text not null,
  certificate jsonb,
  weighing_standard jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, serial)
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete set null,
  name text not null,
  phone text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  template_key text not null,
  method text not null,
  standard_names text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calibration_method_revisions (
  id uuid primary key default gen_random_uuid(),
  instrument_key text not null,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'superseded')),
  method_config jsonb not null,
  source text,
  change_reason text,
  verification_note text,
  verified_by text,
  effective_date date,
  created_by uuid not null references auth.users(id),
  published_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (instrument_key, version)
);

create unique index one_active_method_per_instrument
  on public.calibration_method_revisions (instrument_key)
  where status = 'active';

create table public.calibration_records (
  id text primary key,
  customer_id uuid references public.customers(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,
  instrument_key text not null,
  method_revision_id uuid references public.calibration_method_revisions(id) on delete restrict,
  instrument_snapshot jsonb not null,
  payload jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'reviewed', 'issued')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index calibration_records_customer_created_at_idx
  on public.calibration_records (customer_id, created_at desc);
create index calibration_records_created_by_status_idx
  on public.calibration_records (created_by, status, updated_at desc);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create trigger customers_set_updated_at before update on public.customers
  for each row execute procedure public.set_updated_at();
create trigger measuring_devices_set_updated_at before update on public.measuring_devices
  for each row execute procedure public.set_updated_at();
create trigger technicians_set_updated_at before update on public.technicians
  for each row execute procedure public.set_updated_at();
create trigger equipment_catalog_set_updated_at before update on public.equipment_catalog
  for each row execute procedure public.set_updated_at();
create trigger calibration_records_set_updated_at before update on public.calibration_records
  for each row execute procedure public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();

create function public.publish_method_revision(p_revision_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target public.calibration_method_revisions%rowtype;
begin
  if not (select public.is_admin()) then
    raise exception 'Hanya admin yang boleh mengaktifkan metode.' using errcode = '42501';
  end if;

  select * into target
  from public.calibration_method_revisions
  where id = p_revision_id
  for update;

  if not found or target.status <> 'draft' then
    raise exception 'Draft metode tidak ditemukan atau sudah aktif.' using errcode = '22023';
  end if;

  if nullif(btrim(target.source), '') is null
    or nullif(btrim(target.change_reason), '') is null
    or nullif(btrim(target.verification_note), '') is null
    or nullif(btrim(target.verified_by), '') is null
    or target.effective_date is null then
    raise exception 'Sumber, alasan, verifikasi, pemeriksa, dan tanggal berlaku wajib diisi.' using errcode = '22023';
  end if;

  update public.calibration_method_revisions
  set status = 'superseded'
  where instrument_key = target.instrument_key and status = 'active';

  update public.calibration_method_revisions
  set status = 'active', published_by = (select auth.uid()), published_at = now()
  where id = p_revision_id;

  insert into public.audit_events (actor_id, entity_type, entity_id, action, details)
  values ((select auth.uid()), 'calibration_method', p_revision_id::text, 'published',
    jsonb_build_object('instrument_key', target.instrument_key, 'version', target.version, 'source', target.source));

  return p_revision_id;
end;
$$;

create function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_role text;
begin
  if not (select public.is_admin()) then
    raise exception 'Hanya admin yang boleh mengubah role.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'technician') then
    raise exception 'Role tidak valid.' using errcode = '22023';
  end if;

  perform id from public.profiles where role = 'admin' order by id for update;
  select role into previous_role from public.profiles where id = p_user_id for update;
  if previous_role is null then
    raise exception 'Profil pengguna tidak ditemukan.' using errcode = '22023';
  end if;
  if previous_role = 'admin' and p_role <> 'admin'
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Minimal harus ada satu admin.' using errcode = '22023';
  end if;

  update public.profiles set role = p_role where id = p_user_id;
  insert into public.audit_events (actor_id, entity_type, entity_id, action, details)
  values ((select auth.uid()), 'profile', p_user_id::text, 'role_changed', jsonb_build_object('from', previous_role, 'to', p_role));
end;
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.measuring_devices enable row level security;
alter table public.technicians enable row level security;
alter table public.equipment_catalog enable row level security;
alter table public.calibration_method_revisions enable row level security;
alter table public.calibration_records enable row level security;
alter table public.audit_events enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.customers, public.customer_contacts,
  public.measuring_devices, public.technicians, public.equipment_catalog,
  public.calibration_method_revisions, public.calibration_records to authenticated;
grant select on public.audit_events to authenticated;

revoke all on function public.is_admin() from public;
revoke all on function public.publish_method_revision(uuid) from public;
revoke all on function public.set_user_role(uuid, text) from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.publish_method_revision(uuid) to authenticated;
grant execute on function public.set_user_role(uuid, text) to authenticated;

create policy "profiles_read_self_or_admin" on public.profiles
  for select to authenticated using (id = (select auth.uid()) or (select public.is_admin()));

create policy "admins_manage_customers" on public.customers
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "technicians_read_customers" on public.customers
  for select to authenticated using ((select auth.uid()) is not null);

create policy "admins_manage_customer_contacts" on public.customer_contacts
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "technicians_read_customer_contacts" on public.customer_contacts
  for select to authenticated using ((select auth.uid()) is not null);

create policy "admins_manage_measuring_devices" on public.measuring_devices
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "technicians_read_measuring_devices" on public.measuring_devices
  for select to authenticated using ((select auth.uid()) is not null);

create policy "admins_manage_technicians" on public.technicians
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "technicians_read_own_profile" on public.technicians
  for select to authenticated using (user_id = (select auth.uid()));

create policy "admins_manage_equipment_catalog" on public.equipment_catalog
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "technicians_read_active_equipment_catalog" on public.equipment_catalog
  for select to authenticated using (is_active);

create policy "authenticated_read_active_methods_admin_reads_all" on public.calibration_method_revisions
  for select to authenticated using (status = 'active' or (select public.is_admin()));
create policy "admins_create_method_drafts" on public.calibration_method_revisions
  for insert to authenticated with check ((select public.is_admin()) and status = 'draft' and created_by = (select auth.uid()));
create policy "admins_update_method_drafts" on public.calibration_method_revisions
  for update to authenticated using ((select public.is_admin()) and status = 'draft')
  with check ((select public.is_admin()) and status = 'draft');
create policy "admins_delete_method_drafts" on public.calibration_method_revisions
  for delete to authenticated using ((select public.is_admin()) and status = 'draft');

create policy "admins_manage_calibration_records" on public.calibration_records
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "technicians_read_own_calibration_records" on public.calibration_records
  for select to authenticated using (created_by = (select auth.uid()));
create policy "technicians_create_calibration_drafts" on public.calibration_records
  for insert to authenticated with check (
    created_by = (select auth.uid()) and status = 'draft'
    and (method_revision_id is null or exists (
      select 1 from public.calibration_method_revisions methods
      where methods.id = method_revision_id and methods.status = 'active'
    ))
  );
create policy "technicians_update_own_open_records" on public.calibration_records
  for update to authenticated using (created_by = (select auth.uid()) and status in ('draft', 'submitted'))
  with check (created_by = (select auth.uid()) and status in ('draft', 'submitted'));
create policy "technicians_delete_own_drafts" on public.calibration_records
  for delete to authenticated using (created_by = (select auth.uid()) and status = 'draft');

create policy "admins_read_audit_events" on public.audit_events
  for select to authenticated using ((select public.is_admin()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('calibration-photos', 'calibration-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic']),
  ('calibration-documents', 'calibration-documents', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "users_read_owned_calibration_files" on storage.objects
  for select to authenticated using (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or owner_id = (select auth.uid()::text))
  );
create policy "users_upload_owned_calibration_files" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or (storage.foldername(name))[1] = (select auth.uid()::text))
  );
create policy "users_update_owned_calibration_files" on storage.objects
  for update to authenticated using (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or owner_id = (select auth.uid()::text))
  ) with check (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or owner_id = (select auth.uid()::text))
  );
create policy "users_delete_owned_calibration_files" on storage.objects
  for delete to authenticated using (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or owner_id = (select auth.uid()::text))
  );
