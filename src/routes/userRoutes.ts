import { Router } from "express";
import { UserController } from "../controllers/userController";
import { UpgradeController } from "../controllers/upgradeController";
import { verifyToken } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import { updateProfileSchema } from "../validators/userValidators";

const router = Router();

// Updating profile & requesting upgrade requires authentication
router.use(verifyToken);

// Role upgrade request endpoints
router.post("/upgrade-request", UpgradeController.createRequest);
router.get("/upgrade-request/status", UpgradeController.getMyStatus);

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
