import { admin, finalize, hmac } from "../_shared/razorpay.ts";

// Backup path: if the customer closes the tab after paying, Razorpay calls this and the ticket is still issued.
Deno.serve(async (req) => {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (sig !== await hmac(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!, raw)) return new Response("bad signature", { status: 401 });
  const ev = JSON.parse(raw);
  if (ev.event !== "payment.captured") return new Response("ignored");
  const pay = ev.payload.payment.entity;
  const sb = admin();
  const { data: res } = await sb.from("event_reservations").select("id").eq("razorpay_order_id", pay.order_id).maybeSingle();
  if (!res) return new Response("unknown order");
  try { await finalize(sb, res.id, pay.order_id, pay.id); }
  catch (e) { return new Response(String((e as Error).message), { status: 500 }); }
  return new Response("ok");
});
