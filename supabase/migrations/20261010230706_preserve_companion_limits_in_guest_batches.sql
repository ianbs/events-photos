begin;

-- Keep atomic, retryable batch registration and pass each guest's allowance
-- to the individual registration function introduced by the companion migration.
create or replace function public.create_rsvp_guest_batch(
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
    if guest->>'maxCompanions' is not null then
      if guest->>'maxCompanions' !~ '^[0-9]{1,10}$' then
        raise exception 'Invalid companion allowance' using errcode = '22023';
      end if;
      if (guest->>'maxCompanions')::bigint > 2147483647 then
        raise exception 'Invalid companion allowance' using errcode = '22023';
      end if;
    end if;
    perform public.create_rsvp_guest(p_event_id, guest->>'name', guest->>'code',
      guest->>'email', guest->>'phone', (guest->>'maxCompanions')::integer);
  end loop;
  insert into public.event_rsvp_guest_batches (event_id, batch_id, input_hash, saved_count)
    values (p_event_id, p_batch_id, p_input_hash, guest_count);
  return guest_count;
end;
$$;

commit;
