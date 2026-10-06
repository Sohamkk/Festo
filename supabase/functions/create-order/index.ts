import {
  adminClient,
  authenticatedUser,
  corsHeaders,
  jsonResponse,
  razorpayAuthorization,
  requiredEnv,
} from "../_shared/server.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const auth = await authenticatedUser(req);
    if (!auth) return jsonResponse({ error: "Sign in to book this event" }, 401);

    let body: { event_id?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON request" }, 400);
    }
    if (typeof body.event_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.event_id)) {
      return jsonResponse({ error: "A valid event ID is required" }, 400);
    }

    const keyId = requiredEnv("RAZORPAY_KEY_ID");
    const authorization = razorpayAuthorization();
    const admin = adminClient();
    const { data: reservationRows, error: reserveError } = await auth.client.rpc(
      "create_event_reservation",
      { p_event_id: body.event_id },
    );
    if (reserveError) {
      return jsonResponse({ error: reserveError.message }, 409);
    }
    const reservation = Array.isArray(reservationRows) ? reservationRows[0] : reservationRows;
    if (!reservation?.reservation_id || !reservation.event_title) {
      console.error("Reservation RPC returned no reservation", reservationRows);
      return jsonResponse({ error: "Could not reserve a ticket for this event" }, 500);
    }
    const amount = Number(reservation.amount_paise);
    if (!Number.isSafeInteger(amount) || amount < 100) {
      const { error } = await admin.from("event_reservations")
        .update({ status: "failed" }).eq("id", reservation.reservation_id);
      if (error) console.error("Could not release invalid reservation", error);
      return jsonResponse({ error: "Ticket price must be at least ₹1" }, 400);
    }

    let order: { id?: string; amount?: number; currency?: string; error?: { description?: string } };
    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: authorization, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "INR",
          receipt: reservation.reservation_id,
          notes: { reservation_id: reservation.reservation_id, event_id: body.event_id },
        }),
      });
      order = await response.json();
      if (!response.ok || !order.id || order.amount !== amount || order.currency !== "INR") {
        const { error } = await admin.from("event_reservations")
          .update({ status: "failed" }).eq("id", reservation.reservation_id);
        if (error) console.error("Could not release failed Razorpay reservation", error);
        console.error("Razorpay order creation failed", order);
        return jsonResponse({
          error: order.error?.description || "Razorpay could not create the payment order",
        }, 502);
      }
    } catch (error) {
      const { error: updateError } = await admin.from("event_reservations")
        .update({ status: "failed" }).eq("id", reservation.reservation_id);
      if (updateError) console.error("Could not release failed Razorpay reservation", updateError);
      console.error("Razorpay order request failed", error);
      return jsonResponse({ error: "Could not connect to Razorpay. Please try again." }, 502);
    }

    const { error: saveError } = await admin.from("event_reservations")
      .update({ razorpay_order_id: order.id })
      .eq("id", reservation.reservation_id)
      .eq("status", "pending");
    if (saveError) {
      console.error("Could not attach Razorpay order to reservation", saveError);
      return jsonResponse({ error: "Could not prepare checkout. Please try again." }, 500);
    }

    return jsonResponse({
      reservation_id: reservation.reservation_id,
      order_id: order.id,
      amount,
      currency: "INR",
      key_id: keyId,
      event_title: reservation.event_title,
    });
  } catch (error) {
    console.error("Create-order function failed", error);
    return jsonResponse({ error: "Unable to start checkout. Please try again." }, 500);
  }
});
