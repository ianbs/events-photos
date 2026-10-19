alter table public.admin_users
  add column role text not null default 'admin'
    constraint admin_users_role_check check (role in ('admin', 'super_admin')),
  add column is_active boolean not null default true;

-- The existing self-only SELECT policy remains. Browsers cannot write memberships.
-- This RPC is callable only by the privileged server, after session validation.
create function public.manage_admin_access(
  p_actor_id uuid,
  p_user_id uuid,
  p_role text,
  p_is_active boolean
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Serialize access changes, including actor revalidation. Two superadmins
  -- cannot concurrently disable each other and leave the system without access.
  lock table public.admin_users in share row exclusive mode;

  if not exists (
    select 1 from public.admin_users
    where user_id = p_actor_id and role = 'super_admin' and is_active
  ) then
    raise exception 'Active superadministrator required' using errcode = '42501';
  end if;

  if p_actor_id = p_user_id then
    raise exception 'Cannot change own access' using errcode = '22023';
  end if;

  if p_role is null or p_role not in ('admin', 'super_admin') or p_is_active is null then
    raise exception 'Invalid access settings' using errcode = '22023';
  end if;

  insert into public.admin_users (user_id, role, is_active)
  values (p_user_id, p_role, p_is_active)
  on conflict (user_id) do update
    set role = excluded.role, is_active = excluded.is_active;
end;
$$;

revoke all on function public.manage_admin_access(uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.manage_admin_access(uuid, uuid, text, boolean)
  to service_role;
