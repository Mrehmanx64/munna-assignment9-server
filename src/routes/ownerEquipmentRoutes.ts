import { Router } from "express";
import { OwnerEquipmentController } from "../controllers/ownerEquipmentController";
import { verifyToken, verifyOwner } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentQuerySchema,
} from "../validators/equipmentValidators";

const router = Router();

// All owner equipment routes require active Owner role
router.use(verifyToken, verifyOwner);

// Create new equipment listing
router.post(
  "/",
  validateRequest({ body: createEquipmentSchema }),
  OwnerEquipmentController.create
);

// Get all equipment listings owned by current owner
router.get(
  "/",
  validateRequest({ query: equipmentQuerySchema }),
  OwnerEquipmentController.getAll
);

// Get single equipment listing owned by current owner
router.get(
  "/:id",
  validateRequest({ params: mongoIdParamSchema }),
  OwnerEquipmentController.getById
);

// Update own equipment listing
router.put(
  "/:id",
  validateRequest({
    params: mongoIdParamSchema,
    body: updateEquipmentSchema,
  }),
  OwnerEquipmentController.update
);

router.patch(
  "/:id",
  validateRequest({
    params: mongoIdParamSchema,
    body: updateEquipmentSchema,
  }),
  OwnerEquipmentController.update
);

// Delete own equipment listing
router.delete(
  "/:id",
  validateRequest({ params: mongoIdParamSchema }),
  OwnerEquipmentController.remove
);

export const ownerEquipmentRoutes = router;
