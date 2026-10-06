-- Add the organizer event-deletion RPC to an existing Occasion Pass database.
-- Run this file in Supabase SQL Editor, then reload the website.

drop policy if exists "organizers delete own" on public.events;

create or replace function public.delete_own_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;

  select * into v_event
    from events
    where id = p_event_id
    for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.organizer_id <> auth.uid() then
    raise exception 'You can only delete your own events';
  end if;
  if exists (select 1 from tickets where event_id = p_event_id) then
    raise exception 'Tickets have already been sold for this event, so it cannot be deleted. Refund the buyers first.';
  end if;
  if exists (
    select 1
      from event_reservations
      where event_id = p_event_id
        and (status = 'refund_required'
          or (status in ('pending','failed')
            and created_at > now() - interval '1 day'))
  ) then
    raise exception 'There is recent payment activity on this event. Please try again after 24 hours.';
  end if;

  delete from events where id = p_event_id;
end
$$;

revoke all on function public.delete_own_event(uuid) from public, anon;
grant execute on function public.delete_own_event(uuid) to authenticated;
notify pgrst, 'reload schema';

select
  to_regprocedure('public.delete_own_event(uuid)') as installed_function,
  has_function_privilege(
    'authenticated',
    'public.delete_own_event(uuid)',
    'EXECUTE'
  ) as authenticated_can_execute;
