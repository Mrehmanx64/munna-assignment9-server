import { Router } from "express";
import { UpgradeController } from "../controllers/upgradeController";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";

const router = Router();

// All admin upgrade endpoints require active administrator privileges
router.use(verifyToken, verifyAdmin);

router.get("/", UpgradeController.getAdminRequests);
router.patch(
  "/:id/approve",
  validateRequest({ params: mongoIdParamSchema }),
  UpgradeController.approveRequest
);
router.patch(
  "/:id/reject",
  validateRequest({ params: mongoIdParamSchema }),
  UpgradeController.rejectRequest
);

export const adminUpgradeRoutes = router;
