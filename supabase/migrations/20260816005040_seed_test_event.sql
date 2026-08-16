grant select on table public.events to anon, authenticated;

drop policy if exists "Public can read active events" on public.events;
create policy "Public can read active events"
  on public.events
  for select
  to anon, authenticated
  using (is_active);

insert into public.events (name, slug, event_date, is_active)
values ('Batizado - Evento de teste', 'batizado-teste', '2026-08-15', true)
on conflict (slug) do update
set
  name = excluded.name,
  event_date = excluded.event_date,
  is_active = excluded.is_active;
