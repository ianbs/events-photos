begin;
select plan(6);

insert into public.events (id, name, slug, event_date)
values ('20000000-0000-4000-8000-000000000001', 'Location test', 'location-capacity-test', current_date);

select lives_ok($$update public.events set location = 'São Paulo', maps_url = 'https://waze.com/ul', max_companions = 150
  where id = '20000000-0000-4000-8000-000000000001'$$, 'accepts event location and capacity');
select lives_ok($$update public.events set max_companions = 0 where id = '20000000-0000-4000-8000-000000000001'$$,
  'accepts zero capacity');
select throws_ok($$update public.events set max_companions = -1 where id = '20000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'rejects negative capacity');
select throws_ok($$update public.events set location = '   ' where id = '20000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'rejects blank location');
select throws_ok($$update public.events set maps_url = 'javascript:alert(1)' where id = '20000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'rejects unsafe map schemes');
select lives_ok($$update public.events set location = null, maps_url = null, max_companions = null
  where id = '20000000-0000-4000-8000-000000000001'$$, 'allows clearing optional fields');

select * from finish();
rollback;
