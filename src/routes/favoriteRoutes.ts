import { Router } from "express";
import { FavoriteController } from "../controllers/favoriteController";
import { verifyToken, verifyStrictCustomer } from "../middlewares/authMiddleware";
import { validateRequest } from "../validators/validateRequest";
import {
  favoriteParamsSchema,
  favoriteQuerySchema,
} from "../validators/favoriteValidators";

const router = Router();

// All favorite routes require valid authentication and strict Customer role
router.use(verifyToken, verifyStrictCustomer);

// GET /api/favorites - List authenticated customer's favorites
router.get(
  "/",
  validateRequest({ query: favoriteQuerySchema }),
  FavoriteController.getFavorites
);

// GET /api/favorites/:equipmentId/status - Check if equipment is favorited
router.get(
  "/:equipmentId/status",
  validateRequest({ params: favoriteParamsSchema }),
  FavoriteController.checkFavoriteStatus
);

// POST /api/favorites/:equipmentId - Add equipment to favorites
router.post(
  "/:equipmentId",
  validateRequest({ params: favoriteParamsSchema }),
  FavoriteController.addFavorite
);

// DELETE /api/favorites/:equipmentId - Remove equipment from favorites
router.delete(
  "/:equipmentId",
  validateRequest({ params: favoriteParamsSchema }),
  FavoriteController.removeFavorite
);

export const favoriteRoutes = router;
