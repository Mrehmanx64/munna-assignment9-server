import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .default("5000")
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().positive()),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  MONGODB_URI: z
    .string()
    .default("mongodb://localhost:27017/rentora"),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters long")
    .default("rentora_default_development_jwt_secret_key_32_chars"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters long")
    .default("rentora_default_better_auth_secret_key_32_chars"),
  BETTER_AUTH_URL: z.string().default("http://localhost:5000"),
  STRIPE_SECRET_KEY: z.string().default("sk_test_placeholder"),
  IMGBB_API_KEY: z.string().default("placeholder_imgbb_key"),
});

const parseEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    throw new Error(
      `Environment validation failed: ${JSON.stringify(result.error.flatten().fieldErrors)}`
    );
  }

  return result.data;
};

export const env = parseEnv();
export type Env = z.infer<typeof envSchema>;
