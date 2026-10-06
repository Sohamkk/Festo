import {
  adminClient,
  authenticatedUser,
  constantTimeEqual,
  corsHeaders,
  jsonResponse,
  razorpayAuthorization,
  razorpaySignature,
} from "../_shared/server.ts";

type RazorpayPayment = {
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
    const auth = await authenticatedUser(req);
    if (!auth) return jsonResponse({ error: "Sign in to verify this payment" }, 401);

    let body: {
      reservation_id?: unknown;
      razorpay_order_id?: unknown;
      razorpay_payment_id?: unknown;
      razorpay_signature?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON request" }, 400);
    }
    const { reservation_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
    if (typeof reservation_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reservation_id) ||
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !/^[0-9a-f]{64}$/i.test(razorpay_signature)) {
      return jsonResponse({ error: "Invalid Razorpay payment response" }, 400);
    }

    const admin = adminClient();
    const { data: reservation, error: reservationError } = await admin
      .from("event_reservations")
      .select("id,user_id,amount_paise,razorpay_order_id,payment_id,status")
      .eq("id", reservation_id)
      .maybeSingle();
    if (reservationError) {
      console.error("Could not load payment reservation", reservationError);
      return jsonResponse({ error: "Could not verify the booking. Please contact support." }, 500);
    }
    if (!reservation || reservation.user_id !== auth.user.id) {
      return jsonResponse({ error: "Booking reservation not found" }, 404);
    }
    if (reservation.razorpay_order_id !== razorpay_order_id) {
      return jsonResponse({ error: "Payment order does not match this booking" }, 400);
    }
    if (reservation.payment_id && reservation.payment_id !== razorpay_payment_id) {
      return jsonResponse({ error: "This booking is linked to a different payment" }, 409);
    }
    if (reservation.status === "failed" || reservation.status === "refunded") {
      return jsonResponse({ error: "This booking can no longer be completed" }, 409);
    }

    const expectedSignature = await razorpaySignature(razorpay_order_id, razorpay_payment_id);
    if (!constantTimeEqual(expectedSignature, razorpay_signature.toLowerCase())) {
      return jsonResponse({ error: "Razorpay payment signature is invalid" }, 400);
    }

    const authorization = razorpayAuthorization();
    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`,
      { headers: { Authorization: authorization } },
    );
    let payment: RazorpayPayment = await paymentResponse.json();
    if (!paymentResponse.ok || payment.order_id !== razorpay_order_id ||
      payment.amount !== Number(reservation.amount_paise) || payment.currency !== "INR") {
      console.error("Razorpay payment does not match reservation", payment);
      return jsonResponse({ error: "Payment details do not match this event booking" }, 400);
    }

    if (payment.status === "authorized") {
      const captureResponse = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}/capture`,
        {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ amount: payment.amount, currency: "INR" }),
        },
      );
      payment = await captureResponse.json();
      if (!captureResponse.ok) {
        console.error("Razorpay capture failed", payment);
        return jsonResponse({
          error: "Payment is authorized but not captured yet. Please retry verification or contact support.",
        }, 409);
      }
    }
    if (payment.status !== "captured" || payment.order_id !== razorpay_order_id ||
      payment.amount !== Number(reservation.amount_paise) || payment.currency !== "INR") {
      return jsonResponse({ error: "Razorpay has not confirmed a captured payment" }, 409);
    }

    const { data: completionRows, error: completionError } = await admin.rpc(
      "complete_event_reservation",
      {
        p_reservation_id: reservation.id,
        p_razorpay_order_id: razorpay_order_id,
        p_payment_id: razorpay_payment_id,
      },
    );
    if (completionError) {
      console.error("Captured payment could not be converted to a ticket", completionError);
      return jsonResponse({
        error: `Payment ${razorpay_payment_id} was captured, but ticket confirmation failed. Contact support.`,
      }, 500);
    }
    const completion = Array.isArray(completionRows) ? completionRows[0] : completionRows;
    if (completion?.result_status === "paid" && completion.ticket_id) {
      return jsonResponse({ ticket_id: completion.ticket_id, status: "paid" });
    }
    if (completion?.result_status === "refund_required") {
      const { data: refundClaimed, error: claimError } = await admin.rpc(
        "claim_event_refund",
        { p_reservation_id: reservation.id },
      );
      if (claimError) {
        console.error("Could not claim refund processing", claimError);
        return jsonResponse({ error: "Payment was received; refund processing needs support." }, 500);
      }
      if (!refundClaimed) {
        return jsonResponse({
          status: "refund_pending",
          message: "Payment was received and its refund is already being processed.",
        }, 409);
      }

      const amountToRefund = Number(reservation.amount_paise) - Number(payment.amount_refunded || 0);
      if (amountToRefund > 0) {
        const refundResponse = await fetch(
          `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}/refund`,
          {
            method: "POST",
            headers: { Authorization: authorization, "Content-Type": "application/json" },
            body: JSON.stringify({ amount: amountToRefund }),
          },
        );
        const refund = await refundResponse.json();
        if (!refundResponse.ok) {
          console.error("Automatic refund failed; manual refund is required", refund);
          const { error: releaseError } = await admin.from("event_reservations")
            .update({ refund_claimed_at: null }).eq("id", reservation.id)
            .eq("status", "refund_required");
          if (releaseError) console.error("Could not release failed refund claim", releaseError);
          return jsonResponse({
            error: `Payment ${razorpay_payment_id} was captured but no ticket was available. Contact support for a refund.`,
          }, 502);
        }
      }
      const { error: refundUpdateError } = await admin.from("event_reservations")
        .update({ status: "refunded", refund_claimed_at: null })
        .eq("id", reservation.id)
        .eq("status", "refund_required");
      if (refundUpdateError) console.error("Refund succeeded but reservation status was not updated", refundUpdateError);
      return jsonResponse({
        status: "refunded",
        message: "The event sold out while payment was completing. A refund has been initiated.",
      }, 409);
    }

    console.error("Unexpected reservation completion result", completion);
    return jsonResponse({ error: "Could not confirm the ticket. Please contact support." }, 500);
  } catch (error) {
    console.error("Payment verification function failed", error);
    return jsonResponse({ error: "Could not verify payment. Please contact support before retrying payment." }, 500);
  }
});
