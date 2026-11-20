import http from "http";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase, disconnectDatabase } from "./config/database";

let server: http.Server | null = null;

const startServer = async (): Promise<void> => {
  try {
    // 1. Establish database connection
    console.log("⏳ Connecting to MongoDB...");
    try {
      await connectDatabase();
    } catch (dbError) {
      console.warn("⚠️ Warning: Initial MongoDB connection failed. Server will start in degraded mode.");
      if (env.NODE_ENV === "production") {
        throw dbError;
      }
    }

    // 2. Start HTTP server
    server = app.listen(env.PORT, () => {
      console.log(`
=============================================================
🚀 Rentora Equipment Rental Platform - Backend Server
=============================================================
  📡 Environment : ${env.NODE_ENV}
  🌐 Server Port : ${env.PORT}
  🔗 Base URL    : http://localhost:${env.PORT}
  ❤️  Health Check: http://localhost:${env.PORT}/api/health
  💻 Client URL  : ${env.CLIENT_URL}
  🆔 Process ID  : ${process.pid}
=============================================================
      `);
    });
  } catch (error) {
    console.error("❌ Fatal error during server startup:", error);
    process.exit(1);
  }
};

// Graceful shutdown procedure
const gracefulShutdown = async (signal: string): Promise<void> => {
  console.log(`\n🛑 ${signal} received. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log("🔒 HTTP server closed for new connections");
      try {
        await disconnectDatabase();
        console.log("👋 Graceful shutdown complete. Exiting process.");
        process.exit(0);
      } catch (err) {
        console.error("❌ Error while closing database connection:", err);
        process.exit(1);
      }
    });

    // Force shutdown if taking longer than 10 seconds
    setTimeout(() => {
      console.error("⚠️ Forcefully terminating server after timeout");
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

// Signal listeners
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Unhandled Promise Rejections & Uncaught Exceptions
process.on("unhandledRejection", (reason: unknown) => {
  console.error("💥 Unhandled Rejection at:", reason);
  gracefulShutdown("UNHANDLED_REJECTION");
});

process.on("uncaughtException", (error: Error) => {
  console.error("💥 Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

// Boot server
startServer();
