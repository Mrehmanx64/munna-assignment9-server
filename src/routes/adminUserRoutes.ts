import { Router } from "express";
import { AdminUserController } from "../controllers/adminUserController";
import { UpgradeController } from "../controllers/upgradeController";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { mongoIdParamSchema } from "../validators/common";
import {
  adminUserQuerySchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from "../validators/userValidators";

const router = Router();

// All admin user routes require active administrator privileges
router.use(verifyToken, verifyAdmin);

// Role upgrade requests review & approval endpoints
router.get("/upgrade-requests", UpgradeController.getAdminRequests);
router.patch(
  "/upgrade-requests/:id/approve",
  validateRequest({ params: mongoIdParamSchema }),
  UpgradeController.approveRequest
);
router.patch(
  "/upgrade-requests/:id/reject",
  validateRequest({ params: mongoIdParamSchema }),
  UpgradeController.rejectRequest
);

// GET /api/admin/users - User directory with search, filter, and pagination
router.get(
  "/",
  validateRequest({ query: adminUserQuerySchema }),
  AdminUserController.getUsers
);

// PATCH /api/admin/users/:id/role - Update user role
router.patch(
  "/:id/role",
  validateRequest({
    params: userIdParamSchema,
    body: updateUserRoleSchema,
  }),
  AdminUserController.updateRole
);

export const adminUserRoutes = router;
