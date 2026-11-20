import { Request, Response } from "express";
import { AnalyticsService } from "../services/analyticsService";
import { asyncHandler } from "../utils/asyncHandler";
import { ResponseFormatter } from "../utils/ApiResponse";
import { MonthlyAnalyticsQueryInput } from "../validators/analyticsValidators";

export class AdminAnalyticsController {
  /**
   * GET /api/admin/analytics/overview
   * Platform-wide system metrics for administrative oversight
   */
  public static getOverview = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const overview = await AnalyticsService.getAdminOverview();
    ResponseFormatter.ok(res, "Admin analytics overview retrieved successfully", overview);
  });

  /**
   * GET /api/admin/analytics/monthly-bookings
   * Recent monthly booking and revenue trajectory
   */
  public static getMonthlyBookings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as MonthlyAnalyticsQueryInput;
    const months = query.months || 6;

    const metrics = await AnalyticsService.getAdminMonthlyBookings(months);
    ResponseFormatter.ok(res, "Monthly booking analytics retrieved successfully", metrics);
  });
}
