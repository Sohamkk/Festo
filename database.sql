-- Occasion Pass database. Run this in Supabase: SQL Editor > New query > paste > Run.

create table profiles(
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  category text not null check (category in ('student','professional','other','organizer')),
  phone text unique,
  phone_verified boolean not null default false,
  created_at timestamptz default now());

create table events(
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references profiles(id),
  festival text not null,
  title text not null,
  starts_at timestamptz not null,
  venue text not null,
  price_inr int not null check (price_inr >= 0),
  seats int not null check (seats > 0),
  created_at timestamptz default now());

create table tickets(
  id text primary key,
  event_id uuid not null references events(id),
  user_id uuid not null references profiles(id),
  payment_id text unique,
  status text not null default 'valid' check (status in ('valid','used','refunded')),
  used_at timestamptz,
  created_at timestamptz default now());

alter table profiles enable row level security;
alter table events   enable row level security;
alter table tickets  enable row level security;

create policy "read own profile"   on profiles for select using (auth.uid() = id);
create policy "create own profile" on profiles for insert with check (auth.uid() = id and phone_verified = false);

-- Everyone can see events. Only organizers can create them, and only edit their own.
create policy "events are public" on events for select using (true);
create policy "organizers create" on events for insert with check (
  organizer_id = auth.uid() and exists (select 1 from profiles p where p.id = auth.uid() and p.category = 'organizer'));
create policy "organizers edit own"   on events for update using (organizer_id = auth.uid());
create policy "organizers delete own" on events for delete using (organizer_id = auth.uid());

-- People see their own tickets, organizers see tickets for their events.
-- No insert policy on purpose: tickets are created only by the server after payment succeeds.
create policy "own or organizer tickets" on tickets for select using (
  user_id = auth.uid() or exists (select 1 from events e where e.id = event_id and e.organizer_id = auth.uid()));

create function seats_left(eid uuid) returns int language sql security definer stable as $$
  select e.seats - count(t.id)::int from events e
  left join tickets t on t.event_id = e.id and t.status <> 'refunded'
  where e.id = eid group by e.seats $$;


-- ============ ADDED IN V2 (if you already ran the file above once, run only from this line down) ============

-- 1) Creates a profile automatically when someone signs up (name and category come from the sign-up form).
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, name, category, phone)
  values (new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), 'Member'),
    case when new.raw_user_meta_data->>'category' in ('student','professional','other','organizer')
         then new.raw_user_meta_data->>'category' else 'other' end,
    nullif(new.phone,''));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- 2) Public list of events with organizer name and seats left. This is what the website reads.
create or replace view events_public as
select e.id, e.organizer_id, e.festival, e.title, e.starts_at, e.venue, e.price_inr, e.seats,
       p.name as organizer_name,
       e.seats - (select count(*) from tickets t where t.event_id = e.id and t.status <> 'refunded')::int as seats_left
from events e join profiles p on p.id = e.organizer_id;
grant select on events_public to anon, authenticated;

-- 3) TEST MODE booking: creates a ticket with NO payment. Delete this function when Razorpay goes live:
--    drop function book_ticket_test(uuid);
create or replace function book_ticket_test(eid uuid) returns text language plpgsql security definer set search_path = public as $$
declare tid text; n int;
begin
  if auth.uid() is null then raise exception 'Please log in first'; end if;
  select seats_left(eid) into n;
  if n is null or n < 1 then raise exception 'Sold out'; end if;
  tid := 'OP-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  insert into tickets(id, event_id, user_id, payment_id) values (tid, eid, auth.uid(), 'TEST-' || tid);
  return tid;
end $$;
