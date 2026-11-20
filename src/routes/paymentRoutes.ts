import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";

const router = Router();

// Stripe Webhook Endpoint (verifies raw signature from Stripe-Signature header)
router.post("/webhook", PaymentController.stripeWebhook);

export const paymentRoutes = router;
