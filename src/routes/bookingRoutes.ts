import { Router } from "express";
import { BookingController } from "../controllers/bookingController";
import { verifyToken, verifyRenter } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import {
  createBookingSchema,
  bookingQuerySchema,
} from "../validators/bookingValidators";

const router = Router();

// All customer booking endpoints require authentication
router.use(verifyToken);

// Customer: Create a rental booking reservation
router.post(
  "/",
  verifyRenter,
  validateRequest({ body: createBookingSchema }),
  BookingController.create
);

// Customer: View own rental bookings
router.get(
  "/my-rentals",
  verifyRenter,
  validateRequest({ query: bookingQuerySchema }),
  BookingController.getMyRentals
);

// Customer / Owner / Admin: View single booking details
router.get(
  "/:id",
  validateRequest({ params: mongoIdParamSchema }),
  BookingController.getById
);

// Customer: Re-initiate Stripe Checkout session for pending booking
router.post(
  "/:id/checkout",
  verifyRenter,
  validateRequest({ params: mongoIdParamSchema }),
  BookingController.checkout
);

export const bookingRoutes = router;
