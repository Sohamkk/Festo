# Occasion Pass: connected to Supabase

## Run it in 5 steps
1. Create a Supabase project (supabase.com > New project).
2. SQL Editor > New query > paste all of `database.sql` > Run for a new project. For an existing project, apply any missing `ADDED IN V2` migration and the `RAZORPAY CHECKOUT` section at the bottom.
3. Authentication > Providers: keep **Email** on. For quick testing, turn **Confirm email** off (Authentication > Sign In / Providers > Email).
4. Project Settings > API: copy the Project URL and the anon (publishable) key into `config.js`.
5. Put the whole folder on Vercel or Netlify (drag and drop). You can also run it locally with: `npx serve .` inside this folder, then open the address it shows.
   Do not open index.html by double-clicking: some browsers block the login on file:// addresses.

In Supabase, set Authentication > URL Configuration > Site URL to the address where you run it.

## Publish an event and sell a ticket
1. Complete the Razorpay and Supabase Edge Function setup in `SETUP-GUIDE.md` (Razorpay Test Mode is suitable for testing).
2. Register as an **Organizer**, open **Organizer dashboard**, and create an event. Select its category/occasion, date and time, venue, ticket price, and available ticket count.
3. Open the site in a second browser (or private window), choose the event category, and register as a Student or Member.
4. Select the event and complete Razorpay Checkout. The server verifies the captured payment before it creates the ticket. The QR ticket appears in the account and can be downloaded; it is also available from the profile later.

## Important
- Do not accept real payments until the Razorpay account is approved, Edge Function secrets are configured, the database migration is applied, and the webhook is receiving `payment.captured` events.
- Organizer ticket sales are collected into the single platform Razorpay account. This setup does not make organizer payouts.
- Phone OTP only works after you connect an SMS provider (SETUP-GUIDE.md, Step 2). Email login works straight away.
- Only the anon key goes in `config.js`. Never put the service_role key in the website.
