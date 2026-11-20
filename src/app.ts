import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { corsOptions } from "./config/cors";
import { env } from "./config/env";
import { securityHeaders, apiLimiter } from "./middlewares/security";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { errorHandler } from "./middlewares/errorHandler";
import { apiRouter } from "./routes";
import { ResponseFormatter } from "./utils/ApiResponse";

export const createApp = (): Express => {
  const app: Express = express();

  // 1. Trust reverse proxy in production (e.g. Render, Vercel, Railway, Nginx)
  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // 2. Security HTTP Headers
  app.use(securityHeaders);

  // 3. Cross-Origin Resource Sharing (CORS)
  app.use(cors(corsOptions));

  // 4. Rate Limiting for general API traffic
  app.use("/api", apiLimiter);

  // 5. Body Parsers & Cookie Parser
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  app.use(cookieParser());

  // 6. Development Request Logger
  if (env.NODE_ENV === "development") {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on("finish", () => {
        const duration = Date.now() - start;
        console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
      });
      next();
    });
  }

  // 7. Root Gateway Route
  app.get("/", (_req: Request, res: Response) => {
    ResponseFormatter.ok(res, "Rentora Equipment Rental Platform API Gateway", {
      service: "rentora-api",
      version: "1.0.0",
      status: "operational",
      healthCheck: "/api/health",
    });
  });

  // 8. API Routes
  app.use("/api", apiRouter);
  app.use("/api/v1", apiRouter);

  // 9. 404 Not Found Handler (catches unmatched routes)
  app.use(notFoundHandler);

  // 10. Centralized Error Handler (must be last)
  app.use(errorHandler);

  return app;
};

export const app = createApp();
