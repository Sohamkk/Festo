import {
  adminClient,
  constantTimeEqual,
  corsHeaders,
  jsonResponse,
  razorpayAuthorization,
  webhookSignature,
} from "../_shared/server.ts";

type CapturedPayment = {
  id?: string;
  order_id?: string;
  amount?: number;
  amount_refunded?: number;
  currency?: string;
  status?: string;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("X-Razorpay-Signature");
    if (!signature || !constantTimeEqual(await webhookSignature(rawBody), signature.toLowerCase())) {
      return jsonResponse({ error: "Invalid webhook signature" }, 400);
    }

    let payload: {
      event?: string;
      payload?: { payment?: { entity?: CapturedPayment } };
    };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return jsonResponse({ error: "Invalid webhook payload" }, 400);
    }
    if (payload.event !== "payment.captured") return jsonResponse({ received: true });

    const payment = payload.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || payment.status !== "captured") {
      return jsonResponse({ error: "Captured payment details are missing" }, 400);
    }

    const admin = adminClient();
    const { data: reservation, error: reservationError } = await admin
      .from("event_reservations")
      .select("id,amount_paise,razorpay_order_id,payment_id,status")
      .eq("razorpay_order_id", payment.order_id)
      .maybeSingle();
    if (reservationError) {
      console.error("Could not load webhook reservation", reservationError);
      return jsonResponse({ error: "Could not process payment event" }, 500);
    }
    if (!reservation) {
      console.warn("Ignoring captured payment for an unknown order", payment.order_id);
      return jsonResponse({ received: true });
    }
    if (reservation.status === "refunded") return jsonResponse({ received: true, refunded: true });
    if (payment.amount !== Number(reservation.amount_paise) || payment.currency !== "INR" ||
      (reservation.payment_id && reservation.payment_id !== payment.id)) {
      console.error("Captured payment does not match reservation", {
        orderId: payment.order_id,
        paymentId: payment.id,
      });
      return jsonResponse({ error: "Captured payment does not match reservation" }, 400);
    }

    const { data: completionRows, error: completionError } = await admin.rpc(
      "complete_event_reservation",
      {
        p_reservation_id: reservation.id,
        p_razorpay_order_id: payment.order_id,
        p_payment_id: payment.id,
      },
    );
    if (completionError) {
      console.error("Webhook could not complete captured payment", completionError);
      return jsonResponse({ error: "Could not complete ticket booking" }, 500);
    }
    const completion = Array.isArray(completionRows) ? completionRows[0] : completionRows;
    if (completion?.result_status === "paid") return jsonResponse({ received: true });
    if (completion?.result_status !== "refund_required") {
      console.error("Unexpected webhook completion result", completion);
      return jsonResponse({ error: "Unexpected booking state" }, 500);
    }

    const { data: refundClaimed, error: claimError } = await admin.rpc(
      "claim_event_refund",
      { p_reservation_id: reservation.id },
    );
    if (claimError) {
      console.error("Webhook could not claim refund processing", claimError);
      return jsonResponse({ error: "Could not claim refund processing" }, 500);
    }
    if (!refundClaimed) return jsonResponse({ received: true, refund_pending: true });

    const authorization = razorpayAuthorization();
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.id)}`,
      { headers: { Authorization: authorization } },
    );
    const currentPayment: CapturedPayment = await paymentResponse.json();
    if (!paymentResponse.ok || currentPayment.status !== "captured" ||
      currentPayment.order_id !== payment.order_id || currentPayment.amount !== payment.amount) {
      console.error("Could not confirm payment before refund", currentPayment);
      const { error: releaseError } = await admin.from("event_reservations")
        .update({ refund_claimed_at: null }).eq("id", reservation.id)
        .eq("status", "refund_required");
      if (releaseError) console.error("Could not release unconfirmed webhook refund claim", releaseError);
      return jsonResponse({ error: "Could not confirm payment for refund" }, 502);
    }
    const amountToRefund = Number(reservation.amount_paise) - Number(currentPayment.amount_refunded || 0);
    if (amountToRefund > 0) {
      const refundResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(payment.id)}/refund`,
        {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: amountToRefund }),
        },
      );
      const refund = await refundResponse.json();
      if (!refundResponse.ok) {
        console.error("Webhook automatic refund failed", refund);
        const { error: releaseError } = await admin.from("event_reservations")
          .update({ refund_claimed_at: null }).eq("id", reservation.id)
          .eq("status", "refund_required");
        if (releaseError) console.error("Could not release failed webhook refund claim", releaseError);
        return jsonResponse({ error: "Could not initiate refund" }, 502);
      }
    }
    const { error: updateError } = await admin.from("event_reservations")
      .update({ status: "refunded", refund_claimed_at: null })
      .eq("id", reservation.id)
      .eq("status", "refund_required");
    if (updateError) {
      console.error("Refund succeeded but reservation status was not updated", updateError);
      return jsonResponse({ error: "Could not update refunded booking state" }, 500);
    }
    return jsonResponse({ received: true, refunded: true });
  } catch (error) {
    console.error("Payment webhook failed", error);
    return jsonResponse({ error: "Could not process payment webhook" }, 500);
  }
});
