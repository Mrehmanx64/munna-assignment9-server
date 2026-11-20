import mongoose from "mongoose";
import { env } from "./env";

export interface DatabaseHealth {
  status: "connected" | "disconnected" | "connecting" | "disconnecting";
  host?: string;
  name?: string;
}

const connectionStatusMap: Record<number, DatabaseHealth["status"]> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export const connectDatabase = async (): Promise<typeof mongoose> => {
  try {
    // Register lifecycle listeners once
    if (mongoose.connection.listeners("connected").length === 0) {
      mongoose.connection.on("connected", () => {
        console.log(`📦 MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      });

      mongoose.connection.on("error", (err) => {
        console.error("❌ MongoDB connection error:", err);
      });

      mongoose.connection.on("disconnected", () => {
        console.warn("⚠️ MongoDB disconnected. Attempting reconnection...");
      });
    }

    const conn = await mongoose.connect(env.MONGODB_URI, {
      autoIndex: env.NODE_ENV !== "production",
      serverSelectionTimeoutMS: 5000,
    });

    return conn;
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log("📦 MongoDB connection closed gracefully");
  }
};

export const checkDatabaseHealth = (): DatabaseHealth => {
  const readyState = mongoose.connection.readyState;
  const status = connectionStatusMap[readyState] ?? "disconnected";

  return {
    status,
    host: mongoose.connection.host || undefined,
    name: mongoose.connection.name || undefined,
  };
};
