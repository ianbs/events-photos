alter table public.events
  add column music_storage_path text,
  add constraint events_music_storage_path_check check (
    music_storage_path is null or (
      split_part(music_storage_path, '/', 1) = id::text
      and music_storage_path ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp3$'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-music', 'event-music', false, 15728640, array['audio/mpeg'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No public object policies. Admin-only endpoints issue scoped signed uploads
-- and event pages expose a temporary playback URL for their own audio only.
comment on column public.events.music_storage_path is
  'Private Storage path for optional event background music (MP3).';
