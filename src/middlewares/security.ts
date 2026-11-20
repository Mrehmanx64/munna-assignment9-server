import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { env } from "../config/env";
import { HttpStatus } from "../types";

// Security headers with Helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
  crossOriginEmbedderPolicy: false,
});

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: env.NODE_ENV === "production" ? 100 : 1000, // Limit each IP
  standardHeaders: "draft-8", // Return standard RateLimit headers
  legacyHeaders: false,
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    message: "Too many requests from this IP, please try again after 15 minutes",
    errors: null,
    timestamp: new Date().toISOString(),
  },
});

// Stricter rate limiter for sensitive endpoints (auth, password resets)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.NODE_ENV === "production" ? 10 : 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  statusCode: HttpStatus.TOO_MANY_REQUESTS,
  message: {
    success: false,
    statusCode: HttpStatus.TOO_MANY_REQUESTS,
    message: "Too many authentication attempts, please try again after 15 minutes",
    errors: null,
    timestamp: new Date().toISOString(),
  },
});
