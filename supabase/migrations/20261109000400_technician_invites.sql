alter table public.technicians
  add column email text,
  add column account_status text not null default 'unlinked';

alter table public.technicians
  add constraint technicians_account_status_check
  check (account_status in ('unlinked', 'invited', 'active', 'disabled'));

update public.technicians
set account_status = case when user_id is null then 'unlinked' else 'active' end;

create unique index technicians_email_lower_key
  on public.technicians (lower(email))
  where email is not null;

create function public.is_active_technician()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.technicians technicians
    join public.profiles profiles on profiles.id = technicians.user_id and profiles.role = 'technician'
    where technicians.user_id = (select auth.uid()) and technicians.account_status = 'active'
  );
$$;

revoke all on function public.is_active_technician() from public;
grant execute on function public.is_active_technician() to authenticated;

create or replace function public.activate_technician_after_invite()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.technicians
  set account_status = 'active'
  where user_id = new.id and account_status = 'invited';
  return new;
end;
$$;

revoke all on function public.activate_technician_after_invite() from public;

create trigger on_auth_user_confirmed_activate_technician
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is distinct from new.email_confirmed_at and new.email_confirmed_at is not null)
  execute procedure public.activate_technician_after_invite();

drop policy "technicians_read_customers" on public.customers;
create policy "technicians_read_customers" on public.customers
  for select to authenticated using ((select public.is_active_technician()));

drop policy "technicians_read_customer_contacts" on public.customer_contacts;
create policy "technicians_read_customer_contacts" on public.customer_contacts
  for select to authenticated using ((select public.is_active_technician()));

drop policy "technicians_read_measuring_devices" on public.measuring_devices;
create policy "technicians_read_measuring_devices" on public.measuring_devices
  for select to authenticated using ((select public.is_active_technician()));

drop policy "technicians_read_active_equipment_catalog" on public.equipment_catalog;
create policy "technicians_read_active_equipment_catalog" on public.equipment_catalog
  for select to authenticated using (is_active and (select public.is_active_technician()));

drop policy "authenticated_read_active_methods_admin_reads_all" on public.calibration_method_revisions;
create policy "authenticated_read_active_methods_admin_reads_all" on public.calibration_method_revisions
  for select to authenticated using ((status = 'active' and (select public.is_active_technician())) or (select public.is_admin()));

drop policy "technicians_read_own_calibration_records" on public.calibration_records;
create policy "technicians_read_own_calibration_records" on public.calibration_records
  for select to authenticated using (created_by = (select auth.uid()) and (select public.is_active_technician()));

drop policy "technicians_create_calibration_drafts" on public.calibration_records;
create policy "technicians_create_calibration_drafts" on public.calibration_records
  for insert to authenticated with check (
    created_by = (select auth.uid()) and status = 'draft' and (select public.is_active_technician())
    and (method_revision_id is null or exists (
      select 1 from public.calibration_method_revisions methods
      where methods.id = method_revision_id and methods.status = 'active'
    ))
  );

drop policy "technicians_update_own_open_records" on public.calibration_records;
create policy "technicians_update_own_open_records" on public.calibration_records
  for update to authenticated using (
    created_by = (select auth.uid()) and status in ('draft', 'submitted') and (select public.is_active_technician())
  ) with check (
    created_by = (select auth.uid()) and status in ('draft', 'submitted') and (select public.is_active_technician())
  );

drop policy "technicians_delete_own_drafts" on public.calibration_records;
create policy "technicians_delete_own_drafts" on public.calibration_records
  for delete to authenticated using (
    created_by = (select auth.uid()) and status = 'draft' and (select public.is_active_technician())
  );

drop policy "users_read_owned_calibration_files" on storage.objects;
create policy "users_read_owned_calibration_files" on storage.objects
  for select to authenticated using (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or ((select public.is_active_technician()) and owner_id = (select auth.uid()::text)))
  );

drop policy "users_upload_owned_calibration_files" on storage.objects;
create policy "users_upload_owned_calibration_files" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or ((select public.is_active_technician()) and (storage.foldername(name))[1] = (select auth.uid()::text)))
  );

drop policy "users_update_owned_calibration_files" on storage.objects;
create policy "users_update_owned_calibration_files" on storage.objects
  for update to authenticated using (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or ((select public.is_active_technician()) and owner_id = (select auth.uid()::text)))
  ) with check (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or ((select public.is_active_technician()) and owner_id = (select auth.uid()::text)))
  );

drop policy "users_delete_owned_calibration_files" on storage.objects;
create policy "users_delete_owned_calibration_files" on storage.objects
  for delete to authenticated using (
    bucket_id in ('calibration-photos', 'calibration-documents')
    and ((select public.is_admin()) or ((select public.is_active_technician()) and owner_id = (select auth.uid()::text)))
  );
