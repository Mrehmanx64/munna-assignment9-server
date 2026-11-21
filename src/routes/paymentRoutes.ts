import { Router } from "express";
import { PaymentController } from "../controllers/paymentController";
import { verifyToken } from "../middlewares/authMiddleware";

const router = Router();

// Stripe Webhook Endpoint (verifies raw signature from Stripe-Signature header)
router.post("/webhook", PaymentController.stripeWebhook);

// Client-side verification fallback (verifies checkout session and marks booking as Paid/Confirmed)
router.get("/verify/:sessionId", verifyToken, PaymentController.verifySession);

export const paymentRoutes = router;
