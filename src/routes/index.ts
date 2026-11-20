import { Router, Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { healthRoutes } from "./healthRoutes";
import { authRoutes } from "./authRoutes";
import { getAuth } from "../config/auth";
import { ResponseFormatter } from "../utils/ApiResponse";

const router = Router();

// Root API information
router.get("/", (_req: Request, res: Response) => {
  ResponseFormatter.ok(res, "Rentora Equipment Rental Platform API", {
    version: "1.0.0",
    docs: "/api/health",
    modules: ["health", "auth", "better-auth"],
  });
});

// Health check endpoint: GET /api/health
router.use("/health", healthRoutes);

// Authentication & RBAC endpoints: /api/auth/*
router.use("/auth", authRoutes);

// Direct BetterAuth node adapter endpoints: /api/better-auth/*
router.all("/better-auth/*", (req: Request, res: Response, next: NextFunction) => {
  try {
    const handler = toNodeHandler(getAuth());
    return handler(req, res);
  } catch (err) {
    next(err);
  }
});

export const apiRouter = router;
