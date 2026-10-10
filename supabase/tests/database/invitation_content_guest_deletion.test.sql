begin;
select plan(19);

select ok(not has_function_privilege('anon', 'public.delete_rsvp_guest(uuid,uuid)', 'execute'), 'anonymous clients cannot delete guests');
select ok(not has_function_privilege('authenticated', 'public.delete_rsvp_guest(uuid,uuid)', 'execute'), 'authenticated clients cannot delete guests directly');
select ok(has_function_privilege('service_role', 'public.delete_rsvp_guest(uuid,uuid)', 'execute'), 'trusted server can delete guests');

insert into public.events (id, name, slug, event_date, instructions, whatsapp_message)
values ('60000000-0000-4000-8000-000000000001', 'Invitation fields', 'invitation-fields-test', current_date, E'Traje social.\nChegue às 18h.', 'Olá, {nome}! {link}'),
       ('60000000-0000-4000-8000-000000000002', 'Other event', 'other-invitation-fields-test', current_date, null, null);
select is((select instructions from public.events where id = '60000000-0000-4000-8000-000000000001'), E'Traje social.\nChegue às 18h.', 'instructions preserve line breaks');
select throws_ok($$update public.events set instructions = repeat('a',5001) where id = '60000000-0000-4000-8000-000000000001'$$, '23514', null, 'instructions enforce length');
select throws_ok($$update public.events set whatsapp_message = repeat('a',3001) where id = '60000000-0000-4000-8000-000000000001'$$, '23514', null, 'WhatsApp messages enforce length');

create temporary table deletion_guest as select public.create_rsvp_guest(
  '60000000-0000-4000-8000-000000000001', 'Ana', repeat('a',43)
) as id;
insert into public.event_rsvps (event_id, guest_id, name, attending)
select '60000000-0000-4000-8000-000000000001', id, 'Ana', true from deletion_guest;

select is(public.delete_rsvp_guest('60000000-0000-4000-8000-000000000002', (select id from deletion_guest)), false, 'cannot delete a guest through another event');
select is((select count(*)::int from public.event_rsvp_identities where guest_id = (select id from deletion_guest)), 1, 'other-event attempt preserves invitation');
set local role service_role;
select is(public.delete_rsvp_guest('60000000-0000-4000-8000-000000000001', (select guest_id from public.event_rsvp_identities where event_id = '60000000-0000-4000-8000-000000000001')), true, 'trusted server deletes the guest');
reset role;
select is((select count(*)::int from public.event_rsvp_identities where guest_id = (select id from deletion_guest)), 0, 'deletion invalidates invitation');
select is((select count(*)::int from public.event_rsvps where guest_id = (select id from deletion_guest)), 0, 'deletion removes RSVP');
select is((select count(*)::int from public.guests where id = (select id from deletion_guest)), 0, 'unused technical guest is removed');

create temporary table photo_guest as select public.create_rsvp_guest(
  '60000000-0000-4000-8000-000000000001', 'João', repeat('b',43)
) as id;
insert into public.photos (event_id, guest_id, storage_path, original_filename, mime_type, file_size)
select '60000000-0000-4000-8000-000000000001', id, 'deletion-test/photo.jpg', 'photo.jpg', 'image/jpeg', 100 from photo_guest;
select is(public.delete_rsvp_guest('60000000-0000-4000-8000-000000000001', (select id from photo_guest)), true, 'guest with photos can be removed from invitation list');
select is((select count(*)::int from public.photos where guest_id = (select id from photo_guest)), 1, 'existing photo is preserved');
select is(public.delete_rsvp_guest('60000000-0000-4000-8000-000000000001', (select id from photo_guest)), false, 'repeated deletion reports missing invitation');
select is((select count(*)::int from public.guests where id = (select id from photo_guest)), 1, 'technical photo ownership record is preserved');

create temporary table rollback_guest as select public.create_rsvp_guest(
  '60000000-0000-4000-8000-000000000001', 'Maria', repeat('c',43)
) as id;
insert into public.event_rsvps (event_id, guest_id, name, attending)
select '60000000-0000-4000-8000-000000000001', id, 'Maria', true from rollback_guest;
create function public.test_fail_guest_cleanup() returns trigger language plpgsql as $$
begin raise exception 'test cleanup failure'; end;
$$;
create trigger test_fail_cleanup before delete on public.guests
for each row execute function public.test_fail_guest_cleanup();
select throws_ok($$select public.delete_rsvp_guest('60000000-0000-4000-8000-000000000001', (select id from rollback_guest))$$, 'P0001', 'test cleanup failure', 'cleanup failure aborts the deletion');
select is((select count(*)::int from public.event_rsvp_identities where guest_id = (select id from rollback_guest)), 1, 'failed deletion preserves invitation');
select is((select count(*)::int from public.event_rsvps where guest_id = (select id from rollback_guest)), 1, 'failed deletion preserves RSVP');

select * from finish();
rollback;
