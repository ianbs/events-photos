begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select ok((select relrowsecurity from pg_class where oid = 'public.event_rsvps'::regclass), 'RSVPs enable RLS');
select ok((select relforcerowsecurity from pg_class where oid = 'public.event_rsvps'::regclass), 'RSVPs force RLS');
select ok(not has_table_privilege('anon', 'public.event_rsvps', 'select,insert,update,delete'), 'anonymous clients have no direct access');
select ok(not has_table_privilege('authenticated', 'public.event_rsvps', 'select,insert,update,delete'), 'authenticated clients have no direct access');
select ok(has_table_privilege('service_role', 'public.event_rsvps', 'select,insert,update,delete'), 'authorized server can access RSVPs');

insert into public.events (id, name, slug, event_date) values
  ('10000000-0000-4000-8000-000000000001', 'RSVP A', 'rsvp-test-a', current_date),
  ('10000000-0000-4000-8000-000000000002', 'RSVP B', 'rsvp-test-b', current_date);
insert into public.guests (id, event_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');

select throws_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending)
  values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Test', true)$$,
  '23503', null, 'cannot attach guest to another event');
select throws_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending, companions)
  values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Test', false, 1)$$,
  '23514', null, 'declines cannot include companions');
select throws_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending, companions)
  values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Test', true, 11)$$,
  '23514', null, 'companions are bounded');
select lives_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending)
  values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Test', true)$$,
  'valid confirmation is accepted');
select throws_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending)
  values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Test', true)$$,
  '23505', null, 'one response per guest and event');
select lives_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending)
  values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Test', false)
  on conflict (event_id, guest_id) do update set attending = excluded.attending$$,
  'retries and changes replace the existing response');

select * from finish();
rollback;
