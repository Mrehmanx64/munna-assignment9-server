import { Request, Response } from "express";
import { AuthService } from "../services/authService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { env } from "../config/env";
import { HttpStatus } from "../types";

// Cookie helper
const setAuthCookie = (res: Response, token: string): void => {
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",
  });
};

const clearAuthCookie = (res: Response): void => {
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: env.NODE_ENV === "production" ? "none" : "lax",
    path: "/",
  });
};

/**
 * Register with email and password
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.register(req.body);
  setAuthCookie(res, result.token);

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
  setAuthCookie(res, result.token);

  ResponseFormatter.ok(res, "Login successful", result);
});

/**
 * Google OAuth Authentication
 * POST /api/auth/google
 * Note: New Google registrations strictly default to "customer" role
 */
export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const result = await AuthService.googleAuth(req.body);
  setAuthCookie(res, result.token);

  ResponseFormatter.ok(res, "Google authentication successful", result);
});

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 * Ensures persistent session across page reloads
 */
export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = await AuthService.getMe(req.user!.id);
  ResponseFormatter.ok(res, "User profile retrieved successfully", user);
});

/**
 * Logout and clear session
 * POST /api/auth/logout
 */
export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
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
