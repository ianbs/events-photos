begin;

alter table public.event_rsvp_identities
  add column max_companions integer check (max_companions is null or max_companions >= 0);
comment on column public.event_rsvp_identities.max_companions is
  'Individual companion allowance. Null inherits the event default; zero is an individual invitation.';

alter table public.event_rsvps
  add column companion_names text[] not null default '{}',
  add constraint event_rsvps_companion_names_count_check
    check (cardinality(companion_names) <= companions);

-- Replace the old signature to avoid ambiguous RPC calls with default arguments.
drop function public.create_rsvp_guest(uuid,text,text,text,text);
create function public.create_rsvp_guest(
  p_event_id uuid, p_name text, p_code text,
  p_email text default null, p_phone text default null, p_max_companions integer default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_guest_id uuid;
begin
  perform 1 from public.events where id = p_event_id for share;
  if not found then raise exception 'Event missing' using errcode = '22023'; end if;
  insert into public.guests (event_id) values (p_event_id) returning id into new_guest_id;
  insert into public.event_rsvp_identities (event_id, guest_id, name, email, phone, invitation_code, invitation_hash, max_companions)
    values (p_event_id, new_guest_id, btrim(p_name), nullif(lower(btrim(p_email)), ''), p_phone, p_code,
      pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_code, 'UTF8')), 'hex'), p_max_companions);
  return new_guest_id;
end;
$$;
revoke all on function public.create_rsvp_guest(uuid,text,text,text,text,integer) from public, anon, authenticated;
grant execute on function public.create_rsvp_guest(uuid,text,text,text,text,integer) to service_role;

create or replace function public.check_rsvp_companions_allowed()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  companion_limit integer;
  individual_limit integer;
  companion_name text;
begin
  -- Lock the guest before its identity, matching invitation deletion.
  select coalesce(max_companions, 10) into companion_limit
    from public.events where id = new.event_id for share;
  perform 1 from public.guests where event_id = new.event_id and id = new.guest_id for share;
  select max_companions into individual_limit from public.event_rsvp_identities
    where event_id = new.event_id and guest_id = new.guest_id for share;
  companion_limit := coalesce(individual_limit, companion_limit);
  if new.companions > companion_limit then
    if companion_limit = 0 then
      raise exception 'Este evento não permite acompanhantes.'
        using errcode = '23514', constraint = 'event_rsvps_companions_disabled_check';
    end if;
    raise exception 'Seu convite permite no máximo % acompanhante(s).', companion_limit
      using errcode = '23514', constraint = 'event_rsvps_companion_limit_check';
  end if;
  if new.companion_names is null or coalesce(array_ndims(new.companion_names), 1) <> 1 then
    raise exception 'Lista de acompanhantes inválida.' using errcode = '23514';
  end if;
  foreach companion_name in array new.companion_names loop
    if companion_name is null or char_length(btrim(companion_name)) not between 1 and 200 then
      raise exception 'Nome de acompanhante inválido.' using errcode = '23514';
    end if;
  end loop;
  return new;
end;
$$;

-- Historical responses remain intact when the allowance changes. New saves
-- must respect the latest individual or event limit.
commit;
