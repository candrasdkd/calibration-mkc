alter table public.customers replica identity full;
alter table public.customer_contacts replica identity full;
alter table public.measuring_devices replica identity full;
alter table public.technicians replica identity full;
alter table public.equipment_catalog replica identity full;
alter table public.calibration_method_revisions replica identity full;
alter table public.calibration_records replica identity full;

alter publication supabase_realtime add table
  public.customers,
  public.customer_contacts,
  public.measuring_devices,
  public.technicians,
  public.equipment_catalog,
  public.calibration_method_revisions,
  public.calibration_records;
