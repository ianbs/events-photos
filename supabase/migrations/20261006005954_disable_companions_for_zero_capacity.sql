begin;

create function public.check_rsvp_companions_allowed()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  capacity integer;
begin
  -- Lock the event while writing so a simultaneous configuration change
  -- cannot bypass the rule after the application's preflight check.
  select max_guests into capacity from public.events where id = new.event_id for share;
  if capacity = 0 and new.companions > 0 then
    raise exception 'Este evento não permite acompanhantes.'
      using errcode = '23514', constraint = 'event_rsvps_companions_disabled_check';
  end if;
  return new;
end;
$$;

revoke all on function public.check_rsvp_companions_allowed() from public, anon, authenticated;
grant execute on function public.check_rsvp_companions_allowed() to service_role;

create trigger event_rsvps_check_companions_allowed
before insert or update on public.event_rsvps
for each row execute function public.check_rsvp_companions_allowed();

commit;
