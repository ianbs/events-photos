begin;
select plan(8);

insert into public.events (id, name, slug, event_date, max_companions)
values ('40000000-0000-4000-8000-000000000001', 'Companion test', 'companion-policy-test', current_date, 0);
insert into public.guests (id, event_id)
values ('40000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001');

select throws_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending, companions)
  values ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Ana', true, 1)$$,
  '23514', 'Este evento não permite acompanhantes.', 'zero capacity rejects companions');
select lives_ok($$insert into public.event_rsvps (event_id, guest_id, name, attending, companions)
  values ('40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002', 'Ana', true, 0)$$,
  'guest may confirm without companions');
select throws_ok($$update public.event_rsvps set companions = 1
  where event_id = '40000000-0000-4000-8000-000000000001'$$,
  '23514', 'Este evento não permite acompanhantes.', 'updates also enforce zero capacity');

update public.events set max_companions = 1 where id = '40000000-0000-4000-8000-000000000001';
select lives_ok($$update public.event_rsvps set companions = 1
  where event_id = '40000000-0000-4000-8000-000000000001'$$, 'configured limit of one permits one companion');
select throws_ok($$update public.event_rsvps set companions = 2
  where event_id = '40000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'configured limit of one rejects two companions');
update public.events set max_companions = 12 where id = '40000000-0000-4000-8000-000000000001';
select lives_ok($$update public.event_rsvps set companions = 12
  where event_id = '40000000-0000-4000-8000-000000000001'$$, 'configured limits may exceed the default');
update public.events set max_companions = null where id = '40000000-0000-4000-8000-000000000001';
select lives_ok($$update public.event_rsvps set companions = 2
  where event_id = '40000000-0000-4000-8000-000000000001'$$, 'unset capacity permits companions');
select throws_ok($$update public.event_rsvps set companions = 11
  where event_id = '40000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'unset limit retains default maximum of ten');

select * from finish();
rollback;
