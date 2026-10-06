alter table public.events
  add column location text,
  add column maps_url text,
  add column max_guests integer,
  add constraint events_location_length_check
    check (location is null or char_length(btrim(location)) between 1 and 500),
  add constraint events_maps_url_check
    check (maps_url is null or (
      char_length(maps_url) between 1 and 2000
      and maps_url ~ '^https?://[^[:space:]]+$'
    )),
  add constraint events_max_guests_check
    check (max_guests is null or max_guests > 0);

comment on column public.events.max_guests is
  'Planning capacity including companions; does not automatically restrict RSVPs.';
