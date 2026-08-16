begin;

create extension if not exists pgtap with schema extensions;

select plan(13);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.events'::regclass),
  'events has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.guests'::regclass),
  'guests has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.photos'::regclass),
  'photos has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.admin_users'::regclass),
  'admin_users has RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where oid = 'public.admin_users'::regclass),
  'admin_users forces RLS'
);
select ok(
  not has_table_privilege('anon', 'public.guests', 'select'),
  'anonymous users cannot list guests'
);
select ok(
  not has_table_privilege('anon', 'public.photos', 'select'),
  'anonymous users cannot list photos'
);
select ok(
  not has_table_privilege('authenticated', 'public.photos', 'select'),
  'authenticated users cannot bypass the admin server boundary'
);
select ok(
  not has_table_privilege('anon', 'public.admin_users', 'select'),
  'anonymous users cannot inspect the admin allowlist'
);
select ok(
  has_table_privilege('authenticated', 'public.admin_users', 'select'),
  'authenticated users can evaluate their own allowlist membership'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'admin_users'),
  1,
  'admin_users has exactly one scoped policy'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename in ('guests', 'photos')),
  0,
  'guest and photo tables expose no direct Data API policies'
);
select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'photos'
      and indexname = 'photos_event_id_guest_id_idx'
  ),
  'the composite guest foreign key has a covering index'
);

select * from finish();
rollback;
