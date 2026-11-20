import { Router } from "express";
import { AdminAnalyticsController } from "../controllers/adminAnalyticsController";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { monthlyAnalyticsQuerySchema } from "../validators/analyticsValidators";

const router = Router();

// Platform analytics console strictly requires Admin authorization
router.use(verifyToken, verifyAdmin);

// GET /api/admin/analytics/overview - Overall system metrics
router.get("/overview", AdminAnalyticsController.getOverview);

// GET /api/admin/analytics/monthly-bookings - Monthly bookings and revenue trend
router.get(
  "/monthly-bookings",
  validateRequest({ query: monthlyAnalyticsQuerySchema }),
  AdminAnalyticsController.getMonthlyBookings
);

export const adminAnalyticsRoutes = router;
