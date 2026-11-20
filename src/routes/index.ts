import { Router, Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { healthRoutes } from "./healthRoutes";
import { authRoutes } from "./authRoutes";
import { equipmentRoutes } from "./equipmentRoutes";
import { ownerEquipmentRoutes } from "./ownerEquipmentRoutes";
import { adminEquipmentRoutes } from "./adminEquipmentRoutes";
import { uploadRoutes } from "./uploadRoutes";
import { getAuth } from "../config/auth";
import { ResponseFormatter } from "../utils/ApiResponse";

const router = Router();

// Root API information
router.get("/", (_req: Request, res: Response) => {
  ResponseFormatter.ok(res, "Rentora Equipment Rental Platform API", {
    version: "1.0.0",
    docs: "/api/health",
    modules: [
      "health",
      "auth",
      "better-auth",
      "equipment",
      "owner-equipment",
      "admin-equipment",
      "uploads",
    ],
  });
});

// Health check endpoint: GET /api/health
router.use("/health", healthRoutes);

// Authentication & RBAC endpoints: /api/auth/*
router.use("/auth", authRoutes);

// Public Equipment listings & details: /api/equipment/*
router.use("/equipment", equipmentRoutes);

// Owner Equipment management: /api/owner/equipment/*
router.use("/owner/equipment", ownerEquipmentRoutes);

// Admin Equipment review & oversight: /api/admin/equipment/*
router.use("/admin/equipment", adminEquipmentRoutes);

// File & Image uploads (ImgBB): /api/uploads/*
router.use("/uploads", uploadRoutes);

// Direct BetterAuth node adapter endpoints: /api/better-auth/*
router.use("/better-auth", (req: Request, res: Response, next: NextFunction) => {
  try {
    const handler = toNodeHandler(getAuth());
    return handler(req, res);
  } catch (err) {
    next(err);
  }
});

export const apiRouter = router;
