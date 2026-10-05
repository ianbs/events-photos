alter table public.events
  add column closing_message text not null
    default 'Obrigado por compartilhar este momento conosco!',
  add column photos_available_until date,
  add column organizer_contact text;

alter table public.events
  add constraint events_closing_message_length_check
    check (char_length(btrim(closing_message)) between 1 and 1000),
  add constraint events_organizer_contact_length_check
    check (
      organizer_contact is null
      or char_length(btrim(organizer_contact)) between 1 and 300
    );

drop index if exists public.photos_event_id_created_at_idx;

create index photos_created_at_id_idx
  on public.photos (created_at desc, id desc);

create index photos_event_id_created_at_id_idx
  on public.photos (event_id, created_at desc, id desc);

create view public.event_admin_summaries
with (security_invoker = true, security_barrier = true)
as
select
  event.id as event_id,
  count(photo.id)::bigint as photo_count,
  count(distinct guest.id)::bigint as guest_count,
  coalesce(sum(photo.file_size), 0)::bigint as storage_bytes,
  max(photo.created_at) as last_photo_at
from public.events as event
left join public.guests as guest
  on guest.event_id = event.id
left join public.photos as photo
  on photo.event_id = event.id
  and photo.guest_id = guest.id
group by event.id;

revoke all on public.event_admin_summaries from public, anon, authenticated;
grant select on public.event_admin_summaries to service_role;
