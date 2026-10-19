-- Aggregate verification; does not expose event contents or user identifiers.
select
  count(*) as total_events,
  count(*) filter (where e.owner_id = (select id from auth.users where lower(email)='ianbarbosasantos@gmail.com')) as assigned_to_legacy_owner,
  count(*) filter (where e.owner_id is null) as unassigned_events,
  not has_table_privilege('anon', 'public.events', 'select') as anonymous_listing_blocked,
  not has_table_privilege('authenticated', 'public.events', 'select') as direct_authenticated_listing_blocked
from public.events e;
