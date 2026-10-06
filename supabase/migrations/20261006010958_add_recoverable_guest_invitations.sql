begin;

alter table public.event_rsvp_identities
  add column phone text check (phone is null or phone ~ '^[1-9][0-9]{7,14}$'),
  add column invitation_code text check (invitation_code is null or invitation_code ~ '^[A-Za-z0-9_-]{43}$'),
  add constraint event_rsvp_code_hash_check check (invitation_code is null or (
    invitation_hash is not null and invitation_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(invitation_code, 'UTF8')), 'hex')
  ));

comment on column public.event_rsvp_identities.invitation_code is
  'Recoverable invitation secret. Admin-only server access; never exposed by public APIs.';

create function public.create_rsvp_guest(
  p_event_id uuid, p_name text, p_code text,
  p_email text default null, p_phone text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_guest_id uuid;
begin
  perform 1 from public.events where id = p_event_id for share;
  if not found then raise exception 'Event missing' using errcode = '22023'; end if;
  insert into public.guests (event_id) values (p_event_id) returning id into new_guest_id;
  insert into public.event_rsvp_identities (event_id, guest_id, name, email, phone, invitation_code, invitation_hash)
    values (p_event_id, new_guest_id, btrim(p_name), nullif(lower(btrim(p_email)), ''), p_phone, p_code,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_code, 'UTF8')), 'hex'));
  return new_guest_id;
end;
$$;
revoke all on function public.create_rsvp_guest(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_rsvp_guest(uuid,text,text,text,text) to service_role;

commit;
