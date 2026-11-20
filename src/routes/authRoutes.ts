import { Router } from "express";
import {
  register,
  login,
  googleAuth,
  getMe,
  logout,
  testProtected,
  testRenter,
  testOwner,
  testAdmin,
} from "../controllers/authController";
import { validateRequest } from "../validators/validateRequest";
import { registerSchema, loginSchema, googleAuthSchema } from "../validators/authValidators";
import {
  verifyToken,
  verifyRenter,
  verifyOwner,
  verifyAdmin,
  authLimiter,
} from "../middlewares";

const router = Router();

// ==========================================
// Public Authentication Routes
// ==========================================

// POST /api/auth/register
router.post(
  "/register",
  authLimiter,
  validateRequest({ body: registerSchema }),
  register
);

// POST /api/auth/login
router.post(
  "/login",
  authLimiter,
  validateRequest({ body: loginSchema }),
  login
);

// POST /api/auth/google
router.post(
  "/google",
  authLimiter,
  validateRequest({ body: googleAuthSchema }),
  googleAuth
);

// POST /api/auth/logout
router.post("/logout", logout);

// ==========================================
// Authenticated Session Persistence
// ==========================================

// GET /api/auth/me
router.get("/me", verifyToken, getMe);

// ==========================================
// Role-Based Access Control Test Endpoints
// ==========================================

// GET /api/auth/test/protected (Any verified token)
router.get("/test/protected", verifyToken, testProtected);

// GET /api/auth/test/renter (Requires Customer/Renter or Admin)
router.get("/test/renter", verifyToken, verifyRenter, testRenter);

// GET /api/auth/test/owner (Requires Equipment Owner or Admin)
router.get("/test/owner", verifyToken, verifyOwner, testOwner);

// GET /api/auth/test/admin (Requires Admin exclusively)
router.get("/test/admin", verifyToken, verifyAdmin, testAdmin);

export const authRoutes = router;
