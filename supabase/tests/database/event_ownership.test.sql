begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('f1000000-0000-4000-8000-000000000001', 'owner-test@example.invalid'),
  ('f1000000-0000-4000-8000-000000000002', 'other-admin-test@example.invalid');
insert into public.admin_users (user_id, role) values
  ('f1000000-0000-4000-8000-000000000001', 'admin'),
  ('f1000000-0000-4000-8000-000000000002', 'super_admin');
insert into public.events (id, owner_id, name, slug, event_date, is_active) values
  ('f2000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'Owned', 'ownership-test-owned', '2026-10-19', false),
  ('f2000000-0000-4000-8000-000000000002', null, 'Unassigned', 'ownership-test-unassigned', '2026-10-19', false);

select ok(not has_table_privilege('anon', 'public.events', 'select'), 'anonymous cannot list events directly');
select ok(not has_table_privilege('authenticated', 'public.events', 'select'), 'authenticated clients cannot bypass server ownership');
select ok(not has_table_privilege('authenticated', 'public.events', 'update'), 'authenticated clients cannot reassign ownership');
select ok(not has_function_privilege('authenticated', 'public.finish_admin_event_deletion(uuid,uuid,text,boolean)', 'execute'), 'authenticated clients cannot call privileged deletion');

set local role service_role;
select throws_ok($$select public.finish_admin_event_deletion('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','Owned',true)$$, '42501', 'Event owner required', 'even a super admin cannot preflight another owner event');
select throws_ok($$select public.finish_admin_event_deletion('f1000000-0000-4000-8000-000000000002','f2000000-0000-4000-8000-000000000001','Owned')$$, '42501', 'Event owner required', 'even a super admin cannot delete another owner event');
select throws_ok($$select public.finish_admin_event_deletion('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000002','Unassigned')$$, '42501', 'Event owner required', 'ownerless events cannot be claimed through deletion');
select is(public.finish_admin_event_deletion('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Owned',true), false, 'owner passes preflight');
select is(public.finish_admin_event_deletion('f1000000-0000-4000-8000-000000000001','f2000000-0000-4000-8000-000000000001','Owned'), true, 'owner can delete their own clean event');
reset role;
select * from finish();
rollback;
