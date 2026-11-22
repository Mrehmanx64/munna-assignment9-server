import { Router } from "express";
import { OwnerBookingController } from "../controllers/ownerBookingController";
import { verifyToken, verifyOwner } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import {
  bookingQuerySchema,
  updateBookingStatusSchema,
} from "../validators/bookingValidators";

const router = Router();

// Owner booking routes require active Owner role
router.use(verifyToken, verifyOwner);

// Owner: View all equipment rentals for machinery in their fleet
router.get(
  "/",
  validateRequest({ query: bookingQuerySchema }),
  OwnerBookingController.getAll
);

// Owner: Update allowed rental lifecycle actions for own fleet equipment
router.patch(
  "/:id/status",
  validateRequest({
    params: mongoIdParamSchema,
    body: updateBookingStatusSchema,
  }),
  OwnerBookingController.updateStatus
);

export const ownerBookingRoutes = router;
