import { Request, Response, NextFunction } from "express";
import { JwtService } from "../services/jwtService";
import { ApiError } from "../utils";
import { UserRole } from "../types";

/**
 * Extracts and verifies JWT access token from Authorization header or HTTP-only cookies
 */
export const verifyToken = (req: Request, _res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // 1. Check Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1]?.trim();
  }

  // 2. Check HTTP-only cookies fallback (for browser/web clients)
  if (!token && req.cookies) {
    token = req.cookies.accessToken || req.cookies.token;
  }

  if (!token) {
    return next(ApiError.unauthorized("Authentication required. Please provide a valid access token."));
  }

  try {
    const decoded = JwtService.verifyAccessToken(token);
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Generic Role-Based Access Control middleware
 * Checks if the authenticated user has one of the allowed roles
 */
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized("Authentication required before authorization check."));
    }

    const userRole = req.user.role.toLowerCase();
    // Normalize "renter" and "customer" as interchangeable role terms
    const normalizedAllowed = allowedRoles.map((r) => {
      const lower = r.toLowerCase();
      return lower === "renter" ? "customer" : lower;
    });

    const isAuthorized =
      normalizedAllowed.includes(userRole) ||
      (allowedRoles.includes("renter") && userRole === "customer") ||
      userRole === "admin"; // Admin has universal supervisory clearance

    if (!isAuthorized) {
      return next(
        ApiError.forbidden(
          `Access denied. Requires one of the following roles: [${allowedRoles.join(", ")}]. Your role is: ${req.user.role}`
        )
      );
    }

    next();
  };
};

/**
 * Required Middleware: verifyRenter
 * Protects endpoints accessible by Renters / Customers (and Admins)
 */
export const verifyRenter = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return verifyToken(req, res, () => {
      authorizeRoles("customer", "renter")(req, res, next);
    });
  }
  authorizeRoles("customer", "renter")(req, res, next);
};

/**
 * Required Middleware: verifyOwner
 * Protects endpoints accessible by Equipment Owners (and Admins)
 */
export const verifyOwner = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return verifyToken(req, res, () => {
      authorizeRoles("owner")(req, res, next);
    });
  }
  authorizeRoles("owner")(req, res, next);
};

/**
 * Required Middleware: verifyAdmin
 * Protects endpoints exclusively accessible by Platform Administrators
 */
export const verifyAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    return verifyToken(req, res, () => {
      if (req.user?.role !== "admin") {
        return next(ApiError.forbidden("Access denied: Administrator privileges required."));
      }
      next();
    });
  }

  if (req.user.role !== "admin") {
    return next(ApiError.forbidden("Access denied: Administrator privileges required."));
  }

  next();
};
