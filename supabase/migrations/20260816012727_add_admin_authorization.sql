create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.admin_users force row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

create policy "Administrators can verify their own membership"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

comment on table public.admin_users is
  'Explicit allowlist for Supabase Auth users authorized to access the admin area.';
