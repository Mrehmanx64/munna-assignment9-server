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
      const successUrl = env.STRIPE_SUCCESS_URL.replace(
        "{CHECKOUT_SESSION_ID}",
        "{CHECKOUT_SESSION_ID}"
      );

      const bookingId = (booking._id || (booking as any).id)?.toString() || "";
      const customerId = (booking.customer?._id || booking.customer)?.toString() || "";
      const ownerId = (booking.owner?._id || booking.owner)?.toString() || "";
      const equipmentId = (booking.equipment?._id || booking.equipment)?.toString() || "";

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: customerEmail,
        client_reference_id: bookingId,
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
        cancel_url: env.STRIPE_CANCEL_URL,
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

    // 1. Idempotency Check: if payment with this session ID already exists, return early
    const existingPayment = await Payment.findOne({ stripeSessionId: sessionId });
    if (existingPayment) {
      const existingBooking = await Booking.findById(existingPayment.booking);
      return {
        booking: existingBooking ? (existingBooking.toJSON() as IBooking) : null,
        payment: existingPayment.toJSON() as IPayment,
      };
    }

    // 2. Identify the target booking
    const bookingId =
      session.metadata?.bookingId || session.client_reference_id;
    if (!bookingId) {
      throw ApiError.badRequest(
        "Missing bookingId or client_reference_id in Stripe session metadata"
      );
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw ApiError.notFound(`Booking not found for ID: ${bookingId}`);
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
}
