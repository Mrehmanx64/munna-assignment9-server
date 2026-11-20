import { Request, Response } from "express";
import { AnalyticsService } from "../services/analyticsService";
import { asyncHandler } from "../utils/asyncHandler";
import { ResponseFormatter } from "../utils/ApiResponse";
import { MonthlyAnalyticsQueryInput } from "../validators/analyticsValidators";

export class OwnerAnalyticsController {
  /**
   * GET /api/owner/analytics/overview
   * Fleet performance overview isolated strictly to authenticated owner
   */
  public static getOverview = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;

    const overview = await AnalyticsService.getOwnerOverview(ownerId);
    ResponseFormatter.ok(res, "Owner analytics overview retrieved successfully", overview);
  });

  /**
   * GET /api/owner/analytics/monthly-earnings
   * Historical monthly earnings isolated strictly to authenticated owner
   */
  public static getMonthlyEarnings = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const query = req.query as unknown as MonthlyAnalyticsQueryInput;
    const months = query.months || 6;

    const metrics = await AnalyticsService.getOwnerMonthlyEarnings(ownerId, months);
    ResponseFormatter.ok(res, "Owner monthly earnings retrieved successfully", metrics);
  });
}
