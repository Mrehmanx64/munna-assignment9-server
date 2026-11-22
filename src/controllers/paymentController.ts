import { Request, Response } from "express";
import { StripeService } from "../services/stripeService";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { ResponseFormatter } from "../utils/ApiResponse";
import Stripe from "stripe";

export class PaymentController {
  /**
   * POST /api/payments/webhook
   * Stripe Webhook receiver with raw signature verification
   */
  public static stripeWebhook = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;

    const rawBody = (req as any).rawBody || req.body;
    if (!rawBody) {
      throw ApiError.badRequest("Missing webhook payload body");
    }

    // Verify webhook signature (enforces authentic Stripe origin)
    const event = StripeService.verifyWebhookSignature(rawBody, sig);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await StripeService.handleCheckoutSessionCompleted(session);
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await StripeService.handleCheckoutSessionExpired(session);
        break;
      }
      default:
        // Ignore unhandled events with 200 OK
        break;
    }

    res.status(200).json({ received: true });
  });

  /**
   * GET /api/payments/verify/:sessionId
   * Verify a Stripe Checkout Session and reconcile booking/payment records
   */
  public static verifySession = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const sessionId = Array.isArray(req.params.sessionId)
      ? req.params.sessionId[0]
      : req.params.sessionId;

    if (!sessionId) {
      throw ApiError.badRequest("Session ID is required");
    }

    const userId = req.user!.id;
    const userRole = req.user!.role;

    const result = await StripeService.verifyCheckoutSession(sessionId, userId, userRole);

    ResponseFormatter.ok(res, "Payment session verified and booking confirmed", result);
  });
}
