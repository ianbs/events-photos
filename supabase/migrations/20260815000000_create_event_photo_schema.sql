create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  slug text not null unique check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 1 and 100
  ),
  event_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  constraint guests_event_id_guest_token_key unique (event_id, guest_token),
  constraint guests_event_id_id_key unique (event_id, id)
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null,
  storage_path text not null unique check (char_length(btrim(storage_path)) between 1 and 1024),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  mime_type text not null check (mime_type ~ '^image/[a-z0-9.+-]+$'),
  file_size bigint not null check (file_size > 0),
  created_at timestamptz not null default now(),
  constraint photos_event_guest_fkey
    foreign key (event_id, guest_id)
    references public.guests(event_id, id)
    on delete cascade
);

create index events_active_event_date_idx
  on public.events (event_date desc)
  where is_active;

create index guests_event_id_created_at_idx
  on public.guests (event_id, created_at desc);

create index photos_event_id_created_at_idx
  on public.photos (event_id, created_at desc);

create index photos_guest_id_created_at_idx
  on public.photos (guest_id, created_at desc);

alter table public.events enable row level security;
alter table public.events force row level security;
alter table public.guests enable row level security;
alter table public.guests force row level security;
alter table public.photos enable row level security;
alter table public.photos force row level security;

-- Deliberately no public policies: all MVP data access will cross a validated,
-- authorized server-side boundary. Policies can be added per use case later.
revoke all on table public.events from anon, authenticated;
revoke all on table public.guests from anon, authenticated;
revoke all on table public.photos from anon, authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'event-photos',
  'event-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No storage.objects policies are created at this stage. The private bucket is
-- accessible only through trusted server-side operations until upload use cases
-- define their own authorization rules.
