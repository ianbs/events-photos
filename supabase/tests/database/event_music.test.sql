begin;
select plan(8);

insert into public.events (id, name, slug, event_date)
values ('80000000-0000-4000-8000-000000000001', 'Music', 'music-test', current_date);

select is((select music_storage_path from public.events where slug = 'music-test'), null::text, 'music is optional on existing and new events');
select lives_ok($$update public.events set music_storage_path = '80000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.mp3' where slug = 'music-test'$$, 'event may refer to its own MP3');
select throws_ok($$update public.events set music_storage_path = '90000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.mp3' where slug = 'music-test'$$, '23514', null, 'another event path cannot be attached');
select throws_ok($$update public.events set music_storage_path = '80000000-0000-4000-8000-000000000001/../track.mp3' where slug = 'music-test'$$, '23514', null, 'path traversal is rejected');
select throws_ok($$update public.events set music_storage_path = '80000000-0000-4000-8000-000000000001/22222222-2222-4222-8222-222222222222.html' where slug = 'music-test'$$, '23514', null, 'non-MP3 paths are rejected');
select is((select public from storage.buckets where id = 'event-music'), false, 'music bucket stays private');
select is((select file_size_limit from storage.buckets where id = 'event-music'), 15728640::bigint, 'uploads are limited to 15 MiB');
select is((select allowed_mime_types from storage.buckets where id = 'event-music'), array['audio/mpeg'], 'bucket accepts MP3 only');

select * from finish();
rollback;
