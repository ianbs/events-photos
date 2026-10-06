begin;

alter table public.events
  drop constraint events_max_guests_check,
  add constraint events_max_guests_check
    check (max_guests is null or max_guests >= 0);

commit;
