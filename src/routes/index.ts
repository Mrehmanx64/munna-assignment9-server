import { Router } from "express";
import { healthRoutes } from "./healthRoutes";
import { ResponseFormatter } from "../utils/ApiResponse";

const router = Router();

// Root API information
router.get("/", (_req, res) => {
  ResponseFormatter.ok(res, "Rentora Equipment Rental Platform API", {
    version: "1.0.0",
    docs: "/api/health",
  });
});

// Health check endpoint: GET /api/health
router.use("/health", healthRoutes);

export const apiRouter = router;
