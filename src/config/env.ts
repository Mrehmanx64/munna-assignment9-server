import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env file
dotenv.config();

const baseEnvSchema = z.object({
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
  STRIPE_WEBHOOK_SECRET: z.string().default("whsec_placeholder"),
  STRIPE_SUCCESS_URL: z
    .string()
    .default(
      "http://localhost:3000/dashboard/customer/rentals?status=success&session_id={CHECKOUT_SESSION_ID}"
    ),
  STRIPE_CANCEL_URL: z
    .string()
    .default("http://localhost:3000/equipment?status=cancelled"),
  IMGBB_API_KEY: z.string().default("placeholder_imgbb_key"),
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
});

const envSchema = baseEnvSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV === "production") {
    // 1. Stripe Live Keys Verification: Must use live Stripe credentials in production
    if (
      !data.STRIPE_SECRET_KEY ||
      data.STRIPE_SECRET_KEY.includes("placeholder") ||
      !data.STRIPE_SECRET_KEY.startsWith("sk_live_")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_SECRET_KEY"],
        message:
          "In production, STRIPE_SECRET_KEY must be a valid live Stripe secret key starting with 'sk_live_'. Test keys ('sk_test_') and placeholders are strictly prohibited.",
      });
    }

    if (
      !data.STRIPE_WEBHOOK_SECRET ||
      data.STRIPE_WEBHOOK_SECRET.includes("placeholder") ||
      !data.STRIPE_WEBHOOK_SECRET.startsWith("whsec_")
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STRIPE_WEBHOOK_SECRET"],
        message:
          "In production, STRIPE_WEBHOOK_SECRET must be a valid Stripe webhook secret starting with 'whsec_'. Placeholders are strictly prohibited.",
      });
    }

    // 2. JWT and Security Secrets Verification
    if (
      !data.JWT_SECRET ||
      data.JWT_SECRET === "rentora_default_development_jwt_secret_key_32_chars" ||
      data.JWT_SECRET.length < 32
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message:
          "In production, JWT_SECRET must be a custom secret at least 32 characters long.",
      });
    }

    if (
      !data.BETTER_AUTH_SECRET ||
      data.BETTER_AUTH_SECRET === "rentora_default_better_auth_secret_key_32_chars" ||
      data.BETTER_AUTH_SECRET.length < 32
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["BETTER_AUTH_SECRET"],
        message:
          "In production, BETTER_AUTH_SECRET must be a custom secret at least 32 characters long.",
      });
    }

    // 3. ImgBB API Key Verification
    if (!data.IMGBB_API_KEY || data.IMGBB_API_KEY === "placeholder_imgbb_key") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IMGBB_API_KEY"],
        message:
          "In production, IMGBB_API_KEY must be a valid live ImgBB API key.",
      });
    }

    // 4. Client URL Verification
    if (!data.CLIENT_URL || data.CLIENT_URL.includes("localhost")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLIENT_URL"],
        message:
          "In production, CLIENT_URL must point to a live production domain (e.g. https://rentora-marketplace.vercel.app), not localhost.",
      });
    }
  }
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
