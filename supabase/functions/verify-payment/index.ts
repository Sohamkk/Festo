import { createClient } from "npm:@supabase/supabase-js@2";
import { admin, cors, finalize, hmac, json, rz } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user: u } } = await user.auth.getUser();
    if (!u) return json({ error: "Please log in again." });
    const b = await req.json();
    const sb = admin();
    const { data: res } = await sb.from("event_reservations").select("*").eq("id", b.reservation_id).maybeSingle();
    if (!res || res.user_id !== u.id || res.razorpay_order_id !== b.razorpay_order_id)
      return json({ error: "This payment does not match your booking." });
    const expected = await hmac(Deno.env.get("RAZORPAY_KEY_SECRET")!, `${b.razorpay_order_id}|${b.razorpay_payment_id}`);
    if (expected !== b.razorpay_signature) return json({ error: "Payment signature is invalid. No ticket issued." });
    let p = await rz(`/payments/${b.razorpay_payment_id}`);
    if (p.ok && p.data.status === "authorized")
      p = await rz(`/payments/${b.razorpay_payment_id}/capture`, "POST", { amount: p.data.amount, currency: p.data.currency });
    if (!p.ok || p.data.status !== "captured" || p.data.order_id !== b.razorpay_order_id ||
        Number(p.data.amount) !== Number(res.amount_paise))
      return json({ error: "Payment was not completed. No ticket issued." });
    return json(await finalize(sb, res.id, b.razorpay_order_id, b.razorpay_payment_id));
  } catch (e) { return json({ error: String((e as Error).message ?? e) }); }
});
