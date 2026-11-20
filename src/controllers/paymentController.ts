import { Request, Response } from "express";
import { StripeService } from "../services/stripeService";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
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
}
