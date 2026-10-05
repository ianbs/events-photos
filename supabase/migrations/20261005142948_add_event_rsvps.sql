create table public.event_rsvps (
  event_id uuid not null,
  guest_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  attending boolean not null,
  companions integer not null default 0 check (companions between 0 and 10),
  updated_at timestamptz not null default now(),
  primary key (event_id, guest_id),
  constraint event_rsvps_event_guest_fkey foreign key (event_id, guest_id)
    references public.guests(event_id, id) on delete cascade,
  constraint event_rsvps_declined_companions_check check (attending or companions = 0)
);

create index event_rsvps_event_updated_at_idx
  on public.event_rsvps (event_id, updated_at desc);

alter table public.event_rsvps enable row level security;
alter table public.event_rsvps force row level security;
-- Guest credentials and admin allowlist are checked by the server, as for photos.
revoke all on table public.event_rsvps from anon, authenticated;
grant select, insert, update, delete on table public.event_rsvps to service_role;
