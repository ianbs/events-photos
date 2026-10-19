begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values ('e1000000-0000-4000-8000-000000000001', 'deletion-admin@example.invalid');
insert into public.admin_users (user_id) values ('e1000000-0000-4000-8000-000000000001');
insert into public.events (id, name, slug, event_date, is_active) values
  ('e2000000-0000-4000-8000-000000000001', 'Excluir teste', 'delete-test-active', '2026-10-18', true),
  ('e2000000-0000-4000-8000-000000000002', 'Excluir teste', 'delete-test-photos', '2026-10-18', false),
  ('e2000000-0000-4000-8000-000000000003', 'Excluir teste', 'delete-test-branding', '2026-10-18', false);
insert into public.guests (event_id, id) values ('e2000000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000001');
insert into public.photos (event_id,guest_id,storage_path,original_filename,mime_type,file_size) values
  ('e2000000-0000-4000-8000-000000000002','e3000000-0000-4000-8000-000000000001','deletion-test/file.png','file.png','image/png',10);
update public.events set cover_storage_path = 'deletion-test/cover.png' where id = 'e2000000-0000-4000-8000-000000000003';

select ok(not has_function_privilege('anon', 'public.finish_admin_event_deletion(uuid,uuid,text,boolean)', 'execute'), 'anonymous cannot finalize deletion');
select ok(not has_function_privilege('authenticated', 'public.finish_admin_event_deletion(uuid,uuid,text,boolean)', 'execute'), 'authenticated clients cannot bypass the server');
select ok(has_function_privilege('service_role', 'public.finish_admin_event_deletion(uuid,uuid,text,boolean)', 'execute'), 'privileged server can finalize');
select is((select prosecdef from pg_proc where oid = 'public.finish_admin_event_deletion(uuid,uuid,text,boolean)'::regprocedure), false, 'finalizer uses invoker permissions');

set local role service_role;
select throws_ok($$select public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000001','Excluir teste')$$, '42501', 'Active administrator required', 'non-admin actor is rejected');
select throws_ok($$select public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','Outro')$$, '22023', 'Event confirmation mismatch', 'wrong confirmation is rejected');
select throws_ok($$select public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001',null)$$, '22023', 'Event confirmation mismatch', 'null confirmation cannot bypass the name check');
select is(public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','Excluir teste'), false, 'active event is not deleted');
select is(public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','Excluir teste'), false, 'registered photos prevent deletion');
select is(public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000003','Excluir teste'), false, 'associated assets prevent deletion');
delete from public.photos where event_id = 'e2000000-0000-4000-8000-000000000002';
select is(public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','Excluir teste',true), false, 'capability check never deletes even an empty inactive event');
select ok(exists (select 1 from public.events where id = 'e2000000-0000-4000-8000-000000000002'), 'event preserved after capability check');
select is(public.finish_admin_event_deletion('e1000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000002','Excluir teste'), true, 'clean event deleted');
select is((select count(*)::integer from public.guests where event_id = 'e2000000-0000-4000-8000-000000000002'), 0, 'related guests cascade atomically');

reset role;
select * from finish();
rollback;
