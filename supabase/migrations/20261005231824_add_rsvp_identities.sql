create table public.event_rsvp_identities (
  event_id uuid not null references public.events(id) on delete cascade,
  guest_id uuid not null,
  name text not null default '' check (char_length(name) <= 200),
  email text check (email is null or (
    email = lower(btrim(email)) and char_length(email) between 3 and 254
  )),
  invitation_hash text check (invitation_hash is null or invitation_hash ~ '^[a-f0-9]{64}$'),
  invitation_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (event_id, guest_id),
  unique (event_id, email),
  unique (event_id, invitation_hash),
  foreign key (event_id, guest_id) references public.guests(event_id, id) on delete cascade,
  check (email is not null or invitation_hash is not null)
);

alter table public.event_rsvp_identities enable row level security;
alter table public.event_rsvp_identities force row level security;
revoke all on public.event_rsvp_identities from anon, authenticated;
grant select, insert, update, delete on public.event_rsvp_identities to service_role;
grant select, insert on public.guests to service_role;
grant select on public.events to service_role;

-- Only the trusted server supplies a verified email or an admin-issued hash.
-- Serialize email recovery and invitation creation so both methods share one RSVP,
-- including when requests from different devices arrive simultaneously.
create function public.ensure_rsvp_identity(
  p_event_id uuid,
  p_email text default null,
  p_name text default '',
  p_invitation_hash text default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  identity_guest_id uuid;
  normalized_email text := nullif(lower(btrim(p_email)), '');
begin
  if normalized_email is null and p_invitation_hash is null then
    raise exception 'Identity required' using errcode = '22023';
  end if;
  perform 1 from public.events where id = p_event_id and is_active for share;
  if not found then
    raise exception 'Event inactive or missing' using errcode = '22023';
  end if;
  if normalized_email is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_event_id::text || ':' || normalized_email, 0)
    );
    select guest_id into identity_guest_id from public.event_rsvp_identities
      where event_id = p_event_id and email = normalized_email;
  end if;
  if identity_guest_id is not null then
    if p_invitation_hash is not null then
      update public.event_rsvp_identities
        set invitation_hash = p_invitation_hash, invitation_revoked_at = null, name = btrim(p_name)
        where event_id = p_event_id and guest_id = identity_guest_id;
    end if;
    return identity_guest_id;
  end if;
  insert into public.guests (event_id) values (p_event_id) returning id into identity_guest_id;
  insert into public.event_rsvp_identities (event_id, guest_id, email, name, invitation_hash)
    values (p_event_id, identity_guest_id, normalized_email, btrim(p_name), p_invitation_hash);
  return identity_guest_id;
end;
$$;
revoke all on function public.ensure_rsvp_identity(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_rsvp_identity(uuid, text, text, text) to service_role;

-- Canonical RSVP guests are identities, not additional photo-upload devices.
create or replace view public.event_admin_summaries
with (security_invoker = true, security_barrier = true) as
select event.id as event_id,
  count(photo.id)::bigint as photo_count,
  count(distinct guest.id) filter (where identity.guest_id is null)::bigint as guest_count,
  coalesce(sum(photo.file_size), 0)::bigint as storage_bytes,
  max(photo.created_at) as last_photo_at
from public.events as event
left join public.guests as guest on guest.event_id = event.id
left join public.event_rsvp_identities as identity
  on identity.event_id = guest.event_id and identity.guest_id = guest.id
left join public.photos as photo on photo.event_id = event.id and photo.guest_id = guest.id
group by event.id;
