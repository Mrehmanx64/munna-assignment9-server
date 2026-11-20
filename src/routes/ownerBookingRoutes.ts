import { Router } from "express";
import { OwnerBookingController } from "../controllers/ownerBookingController";
import { verifyToken, verifyOwner } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { bookingQuerySchema } from "../validators/bookingValidators";

const router = Router();

// Owner booking routes require active Owner role
router.use(verifyToken, verifyOwner);

// Owner: View all equipment rentals for machinery in their fleet
router.get(
  "/",
  validateRequest({ query: bookingQuerySchema }),
  OwnerBookingController.getAll
);

export const ownerBookingRoutes = router;
