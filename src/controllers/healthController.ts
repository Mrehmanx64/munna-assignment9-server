import { Request, Response } from "express";
import { checkDatabaseHealth } from "../config/database";
import { env } from "../config/env";
import { ResponseFormatter } from "../utils/ApiResponse";

interface HealthData {
  service: string;
  status: "healthy" | "degraded";
  environment: string;
  uptime: {
    seconds: number;
    formatted: string;
  };
  timestamp: string;
  database: ReturnType<typeof checkDatabaseHealth>;
  memory: {
    heapUsedMB: number;
    heapTotalMB: number;
    rssMB: number;
  };
}

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d ${h}h ${m}m ${s}s`;
};

export const getHealth = (_req: Request, res: Response): void => {
  const dbHealth = checkDatabaseHealth();
  const uptimeSeconds = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  const isHealthy = dbHealth.status === "connected" || env.NODE_ENV === "development";

  const data: HealthData = {
    service: "rentora-backend-api",
    status: isHealthy ? "healthy" : "degraded",
    environment: env.NODE_ENV,
    uptime: {
      seconds: uptimeSeconds,
      formatted: formatUptime(uptimeSeconds),
    },
    timestamp: new Date().toISOString(),
    database: dbHealth,
    memory: {
      heapUsedMB: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMB: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMB: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    },
  };

  ResponseFormatter.ok(res, "Service health check", data);
};
