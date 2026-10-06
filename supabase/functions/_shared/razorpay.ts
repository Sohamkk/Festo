import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
// Always HTTP 200 so the website can read { error } messages.
export const json = (b: unknown) =>
  new Response(JSON.stringify(b), { headers: { ...cors, "Content-Type": "application/json" } });

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

export async function rz(path: string, method = "GET", body?: unknown) {
  const auth = btoa(`${Deno.env.get("RAZORPAY_KEY_ID")}:${Deno.env.get("RAZORPAY_KEY_SECRET")}`);
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, data: await res.json().catch(() => ({})) };
}

export async function hmac(secret: string, text: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Creates the ticket (only if a seat is still free). If sold out, refunds the payment.
export async function finalize(sb: ReturnType<typeof admin>, resId: string, orderId: string, paymentId: string) {
  const { data, error } = await sb.rpc("complete_event_reservation",
    { p_reservation_id: resId, p_razorpay_order_id: orderId, p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  const r = data[0];
  if (r.result_status === "refund_required") {
    const { data: claimed } = await sb.rpc("claim_event_refund", { p_reservation_id: resId });
    if (claimed) {
      const x = await rz(`/payments/${paymentId}/refund`, "POST", { notes: { reason: "Event sold out" } });
      if (x.ok || JSON.stringify(x.data).includes("already")) {
        await sb.from("event_reservations").update({ status: "refunded" }).eq("id", resId);
      }
    }
    return { ticket_id: null, message: "The event sold out while you paid. Your payment is being refunded automatically." };
  }
  if (r.result_status === "paid") return { ticket_id: r.ticket_id };
  return { ticket_id: null, message: `Booking status: ${r.result_status}. No ticket was issued.` };
}
