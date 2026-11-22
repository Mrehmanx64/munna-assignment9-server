import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { JwtService } from "../services/jwtService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { env } from "../config/env";
import { HttpStatus } from "../types";

// Cookie helper
const setAuthCookie = (res: Response, token: string, req?: Request): void => {
  // If running in production OR if request was received over HTTPS (e.g. Render, Vercel reverse proxy),
  // we MUST use secure: true and sameSite: "none" so browsers accept cross-site cookies.
  const isHttps =
    env.NODE_ENV === "production" ||
    Boolean(req && (req.secure || req.headers["x-forwarded-proto"] === "https"));

  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
  res.cookie("token", token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

const clearAuthCookie = (res: Response, req?: Request): void => {
  const isHttps =
    env.NODE_ENV === "production" ||
    Boolean(req && (req.secure || req.headers["x-forwarded-proto"] === "https"));

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
  });
  res.clearCookie("token", {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? "none" : "lax",
    path: "/",
  });
};

/**
 * Register with email and password
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.register(req.body);
  setAuthCookie(res, result.token, req);

  ResponseFormatter.send(
    res,
    HttpStatus.CREATED,
    "Registration successful. Welcome to Rentora!",
    result
  );
});

/**
 * Login with email and password
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.login(req.body);
  setAuthCookie(res, result.token, req);

  ResponseFormatter.ok(res, "Login successful", result);
});

/**
 * Google OAuth Authentication
 * POST /api/auth/google
 * Note: New Google registrations strictly default to "customer" role
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.googleAuth(req.body);
  setAuthCookie(res, result.token, req);

  ResponseFormatter.ok(res, "Google authentication successful", result);
});

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 * Ensures persistent session across page reloads
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await AuthService.getMe(req.user!.id);
  // Re-generate fresh access token to extend session and support cross-domain header authentication
  const token = JwtService.generateAccessToken(user);
  setAuthCookie(res, token, req);
  ResponseFormatter.ok(res, "User profile retrieved successfully", { user, token });
});

/**
 * Logout and clear session
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (req: Request, res: Response) => {
  clearAuthCookie(res, req);
  ResponseFormatter.ok(res, "Successfully logged out", null);
});

/**
 * RBAC Protected Route Verification Handlers
 */
export const testProtected = asyncHandler(async (req: Request, res: Response) => {
  ResponseFormatter.ok(res, "Access granted: Protected route reached", {
    user: req.user,
    message: "Any verified user can access this route",
  });
});

export const testRenter = asyncHandler(async (req: Request, res: Response) => {
  ResponseFormatter.ok(res, "Access granted: Renter dashboard verified", {
    user: req.user,
    message: "Requires Customer (Renter) or Admin clearance",
  });
});

export const testOwner = asyncHandler(async (req: Request, res: Response) => {
  ResponseFormatter.ok(res, "Access granted: Owner dashboard verified", {
    user: req.user,
    message: "Requires Equipment Owner or Admin clearance",
  });
});

export const testAdmin = asyncHandler(async (req: Request, res: Response) => {
  ResponseFormatter.ok(res, "Access granted: Admin console verified", {
    user: req.user,
    message: "Requires Platform Administrator clearance exclusively",
  });
});
