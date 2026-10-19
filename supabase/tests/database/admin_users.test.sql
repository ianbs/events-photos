begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'super-one@example.invalid'),
  ('a1000000-0000-4000-8000-000000000002', 'super-two@example.invalid'),
  ('a1000000-0000-4000-8000-000000000003', 'admin-test@example.invalid');
insert into public.admin_users (user_id, role) values
  ('a1000000-0000-4000-8000-000000000001', 'super_admin'),
  ('a1000000-0000-4000-8000-000000000002', 'super_admin'),
  ('a1000000-0000-4000-8000-000000000003', 'admin');

select ok(not has_table_privilege('authenticated', 'public.admin_users', 'insert'), 'clients cannot grant themselves access');
select ok(not has_table_privilege('authenticated', 'public.admin_users', 'update'), 'clients cannot change roles');
select ok(not has_function_privilege('anon', 'public.manage_admin_access(uuid,uuid,text,boolean)', 'execute'), 'anonymous cannot invoke management');
select ok(not has_function_privilege('authenticated', 'public.manage_admin_access(uuid,uuid,text,boolean)', 'execute'), 'ordinary sessions cannot invoke management');
select ok(has_function_privilege('service_role', 'public.manage_admin_access(uuid,uuid,text,boolean)', 'execute'), 'only server can invoke management');
select is((select prosecdef from pg_proc where oid = 'public.manage_admin_access(uuid,uuid,text,boolean)'::regprocedure), false, 'management does not use security definer');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.admin_users), 1, 'users can only see their own membership');
reset role;
set local role service_role;

select throws_ok($$select public.manage_admin_access('a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002', 'admin', false)$$, '42501', 'Active superadministrator required', 'ordinary admin cannot manage access');
select throws_ok($$select public.manage_admin_access('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'admin', false)$$, '22023', 'Cannot change own access', 'self-demotion and self-blocking are forbidden');
select lives_ok($$select public.manage_admin_access('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'super_admin', true)$$, 'superadmin can promote another account');
select is((select role from public.admin_users where user_id = 'a1000000-0000-4000-8000-000000000003'), 'super_admin', 'promotion persisted');
select lives_ok($$select public.manage_admin_access('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002', 'super_admin', false)$$, 'superadmin can block another superadmin');
select throws_ok($$select public.manage_admin_access('a1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'admin', false)$$, '42501', 'Active superadministrator required', 'blocked actor cannot block the remaining superadmin');
select throws_ok($$select public.manage_admin_access('a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000003', 'root', true)$$, '22023', 'Invalid access settings', 'invalid profiles are rejected');

reset role;
select * from finish();
rollback;
