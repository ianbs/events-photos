-- Storage cleanup happens outside a transaction. Finalize only after the
-- registered files are gone, under a row lock that also fences FK inserts.
create function public.finish_admin_event_deletion(
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
