import { Router } from "express";
import { UserController } from "../controllers/userController";
import { verifyToken } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { updateProfileSchema } from "../validators/userValidators";

const router = Router();

// Updating profile requires authentication
router.use(verifyToken);

// PATCH /api/users/me
router.patch(
  "/me",
  validateRequest({ body: updateProfileSchema }),
  UserController.updateMe
);

// PUT /api/users/me (alias)
router.put(
  "/me",
  validateRequest({ body: updateProfileSchema }),
  UserController.updateMe
);

export const userRoutes = router;
