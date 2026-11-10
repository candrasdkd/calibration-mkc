alter table public.customers
  add column client_id text not null default gen_random_uuid()::text;
create unique index customers_client_id_key on public.customers (client_id);

alter table public.customer_contacts
  add column client_id text not null default gen_random_uuid()::text;
create unique index customer_contacts_client_id_key on public.customer_contacts (client_id);

alter table public.measuring_devices
  add column client_id text not null default gen_random_uuid()::text,
  add column is_thermohygrometer boolean not null default false;
create unique index measuring_devices_client_id_key on public.measuring_devices (client_id);

alter table public.technicians
  add column client_id text not null default gen_random_uuid()::text;
create unique index technicians_client_id_key on public.technicians (client_id);

alter table public.equipment_catalog
  add column client_id text not null default gen_random_uuid()::text,
  add column is_custom boolean not null default false;
create unique index equipment_catalog_client_id_key on public.equipment_catalog (client_id);
