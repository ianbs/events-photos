alter table public.events
  add column primary_color text not null default '#047857',
  add column accent_color text not null default '#10b981',
  add column cover_storage_path text,
  add column logo_storage_path text,
  add constraint events_primary_color_format_check
    check (primary_color ~ '^#[0-9a-f]{6}$'),
  add constraint events_accent_color_format_check
    check (accent_color ~ '^#[0-9a-f]{6}$'),
  add constraint events_cover_storage_path_length_check
    check (
      cover_storage_path is null
      or char_length(btrim(cover_storage_path)) between 1 and 1024
    ),
  add constraint events_logo_storage_path_length_check
    check (
      logo_storage_path is null
      or char_length(btrim(logo_storage_path)) between 1 and 1024
    );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-branding',
  'event-branding',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

comment on column public.events.cover_storage_path is
  'Private Storage path for the optional event cover image.';
comment on column public.events.logo_storage_path is
  'Private Storage path for the optional event logo.';
