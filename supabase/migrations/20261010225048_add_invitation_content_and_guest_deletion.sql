begin;

alter table public.events
  add column instructions text check (instructions is null or char_length(instructions) <= 5000),
  add column whatsapp_message text check (whatsapp_message is null or char_length(whatsapp_message) <= 3000);

-- Row locking needs UPDATE privilege, even though the function does not edit
-- guest fields. Photo lookup prevents cascading deletion of the photo records.
grant update, delete on public.guests to service_role;
grant select on public.photos to service_role;

-- Remove the invitation and RSVP atomically. Photo-upload records and files
-- remain intact if this guest has uploaded photos.
create function public.delete_rsvp_guest(p_event_id uuid, p_guest_id uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.guests
    where event_id = p_event_id and id = p_guest_id for update;
  if not found then return false; end if;

  delete from public.event_rsvp_identities
    where event_id = p_event_id and guest_id = p_guest_id;
  if not found then return false; end if;

  delete from public.event_rsvps
    where event_id = p_event_id and guest_id = p_guest_id;
  delete from public.guests as guest
    where guest.event_id = p_event_id and guest.id = p_guest_id
      and not exists (select 1 from public.photos as photo
        where photo.event_id = p_event_id and photo.guest_id = p_guest_id);
  return true;
end;
$$;

revoke all on function public.delete_rsvp_guest(uuid,uuid) from public, anon, authenticated;
grant execute on function public.delete_rsvp_guest(uuid,uuid) to service_role;

commit;
