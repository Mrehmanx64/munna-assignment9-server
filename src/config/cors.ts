import { CorsOptions } from "cors";
import { env } from "./env";

// Parse configured client origins (supports comma-separated origins)
const configuredOrigins: string[] = env.CLIENT_URL
  ? env.CLIENT_URL.split(",").map((url) => url.trim()).filter(Boolean)
  : [];

// Development-only local origins
const devOrigins: string[] = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
];

// Project-specific preview pattern (strictly restricted to rentora and munna-assignment9-client deployments)
const projectPreviewPattern = /^https:\/\/(?:rentora|munna-assignment9-client)(?:-[a-zA-Z0-9_-]+)?\.vercel\.app$/;

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or tools without origin header (e.g. Postman, curl, health checks)
    if (!origin) {
      return callback(null, true);
    }

    // 1. Explicitly configured origins (production or dev)
    if (configuredOrigins.includes(origin)) {
      return callback(null, true);
    }

    // 2. Development mode: allow standard local development servers
    if (env.NODE_ENV === "development" || env.NODE_ENV === "test") {
      if (devOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin)) {
        return callback(null, true);
      }
    }

    // 3. Controlled preview domain matching: strictly restricted to rentora project domains
    if (projectPreviewPattern.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
    "X-Forwarded-For",
  ],
  exposedHeaders: ["Content-Range", "X-Content-Range"],
  maxAge: 86400, // 24 hours
};
