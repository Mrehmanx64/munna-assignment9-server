import { Router } from "express";
import { EquipmentController } from "../controllers/equipmentController";
import { BookingController } from "../controllers/bookingController";
import { optionalAuth } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import { equipmentQuerySchema } from "../validators/equipmentValidators";
import { availabilityQuerySchema } from "../validators/bookingValidators";

const router = Router();

// Public: Get all approved equipment with filters, search, and sorting
router.get(
  "/",
  validateRequest({ query: equipmentQuerySchema }),
  EquipmentController.getAll
);

// Public: Get featured equipment (max 6)
router.get("/featured", EquipmentController.getFeatured);

// Public: Get categories summary
router.get("/categories", EquipmentController.getCategories);

// Public: Check equipment availability for specific rental dates
router.get(
  "/:id/availability",
  validateRequest({
    params: mongoIdParamSchema,
    query: availabilityQuerySchema,
  }),
  BookingController.checkAvailability
);

// Public: Get equipment details by ID (with optional auth for owner/admin view of pending)
router.get(
  "/:id",
  optionalAuth,
  validateRequest({ params: mongoIdParamSchema }),
  EquipmentController.getById
);

export const equipmentRoutes = router;
