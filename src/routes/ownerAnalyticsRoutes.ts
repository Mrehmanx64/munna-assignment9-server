import { Router } from "express";
import { OwnerAnalyticsController } from "../controllers/ownerAnalyticsController";
import { verifyToken, verifyOwner } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { monthlyAnalyticsQuerySchema } from "../validators/analyticsValidators";

const router = Router();

// Fleet analytics console strictly requires Owner authorization
router.use(verifyToken, verifyOwner);

// GET /api/owner/analytics/overview - Fleet metrics overview
router.get("/overview", OwnerAnalyticsController.getOverview);

// GET /api/owner/analytics/monthly-earnings - Monthly earnings trend
router.get(
  "/monthly-earnings",
  validateRequest({ query: monthlyAnalyticsQuerySchema }),
  OwnerAnalyticsController.getMonthlyEarnings
);

export const ownerAnalyticsRoutes = router;
