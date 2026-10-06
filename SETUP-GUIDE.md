# Occasion Pass: from prototype to a real website

The files in this folder:
- `index.html`, `style.css`, `app.js`: the website. Open `index.html` in a browser to try it.
- `database.sql`: the database tables and security rules for Supabase.
- `SETUP-GUIDE.md`: this guide.

Right now `app.js` saves data in each visitor's own browser. That is why an event an organizer creates is not yet visible to other people. Steps 1 to 6 below fix this.

## Step 1. Create the database (free, about 15 minutes)
1. Go to supabase.com and create an account, then click **New project**. Choose a strong database password and a region close to India (Mumbai if offered).
2. Open **SQL Editor > New query**, paste everything from `database.sql`, and click **Run**.
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

## Step 3. Connect the website to the database
1. Add this line in `index.html` before `app.js`: `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
2. In `app.js`, create the client with your Project URL and anon key.
3. Replace the browser-saving parts with database calls:
   - Show events: `supabase.from('events').select('*').eq('festival', theme)`
   - Organizer creates an event: `supabase.from('events').insert({...})`
   - My tickets: `supabase.from('tickets').select('*, events(*)')`
4. Test with two different browsers: create an event as an organizer in one, and open the festival page in the other. It should appear.

## Step 4. Real payments with Razorpay
1. Create a Razorpay account and complete business KYC. You can build and test with **Test Mode** before KYC is approved.
2. Never mark a ticket as paid from the website. The website opens Razorpay Checkout, and your **server** confirms the payment.
3. In Supabase, create two **Edge Functions**:
   - `create-order`: creates a Razorpay order for the event price.
   - `payment-webhook`: Razorpay calls it after a successful payment. It checks the signature, checks seats are left, and then inserts the ticket into `tickets` using the service_role key.
4. Keep your Razorpay secret key only inside Edge Function secrets.
5. To pay organizers, look at Razorpay Route (marketplace payouts). It needs approval, so ask Razorpay about it early. You keep your commission and the rest goes to the organizer.

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
