-- Upgrade an existing Occasion Pass database without recreating profiles,
-- events, or tickets. Run this file in Supabase SQL Editor.
-- It is safe to run again after a partial run.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles(id, name, category)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name', ''), 'Member'),
    case
      when new.raw_user_meta_data->>'category' in ('student','professional','other','organizer')
        then new.raw_user_meta_data->>'category'
      else 'other'
    end
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

drop policy if exists "create own profile" on profiles;
create policy "create own profile" on profiles
  for insert with check (auth.uid() = id);

drop function if exists book_ticket_test(uuid);

create table if not exists event_reservations(
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  razorpay_order_id text unique,
  payment_id text unique,
  status text not null default 'pending'
    check (status in ('pending','paid','failed','refund_required','refunded')),
  refund_claimed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);
alter table event_reservations enable row level security;
alter table event_reservations add column if not exists refund_claimed_at timestamptz;
create index if not exists event_reservations_active_event_idx
  on event_reservations(event_id, expires_at) where status = 'pending';
create index if not exists event_reservations_active_user_event_idx
  on event_reservations(user_id, event_id, expires_at) where status = 'pending';

create or replace view public.events_public as
select e.id, e.organizer_id, e.festival, e.title, e.starts_at, e.venue,
       e.price_inr, e.seats,
       p.name as organizer_name,
       e.seats
         - (select count(*) from tickets t
              where t.event_id = e.id and t.status <> 'refunded')::int
         - (select count(*) from event_reservations r
              where r.event_id = e.id and r.status = 'pending' and r.expires_at > now())::int
         as seats_left
from events e
join profiles p on p.id = e.organizer_id;

create or replace function create_event_reservation(p_event_id uuid)
returns table(reservation_id uuid, amount_paise bigint, event_title text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_event events%rowtype;
  v_sold bigint;
  v_reserved bigint;
  v_reservation_id uuid;
begin
  if v_user_id is null then raise exception 'Please log in before booking'; end if;

  select e.* into v_event from events e where e.id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.starts_at <= now() then raise exception 'This event has already started'; end if;
  if v_event.price_inr < 1 then
    raise exception 'Paid checkout requires a ticket price of at least ₹1';
  end if;

  update event_reservations set status = 'failed'
    where event_id = v_event.id and user_id = v_user_id and status = 'pending';

  select count(*) into v_sold from tickets t
    where t.event_id = v_event.id and t.status <> 'refunded';
  select count(*) into v_reserved from event_reservations r
    where r.event_id = v_event.id and r.status = 'pending' and r.expires_at > now();
  if v_sold + v_reserved >= v_event.seats then raise exception 'Sold out'; end if;

  insert into event_reservations(event_id, user_id, amount_paise)
    values (v_event.id, v_user_id, v_event.price_inr::bigint * 100)
    returning id into v_reservation_id;
  return query select v_reservation_id, v_event.price_inr::bigint * 100, v_event.title;
end
$$;
revoke all on function create_event_reservation(uuid) from public, anon;
grant execute on function create_event_reservation(uuid) to authenticated;

create or replace function complete_event_reservation(
  p_reservation_id uuid,
  p_razorpay_order_id text,
  p_payment_id text
) returns table(result_status text, ticket_id text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation event_reservations%rowtype;
  v_event events%rowtype;
  v_sold bigint;
  v_other_reservations bigint;
  v_ticket_id text;
begin
  select r.* into v_reservation from event_reservations r
    where r.id = p_reservation_id for update;
  if not found then raise exception 'Booking reservation not found'; end if;
  if v_reservation.razorpay_order_id is distinct from p_razorpay_order_id then
    raise exception 'Payment order does not match the booking';
  end if;

  if v_reservation.status = 'paid' then
    if v_reservation.payment_id is distinct from p_payment_id then
      raise exception 'Booking was completed with a different payment';
    end if;
    select t.id into v_ticket_id from tickets t where t.payment_id = p_payment_id;
    return query select 'paid'::text, v_ticket_id;
    return;
  end if;
  if v_reservation.status not in ('pending','failed') then
    return query select v_reservation.status, null::text;
    return;
  end if;

  select e.* into v_event from events e where e.id = v_reservation.event_id for update;
  select count(*) into v_sold from tickets t
    where t.event_id = v_event.id and t.status <> 'refunded';
  select count(*) into v_other_reservations from event_reservations r
    where r.event_id = v_event.id and r.id <> v_reservation.id
      and r.status = 'pending' and r.expires_at > now();

  if v_sold + v_other_reservations >= v_event.seats then
    update event_reservations set status = 'refund_required',
      payment_id = p_payment_id, refund_claimed_at = null
      where id = v_reservation.id;
    return query select 'refund_required'::text, null::text;
    return;
  end if;

  v_ticket_id := 'OP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  insert into tickets(id, event_id, user_id, payment_id)
    values (v_ticket_id, v_event.id, v_reservation.user_id, p_payment_id);
  update event_reservations set status = 'paid', payment_id = p_payment_id
    where id = v_reservation.id;
  return query select 'paid'::text, v_ticket_id;
end
$$;
revoke all on function complete_event_reservation(uuid, text, text)
  from public, anon, authenticated;
grant execute on function complete_event_reservation(uuid, text, text)
  to service_role;

create or replace function claim_event_refund(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update event_reservations set refund_claimed_at = now()
    where id = p_reservation_id and status = 'refund_required'
      and (refund_claimed_at is null
        or refund_claimed_at < now() - interval '5 minutes');
  return found;
end
$$;
revoke all on function claim_event_refund(uuid) from public, anon, authenticated;
grant execute on function claim_event_refund(uuid) to service_role;

grant usage on schema public to anon, authenticated;
grant select on public.events_public to anon, authenticated;
-- ============ ORGANIZER: DELETE OWN EVENT ============
-- Direct deletes are not allowed (they could orphan paid tickets and in-flight payments);
-- organizers delete through this function, which refuses when money may be involved.
drop policy if exists "organizers delete own" on events;

create or replace function public.delete_own_event(p_event_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_event events%rowtype;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select * into v_event from events where id = p_event_id for update;
  if not found then raise exception 'Event not found'; end if;
  if v_event.organizer_id <> auth.uid() then raise exception 'You can only delete your own events'; end if;
  if exists (select 1 from tickets where event_id = p_event_id) then
    raise exception 'Tickets have already been sold for this event, so it cannot be deleted. Refund the buyers first.';
  end if;
  if exists (select 1 from event_reservations where event_id = p_event_id
      and (status = 'refund_required'
           or (status in ('pending','failed') and created_at > now() - interval '1 day'))) then
    raise exception 'There is recent payment activity on this event. Please try again after 24 hours.';
  end if;
  delete from events where id = p_event_id;
end $$;
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
