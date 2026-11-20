import { Router } from "express";
import { AdminEquipmentController } from "../controllers/adminEquipmentController";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import {
  adminEquipmentStatusSchema,
  updateEquipmentSchema,
  equipmentQuerySchema,
} from "../validators/equipmentValidators";

const router = Router();

// All admin equipment routes require active Admin role
router.use(verifyToken, verifyAdmin);

// Admin: Get all equipment across all statuses
router.get(
  "/",
  validateRequest({ query: equipmentQuerySchema }),
  AdminEquipmentController.getAll
);

// Admin: Approve an equipment listing
router.patch(
  "/:id/approve",
  validateRequest({ params: mongoIdParamSchema }),
  AdminEquipmentController.approve
);

// Admin: Reject an equipment listing with a reason
router.patch(
  "/:id/reject",
  validateRequest({
    params: mongoIdParamSchema,
    body: adminEquipmentStatusSchema,
  }),
  AdminEquipmentController.reject
);

// Admin: Update any equipment listing
router.put(
  "/:id",
  validateRequest({
    params: mongoIdParamSchema,
    body: updateEquipmentSchema,
  }),
  AdminEquipmentController.update
);

// Admin: Delete any equipment listing
router.delete(
  "/:id",
  validateRequest({ params: mongoIdParamSchema }),
  AdminEquipmentController.remove
);

export const adminEquipmentRoutes = router;
