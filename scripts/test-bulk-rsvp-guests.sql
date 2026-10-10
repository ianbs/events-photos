-- Run with supabase db query --linked --file scripts/test-bulk-rsvp-guests.sql.
-- All fixtures and guest codes are created in the database and rolled back.
begin;
do $$
declare
  test_event_id uuid := gen_random_uuid();
  batch_id uuid := gen_random_uuid();
  guests jsonb;
  count_before bigint;
  result integer;
begin
  if has_table_privilege('anon', 'public.event_rsvp_guest_batches', 'select,insert,update,delete')
    or has_table_privilege('authenticated', 'public.event_rsvp_guest_batches', 'select,insert,update,delete')
    or has_function_privilege('anon', 'public.create_rsvp_guest_batch(uuid,uuid,text,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.create_rsvp_guest_batch(uuid,uuid,text,jsonb)', 'execute') then
    raise exception 'Public clients can access bulk guest registration';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_class
    where oid = 'public.event_rsvp_guest_batches'::regclass) then
    raise exception 'Missing batch RLS';
  end if;
  insert into public.events (id, name, slug, event_date)
    values (test_event_id, 'Teste técnico de cadastro em lote', 'bulk-test-' || test_event_id::text, current_date);
  guests := jsonb_build_array(
    jsonb_build_object('name', 'Teste A', 'email', 'bulk-a@example.invalid', 'maxCompanions', 0, 'code', substr(encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 1, 43)),
    jsonb_build_object('name', 'Teste B', 'email', 'bulk-b@example.invalid', 'maxCompanions', 3, 'code', substr(encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 1, 43))
  );
  execute 'set local role service_role';
  result := public.create_rsvp_guest_batch(test_event_id, batch_id, repeat('a', 64), guests);
  if result <> 2 then raise exception 'Batch count mismatch'; end if;
  select count(*) into count_before from public.guests where public.guests.event_id = test_event_id;
  if count_before <> 2 then raise exception 'Guests not registered'; end if;
  if (select count(*) from public.event_rsvp_identities
    where event_id = test_event_id and ((email = 'bulk-a@example.invalid' and max_companions = 0)
      or (email = 'bulk-b@example.invalid' and max_companions = 3))) <> 2 then
    raise exception 'Individual companion allowances were not preserved';
  end if;
  result := public.create_rsvp_guest_batch(test_event_id, batch_id, repeat('a', 64), guests);
  if result <> 2 or (select count(*) from public.guests where public.guests.event_id = test_event_id) <> count_before then
    raise exception 'Repeated batch duplicated guests';
  end if;
  begin
    perform public.create_rsvp_guest_batch(test_event_id, batch_id, repeat('b', 64), guests);
    raise exception 'Changed batch was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_rsvp_guest_batch(test_event_id, gen_random_uuid(), repeat('c', 64), jsonb_build_array(
      jsonb_build_object('name', 'Teste C', 'email', 'bulk-c@example.invalid', 'code', substr(encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 1, 43)),
      jsonb_build_object('name', 'Duplicado', 'email', 'bulk-a@example.invalid', 'code', substr(encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 1, 43))
    ));
    raise exception 'Duplicate email was accepted';
  exception when unique_violation then null;
  end;
  if (select count(*) from public.guests where public.guests.event_id = test_event_id) <> count_before
    or (select count(*) from public.event_rsvp_identities where public.event_rsvp_identities.event_id = test_event_id) <> count_before
    or (select count(*) from public.event_rsvp_guest_batches where public.event_rsvp_guest_batches.event_id = test_event_id) <> 1 then
    raise exception 'Failed batch left partial records';
  end if;
  begin
    perform public.create_rsvp_guest_batch(test_event_id, gen_random_uuid(), repeat('d', 64), '[]'::jsonb);
    raise exception 'Empty batch was accepted';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.create_rsvp_guest_batch(test_event_id, gen_random_uuid(), repeat('e', 64), jsonb_build_array(
      jsonb_build_object('name', 'Teste E', 'email', 'bulk-e@example.invalid', 'code', substr(encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 1, 43)),
      jsonb_build_object('name', 'Inválido', 'maxCompanions', -1, 'code', substr(encode(sha256(gen_random_uuid()::text::bytea), 'hex'), 1, 43))
    ));
    raise exception 'Negative companion allowance was accepted';
  exception when invalid_parameter_value then null;
  end;
  if (select count(*) from public.guests where event_id = test_event_id) <> count_before
    or (select count(*) from public.event_rsvp_identities where event_id = test_event_id) <> count_before
    or (select count(*) from public.event_rsvp_guest_batches where event_id = test_event_id) <> 1 then
    raise exception 'Invalid allowance left partial records';
  end if;
  execute 'reset role';
end;
$$;
rollback;
select 'Bulk registration, retry, rollback and permissions verified' as result;
