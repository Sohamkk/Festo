# Occasion Pass: Supabase and Razorpay setup

The website already uses Supabase for accounts, events, and tickets. Follow this guide to configure the Supabase project and enable Razorpay checkout, server-side payment verification, and the payment webhook.

## Step 1. Create the database (free, about 15 minutes)
1. Go to supabase.com and create an account, then click **New project**. Choose a strong database password and a region close to India (Mumbai if offered).
2. Open **SQL Editor > New query**, paste everything from `database.sql`, and click **Run**. Do this full-file setup only for a new/empty project. If Occasion Pass tables already exist, apply only the missing migration sections described in `START-HERE.md`; do not rerun the initial `create table` statements.
3. Open **Project Settings > API** and copy the **Project URL** and the **anon public key**. The anon key is safe to put in website code. The **service_role key** is secret: never put it in the website.

What this gives you: events are public to read, only organizers can create them, and every created event appears for all visitors on its festival page.

## Step 2. Accounts and OTP login
1. Open **Authentication > Providers**.
2. Start with **Email**: turn on "Confirm email" so people verify through a link or code. This is free.
3. For phone OTP, turn on **Phone** and connect an SMS provider. Supabase supports Twilio, MessageBird, Vonage and TextLocal. Add the provider's keys in the same screen.
4. India has a rule that SMS senders must be registered on DLT (TRAI). You register your business name as a sender ID and get your OTP message template approved. This usually takes a few days, so start it early. MSG91 and Twilio both guide you through it.
5. While waiting, use Supabase's test phone numbers (Authentication > Phone) so you can build and test with fixed OTPs.

In code, the calls replace the demo OTP in `app.js`:
- Send OTP: `supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })`
- Verify OTP: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
- Email and password: `supabase.auth.signUp({ email, password })` and `signInWithPassword`
- After sign-up, save the name and category in the `profiles` table.

## Step 3. Connect the website to Supabase
1. Confirm `config.js` contains the Supabase **Project URL** (the base project URL, without `/rest/v1/`) and the anon/public key.
2. The site already uses Supabase Auth, the `events_public` view, and the `events` and `tickets` tables. The organizer dashboard publishes categorized events, and attendees can see them under the matching occasion.
3. Test with two different browsers: publish an event as an organizer in one, then confirm it appears under its category in the other.

## Step 4. Real payments with Razorpay
1. Create a Razorpay account. Start with **Test Mode** and copy its Key ID and Key Secret.
2. In Supabase SQL Editor, run the complete `RAZORPAY CHECKOUT` section at the bottom of `database.sql`, including its `events_public` view and grants. This installs the public event view, temporary seat reservations, refreshes the schema cache, and removes the old test-only free-ticket function. If this is a new project, run the whole file instead.
3. Install the Supabase CLI, sign in, and link this project from the project folder:
   ```sh
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
4. Save Razorpay credentials as **Edge Function secrets**. Never put the Key Secret or the Supabase service-role key in `config.js` or browser code:
   ```sh
   npx supabase secrets set RAZORPAY_KEY_ID=rzp_test_your_key_id RAZORPAY_KEY_SECRET=your_test_key_secret
   ```
   Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions automatically.
5. Deploy the three functions:
   ```sh
   npx supabase functions deploy create-order
   npx supabase functions deploy verify-payment
   npx supabase functions deploy payment-webhook
   ```
6. In Razorpay Dashboard > **Account & Settings > Webhooks**, add:
   `https://YOUR_PROJECT_REF.supabase.co/functions/v1/payment-webhook`
   Subscribe to `payment.captured`. Create a webhook secret and save that exact value in Supabase:
   ```sh
   npx supabase secrets set RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```
   The webhook function is configured to skip Supabase JWT verification; it validates Razorpay's webhook signature instead.
7. Keep the Supabase Project URL and anon/public key in `config.js`. The `create-order` function calculates the event price from the database; the browser cannot choose the amount. Razorpay signatures and captured payment status are verified on the server before a ticket is created.
8. Run the complete flow in Razorpay **Test Mode**: create an event as an organizer, book it as a student/member, complete the test checkout, then verify that the QR ticket appears and can be downloaded.

Payments go to the single Razorpay account configured above; this version does not automatically split or pay out funds to organizers. Razorpay Route marketplace approval and a payout design are required for that.

## Step 5. QR check-in at the gate
1. The ticket QR already holds the ticket ID.
2. Build a small **scanner page** for organizers that reads the QR with the phone camera (the html5-qrcode library works well).
3. It calls an Edge Function that checks the ticket is `valid` for that event, marks it `used`, and shows a green or red result. This stops the same ticket being used twice.

## Step 6. Go live
1. Upload the three website files to **Vercel** or **Netlify** (both free). Drag and drop works.
2. Buy a domain (about ₹800 a year) and connect it in the hosting settings.
3. Add Privacy Policy, Terms, and Refund Policy pages. Razorpay and SMS providers will ask for them.
4. Talk to a CA about GST and about how you invoice commissions.

## Before your first paid event
- Decide your refund rule (for example, full refund up to 48 hours before).
- Show the organizer's name and contact on every event page.
- Manually approve the first organizers so fake events don't appear.
- Run one small real event yourself and test every step from booking to entry.
