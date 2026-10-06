# Occasion Pass: connected to Supabase

## Run it in 5 steps
1. Create a Supabase project (supabase.com > New project).
2. SQL Editor > New query > paste all of `database.sql` > Run.
   (If you already ran an older `database.sql`, run only the part below the line "ADDED IN V2".)
3. Authentication > Providers: keep **Email** on. For quick testing, turn **Confirm email** off (Authentication > Sign In / Providers > Email).
4. Project Settings > API: copy the Project URL and the anon (publishable) key into `config.js`.
5. Put the whole folder on Vercel or Netlify (drag and drop). You can also run it locally with: `npx serve .` inside this folder, then open the address it shows.
   Do not open index.html by double-clicking: some browsers block the login on file:// addresses.

In Supabase, set Authentication > URL Configuration > Site URL to the address where you run it.

## Test it
1. Register as an **Organizer** in one browser and publish an event.
2. In a second browser (or private window), open the same festival. The event appears for everyone.
3. Register as a Student there, book the event, and download the ticket.

## Important
- Booking is in **TEST MODE**: it creates a free ticket with no payment. Do not launch publicly like this.
  Add Razorpay first (see SETUP-GUIDE.md, Step 4), then run `drop function book_ticket_test(uuid);` in the SQL Editor.
- Phone OTP only works after you connect an SMS provider (SETUP-GUIDE.md, Step 2). Email login works straight away.
- Only the anon key goes in `config.js`. Never put the service_role key in the website.
