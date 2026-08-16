begin;

create extension if not exists pgtap with schema extensions;

select plan(17);

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

select ok(
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'events'
      and column_name = 'primary_color'
      and is_nullable = 'NO'
  ),
  'events has a required primary color'
);
select ok(
  exists (
    select 1
    from pg_constraint
    where conrelid = 'public.events'::regclass
      and conname = 'events_primary_color_format_check'
  ),
  'event primary colors are constrained'
);
select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'event-branding'
      and not public
      and file_size_limit = 5242880
  ),
  'event branding uses a private size-limited bucket'
);
select is(
  (
    select allowed_mime_types
    from storage.buckets
    where id = 'event-branding'
  ),
  array['image/jpeg', 'image/png', 'image/webp']::text[],
  'event branding bucket restricts image MIME types'
);

select * from finish();
rollback;
