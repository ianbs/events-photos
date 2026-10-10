begin;
select plan(15);

insert into public.events (id, name, slug, event_date, max_companions)
values ('70000000-0000-4000-8000-000000000001', 'Individual companions', 'individual-companions-test', current_date, 2);
create temporary table individual_guests as
select public.create_rsvp_guest('70000000-0000-4000-8000-000000000001', 'Ana', repeat('a',43), null, null, 0) as alone,
       public.create_rsvp_guest('70000000-0000-4000-8000-000000000001', 'João', repeat('b',43), null, null, 3) as custom,
       public.create_rsvp_guest('70000000-0000-4000-8000-000000000001', 'Maria', repeat('c',43)) as inherited;

select ok(not has_function_privilege('anon', 'public.create_rsvp_guest(uuid,text,text,text,text,integer)', 'execute'), 'public clients cannot configure individual limits');
select is((select max_companions from public.event_rsvp_identities where guest_id = (select alone from individual_guests)), 0, 'registration preserves an explicit zero');
select throws_ok($$update public.event_rsvp_identities set max_companions = -1 where guest_id = (select alone from individual_guests)$$, '23514', null, 'negative allowances are rejected');
select throws_ok($$insert into public.event_rsvps(event_id,guest_id,name,attending,companions)
select '70000000-0000-4000-8000-000000000001', alone, 'Ana', true, 1 from individual_guests$$, '23514', null, 'individual zero overrides the event default');
select lives_ok($$insert into public.event_rsvps(event_id,guest_id,name,attending,companions,companion_names)
select '70000000-0000-4000-8000-000000000001', custom, 'João', true, 3, array['Pedro','Luiza'] from individual_guests$$, 'individual allowance may exceed the event default and names are optional');
select is((select companion_names from public.event_rsvps where guest_id = (select custom from individual_guests)), array['Pedro','Luiza'], 'companion names are recoverable');
select throws_ok($$update public.event_rsvps set companions = 4 where guest_id = (select custom from individual_guests)$$, '23514', null, 'writes cannot exceed the individual allowance');
select lives_ok($$insert into public.event_rsvps(event_id,guest_id,name,attending,companions)
select '70000000-0000-4000-8000-000000000001', inherited, 'Maria', true, 2 from individual_guests$$, 'unset individual allowance inherits the event');
select throws_ok($$update public.event_rsvps set companions = 3 where guest_id = (select inherited from individual_guests)$$, '23514', null, 'inherited event allowance is enforced');
select throws_ok($$update public.event_rsvps set companion_names = array['A','B','C'] where guest_id = (select inherited from individual_guests)$$, '23514', null, 'cannot save more names than companions');
select throws_ok($$update public.event_rsvps set companion_names = array[' '] where guest_id = (select inherited from individual_guests)$$, '23514', null, 'blank names are rejected');
select throws_ok($$update public.event_rsvps set companion_names = array[repeat('a',201)] where guest_id = (select inherited from individual_guests)$$, '23514', null, 'names enforce length');
select throws_ok($$update public.event_rsvps set companion_names = array[null::text] where guest_id = (select inherited from individual_guests)$$, '23514', null, 'null names are rejected');
update public.event_rsvp_identities set max_companions = 1 where guest_id = (select custom from individual_guests);
select is((select companions from public.event_rsvps where guest_id = (select custom from individual_guests)), 3, 'lowering allowance preserves the historical response');
select throws_ok($$update public.event_rsvps set name = 'João Silva' where guest_id = (select custom from individual_guests)$$, '23514', null, 'new saves enforce the lowered allowance');

select * from finish();
rollback;
