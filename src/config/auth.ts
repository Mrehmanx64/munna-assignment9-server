import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import mongoose from "mongoose";
import { env } from "./env";

// Helper to retrieve the active MongoDB database instance from Mongoose
export const getMongoDb = () => {
  if (!mongoose.connection || !mongoose.connection.db) {
    // Return connection directly from native client if ready
    const client = mongoose.connection.getClient();
    if (client) {
      return client.db();
    }
    throw new Error("MongoDB connection has not been initialized yet");
  }
  return mongoose.connection.db;
};

// Social providers configuration
const socialProvidersConfig: Record<string, { clientId: string; clientSecret: string }> = {};

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  socialProvidersConfig.google = {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
  };
}

export const createBetterAuth = () => {
  const db = getMongoDb();

  return betterAuth({
    database: mongodbAdapter(db),
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [
      env.CLIENT_URL,
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:3000",
    ],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 6,
    },
    socialProviders: socialProvidersConfig,
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "customer",
          required: false,
        },
        phone: {
          type: "string",
          required: false,
        },
        address: {
          type: "string",
          required: false,
        },
        avatarUrl: {
          type: "string",
          required: false,
        },
      },
    },
    plugins: [
      jwt({
        jwt: {
          expirationTime: env.JWT_EXPIRES_IN,
        },
      }),
    ],
  });
};

// Lazy-initialized auth instance
let authInstance: ReturnType<typeof createBetterAuth> | null = null;

export const getAuth = () => {
  if (!authInstance) {
    authInstance = createBetterAuth();
  }
  return authInstance;
};
