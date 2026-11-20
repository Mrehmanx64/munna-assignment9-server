import { Request, Response } from "express";
import { EquipmentService } from "../services/equipmentService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class EquipmentController {
  /**
   * GET /api/equipment
   * Public: Get all approved equipment with search, category, rentalType, price, and availability filtering
   */
  public static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await EquipmentService.getPublicEquipment(req.query as any);
    ResponseFormatter.ok(res, "Public equipment listings retrieved successfully", result.equipment, result.meta);
  });

  /**
   * GET /api/equipment/featured
   * Public: Get top featured equipment (hard-capped at 6 via MongoDB limit)
   */
  public static getFeatured = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 6;
    const featured = await EquipmentService.getFeaturedEquipment(limit);
    ResponseFormatter.ok(res, "Featured equipment listings retrieved successfully", featured);
  });

  /**
   * GET /api/equipment/categories
   * Public: Get categories summary with listing counts
   */
  public static getCategories = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const categories = await EquipmentService.getCategoriesSummary();
    ResponseFormatter.ok(res, "Equipment categories retrieved successfully", categories);
  });

  /**
   * GET /api/equipment/:id
   * Public: Get approved equipment details by ID
   */
  public static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const equipmentId = req.params.id as string;
    const viewerId = req.user?.id;
    const viewerRole = req.user?.role;
    const equipment = await EquipmentService.getEquipmentById(equipmentId, viewerId, viewerRole);
    ResponseFormatter.ok(res, "Equipment details retrieved successfully", equipment);
  });
}
