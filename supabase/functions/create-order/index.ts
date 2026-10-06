import { createClient } from "npm:@supabase/supabase-js@2";
import { admin, cors, json, rz } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { event_id } = await req.json();
    // Price is read from the database here, never from the browser.
    const { data, error } = await user.rpc("create_event_reservation", { p_event_id: event_id });
    if (error) return json({ error: error.message });
    const r = data[0];
    const sb = admin();
    const o = await rz("/orders", "POST", {
      amount: Number(r.amount_paise), currency: "INR",
      receipt: String(r.reservation_id).slice(0, 40), notes: { reservation_id: r.reservation_id },
    });
    if (!o.ok) {
      await sb.from("event_reservations").update({ status: "failed" }).eq("id", r.reservation_id);
      return json({ error: o.data?.error?.description ?? "Could not create the payment order." });
    }
    await sb.from("event_reservations").update({ razorpay_order_id: o.data.id }).eq("id", r.reservation_id);
    return json({ key_id: Deno.env.get("RAZORPAY_KEY_ID"), order_id: o.data.id, amount: o.data.amount,
      currency: o.data.currency, reservation_id: r.reservation_id, event_title: r.event_title });
  } catch (e) { return json({ error: String((e as Error).message ?? e) }); }
});
