begin;
select plan(13);

select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.event_rsvp_identities'::regclass), 'identity data forces RLS');
select ok(not has_table_privilege('anon', 'public.event_rsvp_identities', 'select,insert,update,delete'), 'anon cannot access identities');
select ok(not has_table_privilege('authenticated', 'public.event_rsvp_identities', 'select,insert,update,delete'), 'authenticated clients cannot access identities');
select ok(not has_function_privilege('anon', 'public.ensure_rsvp_identity(uuid,text,text,text)', 'execute'), 'anon cannot resolve arbitrary emails');
select ok(not has_function_privilege('authenticated', 'public.ensure_rsvp_identity(uuid,text,text,text)', 'execute'), 'clients cannot resolve arbitrary emails');
select ok(has_function_privilege('service_role', 'public.ensure_rsvp_identity(uuid,text,text,text)', 'execute'), 'server can resolve verified identity');

insert into public.events (id, name, slug, event_date) values
  ('30000000-0000-4000-8000-000000000001', 'Identity A', 'identity-test-a', current_date),
  ('30000000-0000-4000-8000-000000000002', 'Identity B', 'identity-test-b', current_date);

create temporary table resolved_guest as select public.ensure_rsvp_identity(
  '30000000-0000-4000-8000-000000000001', ' ANA@example.com ', 'Ana', repeat('a', 64)
) as id;
select is(public.ensure_rsvp_identity('30000000-0000-4000-8000-000000000001', 'ana@example.com'),
  (select id from resolved_guest), 'email verification reuses the invitation identity');
select isnt(public.ensure_rsvp_identity('30000000-0000-4000-8000-000000000002', 'ana@example.com'),
  (select id from resolved_guest), 'same email in different events is isolated');

insert into public.event_rsvps (event_id, guest_id, name, attending)
select '30000000-0000-4000-8000-000000000001', id, 'Ana', true from resolved_guest;
insert into public.event_rsvps (event_id, guest_id, name, attending, companions)
values ('30000000-0000-4000-8000-000000000001', public.ensure_rsvp_identity('30000000-0000-4000-8000-000000000001', 'ana@example.com'), 'Ana', true, 2)
on conflict (event_id, guest_id) do update set companions = excluded.companions;
select is((select count(*) from public.event_rsvps where event_id = '30000000-0000-4000-8000-000000000001'), 1::bigint, 'second device updates one response');
select is((select guest_count from public.event_admin_summaries where event_id = '30000000-0000-4000-8000-000000000001'), 0::bigint, 'RSVP identities do not inflate photo devices');

select is(public.ensure_rsvp_identity('30000000-0000-4000-8000-000000000001', 'ana@example.com', 'Ana', repeat('b', 64)),
  (select id from resolved_guest), 'renewing an invitation preserves identity and response');
select is((select count(*) from public.event_rsvp_identities where event_id = '30000000-0000-4000-8000-000000000001' and invitation_hash = repeat('a',64)), 0::bigint, 'renewed invitations invalidate old hash');
select throws_ok($$select public.ensure_rsvp_identity('30000000-0000-4000-8000-000000000001')$$,
  '22023', null, 'missing identity is rejected');

select * from finish();
rollback;
