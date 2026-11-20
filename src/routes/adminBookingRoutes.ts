import { Router } from "express";
import { AdminBookingController } from "../controllers/adminBookingController";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import {
  bookingQuerySchema,
  updateBookingStatusSchema,
} from "../validators/bookingValidators";

const router = Router();

// Admin booking routes require active Admin role
router.use(verifyToken, verifyAdmin);

// Admin: View all platform rentals
router.get(
  "/",
  validateRequest({ query: bookingQuerySchema }),
  AdminBookingController.getAll
);

// Admin: Update booking status (e.g. Confirmed, Active, Completed, Cancelled)
router.patch(
  "/:id/status",
  validateRequest({
    params: mongoIdParamSchema,
    body: updateBookingStatusSchema,
  }),
  AdminBookingController.updateStatus
);

export const adminBookingRoutes = router;
