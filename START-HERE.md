# Occasion Pass: connected to Supabase

## Fix: "Could not find the table 'public.events_public' in the schema cache"
The website can reach Supabase, but the database view it reads has not been created. In Supabase, open **SQL Editor > New query**, paste the full `database.sql`, and press **Run** only if this is a new/empty project; then reload the website.

If you have already created the Occasion Pass tables, do not rerun the full file. Run `database-upgrade.sql` in SQL Editor instead. It does not recreate `profiles`, `events`, or `tickets`; it creates/grants `events_public`, installs the paid-booking schema, and refreshes the schema cache. It is safe to rerun if a prior migration attempt only partly completed.

## Fix: "Could not find the function public.delete_own_event in the schema cache"
The organizer-delete database function has not been installed in Supabase yet. Run `database-delete-event-fix.sql` in **SQL Editor > New query**, then wait a few seconds and reload the website. This patch only adds the protected event-delete function and refreshes the schema cache; it does not recreate any tables.

## Payments need the Edge Functions
The folder `supabase/functions` contains `create-order`, `verify-payment` and `payment-webhook`. Deploy them as described in SETUP-GUIDE.md Step 4. Without them the Pay button cannot open Razorpay.

## How booking works
- Payment succeeds and is verified on the server: the ticket with QR is shown and saved in Profile.
- Payment fails (bank decline, cancelled): no ticket is created and the seat is released. The student can try again.
- Money taken but the event sold out meanwhile: refunded automatically.

## Run it in 5 steps
1. Create a Supabase project (supabase.com > New project).
2. For a new project, run all of `database.sql` in SQL Editor. For an existing project, run `database-upgrade.sql` instead; do not rerun the initial table-creation statements.
3. Authentication > Providers: keep **Email** on. For quick testing, turn **Confirm email** off (Authentication > Sign In / Providers > Email).
4. Project Settings > API: copy the Project URL and the anon (publishable) key into `config.js`.
5. Put the whole folder on Vercel or Netlify (drag and drop). You can also run it locally with: `npx serve .` inside this folder, then open the address it shows.
   Do not open index.html by double-clicking: some browsers block the login on file:// addresses.

In Supabase, set Authentication > URL Configuration > Site URL to the address where you run it.

## Publish an event and sell a ticket
1. Complete the Razorpay and Supabase Edge Function setup in `SETUP-GUIDE.md` (Razorpay Test Mode is suitable for testing).
2. Register as an **Organizer**, open **Organizer dashboard**, and create an event. Select its category/occasion, date and time, venue, ticket price, and available ticket count.
3. Open the same deployed website in a second browser (or private window), choose **All events**, and register as a Student or Member. The event list refreshes automatically every 20 seconds; use **Refresh events** to check immediately after publishing.
4. Select the event and complete Razorpay Checkout. The server verifies the captured payment before it creates the ticket. The QR ticket appears in the account and can be downloaded; it is also available from the profile later.

## Important
- Do not accept real payments until the Razorpay account is approved, Edge Function secrets are configured, the database migration is applied, and the webhook is receiving `payment.captured` events.
- Organizer ticket sales are collected into the single platform Razorpay account. This setup does not make organizer payouts.
- Sign-in and registration use email and password only (SETUP-GUIDE.md, Step 2).
- Only the anon key goes in `config.js`. Never put the service_role key in the website.
