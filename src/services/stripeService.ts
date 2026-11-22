import Stripe from "stripe";
import { env } from "../config/env";
import { Booking } from "../models/bookingModel";
import { Payment } from "../models/paymentModel";
import { IBooking } from "../types/booking";
import { IPayment } from "../types/payment";
import { ApiError } from "../utils/ApiError";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-02-24.acacia" as any,
});

export class StripeService {
  /**
   * Create a Stripe Checkout Session for a rental booking
   */
  public static async createCheckoutSession(
    booking: IBooking,
    equipmentTitle: string,
    customerEmail: string
  ): Promise<{ sessionId: string; checkoutUrl: string }> {
    // In production, fallback to mock is strictly prohibited; valid live or test keys required
    if (env.NODE_ENV === "production") {
      if (
        !env.STRIPE_SECRET_KEY ||
        env.STRIPE_SECRET_KEY.includes("placeholder") ||
        (!env.STRIPE_SECRET_KEY.startsWith("sk_live_") &&
          !env.STRIPE_SECRET_KEY.startsWith("sk_test_"))
      ) {
        throw ApiError.internal(
          "Valid Stripe configuration (sk_live_ or sk_test_) is required in production environment"
        );
      }
    }

    const isMock =
      env.NODE_ENV !== "production" &&
      (process.env.NODE_ENV === "test" ||
        env.NODE_ENV === "test" ||
        !env.STRIPE_SECRET_KEY ||
        env.STRIPE_SECRET_KEY.includes("placeholder") ||
        env.STRIPE_SECRET_KEY.length < 30);

    if (isMock) {
      const mockSessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const mockCheckoutUrl = `https://checkout.stripe.com/c/pay/${mockSessionId}`;
      return {
        sessionId: mockSessionId,
        checkoutUrl: mockCheckoutUrl,
      };
    }

    try {
      const bookingId = (booking._id || (booking as any).id)?.toString() || "";
      const customerId = (booking.customer?._id || booking.customer)?.toString() || "";
      const ownerId = (booking.owner?._id || booking.owner)?.toString() || "";
      const equipmentId = (booking.equipment?._id || booking.equipment)?.toString() || "";

      // Ensure successUrl points to /payment/success
      let successUrl = env.STRIPE_SUCCESS_URL;
      if (successUrl.includes("/dashboard/customer")) {
        successUrl = successUrl.replace(/\/dashboard\/customer(\/rentals)?/, "/payment/success");
      }
      if (!successUrl.includes("/payment/success")) {
        const clientBase = (env.CLIENT_URL || "https://munna-assignment9-client.vercel.app").replace(/\/$/, "");
        successUrl = `${clientBase}/payment/success?session_id={CHECKOUT_SESSION_ID}`;
      }
      if (!successUrl.includes("session_id=")) {
        successUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
      }
      if (!successUrl.includes("booking_id=")) {
        successUrl = `${successUrl}${successUrl.includes("?") ? "&" : "?"}booking_id=${bookingId}`;
      }

      // Ensure cancelUrl points to /payment/failed
      let cancelUrl = env.STRIPE_CANCEL_URL;
      if (cancelUrl.includes("/equipment?status=cancelled") || !cancelUrl.includes("/payment/")) {
        const clientBase = (env.CLIENT_URL || "https://munna-assignment9-client.vercel.app").replace(/\/$/, "");
        cancelUrl = `${clientBase}/payment/failed`;
      }
      if (!cancelUrl.includes("booking_id=")) {
        cancelUrl = `${cancelUrl}${cancelUrl.includes("?") ? "&" : "?"}booking_id=${bookingId}&status=cancelled`;
      }

      // Align Stripe Checkout Session expiration strictly with 30-minute booking inventory hold
      const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes in seconds

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: customerEmail,
        client_reference_id: bookingId,
        expires_at: expiresAt,
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Equipment Rental: ${equipmentTitle}`,
                description: `Rental duration: ${booking.duration} ${booking.rentalType.toLowerCase()}(s), Quantity: ${booking.quantity}`,
              },
              unit_amount: Math.round(booking.totalAmount * 100), // Cents
            },
            quantity: 1,
          },
        ],
        metadata: {
          bookingId,
          customerId,
          ownerId,
          equipmentId,
          duration: String(booking.duration),
          rentalType: booking.rentalType,
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
      });

      return {
        sessionId: session.id,
        checkoutUrl: session.url || `https://checkout.stripe.com/c/pay/${session.id}`,
      };
    } catch (err: any) {
      throw ApiError.badRequest(
        `Failed to initialize Stripe Checkout Session: ${err.message}`
      );
    }
  }

  /**
   * Verify Stripe Webhook Signature from raw request body
   */
  public static verifyWebhookSignature(
    rawBody: Buffer | string,
    signature: string
  ): Stripe.Event {
    // In production, live webhook signature verification is mandatory
    if (env.NODE_ENV === "production") {
      if (!signature) {
        throw ApiError.badRequest("Stripe-Signature header is required");
      }
      if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")) {
        throw ApiError.internal("Live Stripe webhook secret is not configured in production");
      }
      try {
        return stripe.webhooks.constructEvent(
          rawBody,
          signature,
          env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err: any) {
        throw ApiError.badRequest(`Stripe Webhook Signature Verification Failed: ${err.message}`);
      }
    }

    const isMock =
      process.env.NODE_ENV === "test" ||
      env.NODE_ENV === "test" ||
      !env.STRIPE_WEBHOOK_SECRET ||
      env.STRIPE_WEBHOOK_SECRET.includes("placeholder");

    if (isMock || !signature || signature === "test_signature") {
      // In mock/test environment without live webhook secret
      if (typeof rawBody === "string") {
        return JSON.parse(rawBody);
      }
      return JSON.parse(rawBody.toString("utf8"));
    }

    try {
      return stripe.webhooks.constructEvent(
        rawBody,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      throw ApiError.badRequest(`Stripe Webhook Signature Verification Failed: ${err.message}`);
    }
  }

  /**
   * Process a successful Checkout Session completion
   * Enforces idempotency to prevent duplicate payments on repeated webhook deliveries
   */
  public static async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session
  ): Promise<{ booking: IBooking | null; payment: IPayment | null }> {
    const sessionId = session.id;

    // Strict payment verification: Require session.payment_status === "paid"
    if (session.payment_status !== "paid") {
      throw ApiError.badRequest(
        `Payment cannot be confirmed: Stripe payment_status is '${session.payment_status}' (expected 'paid')`
      );
    }

    // Identify target booking
    const bookingId =
      session.metadata?.bookingId || session.client_reference_id;
    if (!bookingId) {
      throw ApiError.badRequest(
        "Missing bookingId or client_reference_id in Stripe session metadata"
      );
    }

    // 1. Idempotency Check: if payment with this session ID OR already marked paid for booking, return existing
    const existingPayment = await Payment.findOne({
      $or: [
        { stripeSessionId: sessionId },
        { booking: bookingId, paymentStatus: "Paid" },
      ],
    });

    if (existingPayment) {
      const existingBooking = await Booking.findById(bookingId);
      if (existingBooking && existingBooking.paymentStatus !== "Paid") {
        existingBooking.paymentStatus = "Paid";
        existingBooking.bookingStatus = "Confirmed";
        await existingBooking.save();
      }
      return {
        booking: existingBooking ? (existingBooking.toJSON() as IBooking) : null,
        payment: existingPayment.toJSON() as IPayment,
      };
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw ApiError.notFound(`Booking not found for ID: ${bookingId}`);
    }

    // Avoid double processing if booking was already confirmed
    if (booking.paymentStatus === "Paid") {
      const existingPay = await Payment.findOne({ booking: booking._id });
      return {
        booking: booking.toJSON() as IBooking,
        payment: existingPay ? (existingPay.toJSON() as IPayment) : null,
      };
    }

    const amountInDollars = session.amount_total
      ? session.amount_total / 100
      : booking.totalAmount;
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : sessionId;

    // 3. Create persistent Payment transaction record
    const payment = new Payment({
      booking: booking._id,
      customer: booking.customer,
      owner: booking.owner,
      equipment: booking.equipment,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId,
      amount: amountInDollars,
      currency: session.currency || "usd",
      paymentStatus: "Paid",
      transactionDate: new Date(),
      metadata: {
        customerEmail: session.customer_email || session.customer_details?.email,
        paymentStatus: session.payment_status,
        duration: booking.duration,
        rentalType: booking.rentalType,
      },
    });

    const savedPayment = await payment.save();

    // 4. Update Booking state atomically
    booking.paymentStatus = "Paid";
    booking.bookingStatus = "Confirmed";
    booking.stripePaymentIntentId = paymentIntentId;
    booking.paymentId = savedPayment._id;
    const savedBooking = await booking.save();

    return {
      booking: savedBooking.toJSON() as IBooking,
      payment: savedPayment.toJSON() as IPayment,
    };
  }

  /**
   * Handle expired or cancelled Checkout Session
   */
  public static async handleCheckoutSessionExpired(
    session: Stripe.Checkout.Session
  ): Promise<void> {
    const bookingId =
      session.metadata?.bookingId || session.client_reference_id;
    if (!bookingId) return;

    const booking = await Booking.findById(bookingId);
    if (booking && booking.paymentStatus === "Pending") {
      booking.paymentStatus = "Failed";
      booking.bookingStatus = "Cancelled";
      await booking.save();
    }
  }

  /**
   * Verify a Stripe Checkout Session by ID and sync booking/payment state
   * Enforces session ownership: User must be the customer on the booking or an Admin.
   * Authoritative payment confirmation requires session.payment_status === "paid".
   */
  public static async verifyCheckoutSession(
    sessionId: string,
    requesterUserId?: string,
    requesterRole?: string
  ): Promise<{ booking: IBooking | null; payment: IPayment | null; status?: string }> {
    if (!sessionId) {
      throw ApiError.badRequest("Session ID is required");
    }

    // 1. Idempotency Check: if payment with this session ID already exists, verify authorization and return
    const existingPayment = await Payment.findOne({ stripeSessionId: sessionId });
    if (existingPayment) {
      const existingBooking = await Booking.findById(existingPayment.booking);
      if (existingBooking) {
        // Enforce ownership: session ID is not an auth bypass
        if (
          requesterRole !== "admin" &&
          requesterUserId &&
          existingBooking.customer.toString() !== requesterUserId
        ) {
          throw ApiError.forbidden("Access denied: You are not authorized to view this payment session.");
        }

        if (existingBooking.paymentStatus !== "Paid") {
          existingBooking.paymentStatus = "Paid";
          existingBooking.bookingStatus = "Confirmed";
          await existingBooking.save();
        }
      }
      return {
        booking: existingBooking ? (existingBooking.toJSON() as IBooking) : null,
        payment: existingPayment.toJSON() as IPayment,
        status: "paid",
      };
    }

    // 2. Query Stripe directly to retrieve the session
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session) {
        throw ApiError.notFound("Stripe Checkout Session not found");
      }

      const bookingId = session.metadata?.bookingId || session.client_reference_id;
      if (!bookingId) {
        throw ApiError.badRequest("Session metadata does not contain a booking reference");
      }

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        throw ApiError.notFound(`Booking not found for ID: ${bookingId}`);
      }

      // Enforce ownership: requesting user must own the booking or be admin
      if (
        requesterRole !== "admin" &&
        requesterUserId &&
        booking.customer.toString() !== requesterUserId
      ) {
        throw ApiError.forbidden("Access denied: You are not authorized to view this payment session.");
      }

      // Strictly require session.payment_status === "paid"
      if (session.payment_status === "paid") {
        const confirmed = await this.handleCheckoutSessionCompleted(session);
        return {
          ...confirmed,
          status: "paid",
        };
      }

      if (session.status === "expired") {
        booking.paymentStatus = "Failed";
        booking.bookingStatus = "Cancelled";
        await booking.save();
        return {
          booking: booking.toJSON() as IBooking,
          payment: null,
          status: "expired",
        };
      }

      // Asynchronous / pending payment state
      return {
        booking: booking.toJSON() as IBooking,
        payment: null,
        status: session.payment_status || "pending",
      };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw ApiError.badRequest(`Failed to verify Stripe session: ${err.message}`);
    }
  }
}
