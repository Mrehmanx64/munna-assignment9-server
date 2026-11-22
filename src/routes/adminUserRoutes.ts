import { Router } from "express";
import { AdminUserController } from "../controllers/adminUserController";
import { verifyToken, verifyAdmin } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import {
  adminUserQuerySchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from "../validators/userValidators";

const router = Router();

// All admin user routes require active administrator privileges
router.use(verifyToken, verifyAdmin);

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
