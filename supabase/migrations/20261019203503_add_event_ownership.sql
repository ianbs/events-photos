-- Ownership is enforced at the authorized server boundary. Existing RLS and
-- revoked anon/authenticated grants remain in place (service_role bypasses RLS).
-- Remove a legacy remote-only public listing policy. Guest pages already use
-- validated server-side reads rather than granting direct table access.
drop policy if exists "Public can read active events" on public.events;
revoke all on table public.events from anon, authenticated;

alter table public.events
  add column owner_id uuid references auth.users(id) on delete set null;

create index events_owner_id_event_date_idx
  on public.events (owner_id, event_date desc);

comment on column public.events.owner_id is
  'Creator assigned by the server. NULL (including deleted accounts) grants no administrative access.';

-- Explicit assignment requested by the project owner; never infer a legacy owner.
do $$
declare
  legacy_owner uuid;
begin
  select u.id into legacy_owner
  from auth.users u join public.admin_users a on a.user_id = u.id
  where lower(u.email) = 'ianbarbosasantos@gmail.com'
    and a.role = 'super_admin' and a.is_active;
  -- Fresh local/test databases may not have this production account.
  if legacy_owner is not null then
    update public.events set owner_id = legacy_owner where owner_id is null;
  end if;
end;
$$;

-- Storage cleanup happens outside a transaction. Finalize only after the
-- registered files are gone, under a row lock that also fences FK inserts.
create or replace function public.finish_admin_event_deletion(
  p_actor_id uuid,
  p_event_id uuid,
  p_confirmation text,
  p_check_only boolean default false
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target public.events%rowtype;
begin
  if not exists (select 1 from public.admin_users where user_id = p_actor_id and is_active) then
    raise exception 'Active administrator required' using errcode = '42501';
  end if;

  select * into target from public.events where id = p_event_id for update;
  if not found then return true; end if;
  if target.owner_id is distinct from p_actor_id then
    raise exception 'Event owner required' using errcode = '42501';
  end if;
  if target.name is distinct from p_confirmation then
    raise exception 'Event confirmation mismatch' using errcode = '22023';
  end if;

  if p_check_only then return false; end if;

  if target.is_active
    or target.cover_storage_path is not null
    or target.logo_storage_path is not null
    or target.music_storage_path is not null
    or exists (select 1 from public.photos where event_id = p_event_id)
  then
    return false;
  end if;

  -- Existing FKs atomically cascade guests, RSVP identities, answers and batches.
  delete from public.events where id = p_event_id;
  return true;
end;
$$;

revoke all on function public.finish_admin_event_deletion(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.finish_admin_event_deletion(uuid, uuid, text, boolean)
  to service_role;
