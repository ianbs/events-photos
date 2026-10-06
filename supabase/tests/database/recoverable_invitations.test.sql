begin;
select plan(7);

select ok(not has_table_privilege('anon', 'public.event_rsvp_identities', 'select'), 'anonymous clients cannot recover invitation secrets');
select ok(not has_table_privilege('authenticated', 'public.event_rsvp_identities', 'select'), 'authenticated clients cannot recover secrets directly');
select ok(not has_function_privilege('anon', 'public.create_rsvp_guest(uuid,text,text,text,text)', 'execute'), 'anonymous clients cannot create guests');

insert into public.events (id, name, slug, event_date)
values ('50000000-0000-4000-8000-000000000001', 'Recoverable invitation', 'recoverable-invitation-test', current_date);
create temporary table registered_guest as select public.create_rsvp_guest(
  '50000000-0000-4000-8000-000000000001', 'Ana', repeat('a',43), 'ana@example.com', '5511999999999'
) as id;
select is((select invitation_code from public.event_rsvp_identities where guest_id = (select id from registered_guest)), repeat('a',43), 'code survives registration for later recovery');
select is((select invitation_hash from public.event_rsvp_identities where guest_id = (select id from registered_guest)), encode(sha256(convert_to(repeat('a',43),'UTF8')),'hex'), 'authorization hash matches recoverable secret');
select throws_ok($$update public.event_rsvp_identities set invitation_code = repeat('b',43)
  where event_id = '50000000-0000-4000-8000-000000000001'$$, '23514', null, 'code cannot diverge from its authorization hash');
select lives_ok($$update public.event_rsvp_identities set name = 'Ana Maria', phone = '5511888888888'
  where event_id = '50000000-0000-4000-8000-000000000001'$$, 'contact edits preserve invitation access');

select * from finish();
rollback;
