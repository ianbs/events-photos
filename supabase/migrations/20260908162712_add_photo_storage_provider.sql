alter table public.photos
  add column storage_provider text not null default 'supabase';

alter table public.photos
  add constraint photos_storage_provider_check
  check (storage_provider in ('supabase', 's3')) not valid;

alter table public.photos
  validate constraint photos_storage_provider_check;
