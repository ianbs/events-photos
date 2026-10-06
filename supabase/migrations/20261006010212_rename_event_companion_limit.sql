begin;

alter table public.events rename column max_guests to max_companions;
alter table public.events rename constraint events_max_guests_check to events_max_companions_check;
comment on column public.events.max_companions is
  'Maximum companions per RSVP, excluding the guest. Null uses the default limit of 10.';

alter table public.event_rsvps drop constraint event_rsvps_companions_check,
  add constraint event_rsvps_companions_check check (companions >= 0);

create or replace function public.check_rsvp_companions_allowed()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  companion_limit integer;
begin
  select coalesce(max_companions, 10) into companion_limit
    from public.events where id = new.event_id for share;
  if new.companions > companion_limit then
    if companion_limit = 0 then
      raise exception 'Este evento não permite acompanhantes.'
        using errcode = '23514', constraint = 'event_rsvps_companions_disabled_check';
    end if;
    raise exception 'Este evento permite no máximo % acompanhante(s) por convidado.', companion_limit
      using errcode = '23514', constraint = 'event_rsvps_companion_limit_check';
  end if;
  return new;
end;
$$;

commit;
