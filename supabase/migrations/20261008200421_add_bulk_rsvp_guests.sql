begin;

-- Private receipts make retries safe even when the HTTP response is lost.
create table public.event_rsvp_guest_batches (
  event_id uuid not null references public.events(id) on delete cascade,
  batch_id uuid not null,
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  saved_count integer not null check (saved_count between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (event_id, batch_id)
);
alter table public.event_rsvp_guest_batches enable row level security;
alter table public.event_rsvp_guest_batches force row level security;
revoke all on public.event_rsvp_guest_batches from public, anon, authenticated;
grant select, insert on public.event_rsvp_guest_batches to service_role;

create function public.create_rsvp_guest_batch(
  p_event_id uuid, p_batch_id uuid, p_input_hash text, p_guests jsonb
) returns integer language plpgsql security invoker set search_path = '' as $$
declare
  receipt public.event_rsvp_guest_batches%rowtype;
  guest jsonb;
  guest_count integer;
begin
  if p_batch_id is null or p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$'
    or p_guests is null or pg_catalog.jsonb_typeof(p_guests) <> 'array' then
    raise exception 'Invalid batch' using errcode = '22023';
  end if;
  guest_count := pg_catalog.jsonb_array_length(p_guests);
  if guest_count not between 1 and 100 then
    raise exception 'Invalid batch size' using errcode = '22023';
  end if;
  perform 1 from public.events where id = p_event_id for share;
  if not found then raise exception 'Event missing' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_event_id::text || ':guest-batch:' || p_batch_id::text, 0)
  );
  select * into receipt from public.event_rsvp_guest_batches
    where event_id = p_event_id and batch_id = p_batch_id;
  if found then
    if receipt.input_hash <> p_input_hash or receipt.saved_count <> guest_count then
      raise exception 'Batch changed' using errcode = '22023';
    end if;
    return receipt.saved_count;
  end if;
  for guest in select value from pg_catalog.jsonb_array_elements(p_guests) loop
    if pg_catalog.jsonb_typeof(guest) <> 'object' or guest->>'name' is null
      or char_length(btrim(guest->>'name')) not between 1 and 200
      or guest->>'code' is null or guest->>'code' !~ '^[A-Za-z0-9_-]{43}$' then
      raise exception 'Invalid guest' using errcode = '22023';
    end if;
    perform public.create_rsvp_guest(p_event_id, guest->>'name', guest->>'code', guest->>'email', guest->>'phone');
  end loop;
  insert into public.event_rsvp_guest_batches (event_id, batch_id, input_hash, saved_count)
    values (p_event_id, p_batch_id, p_input_hash, guest_count);
  return guest_count;
end;
$$;
revoke all on function public.create_rsvp_guest_batch(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.create_rsvp_guest_batch(uuid,uuid,text,jsonb) to service_role;

commit;
