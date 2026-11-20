import { CorsOptions } from "cors";
import { env } from "./env";

// Allowed origins in development and production
const allowedOrigins: string[] = [
  env.CLIENT_URL,
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server or tools without origin header (e.g. Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    if (
      allowedOrigins.includes(origin) ||
      (env.NODE_ENV === "development" && /^http:\/\/localhost:\d+$/.test(origin))
    ) {
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
