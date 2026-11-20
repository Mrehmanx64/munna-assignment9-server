import { Request, Response } from "express";
import { EquipmentService } from "../services/equipmentService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpStatus } from "../types";

export class OwnerEquipmentController {
  /**
   * POST /api/owner/equipment
   * Create a new equipment listing.
   * Owner role only. Status forced to Pending.
   */
  public static create = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const equipment = await EquipmentService.createEquipment(ownerId, req.body);
    ResponseFormatter.created(res, "Equipment listing created successfully and submitted for admin review", equipment);
  });

  /**
   * GET /api/owner/equipment
   * Get all equipment listings owned by authenticated owner
   */
  public static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const result = await EquipmentService.getOwnerEquipment(ownerId, req.query as any);
    ResponseFormatter.ok(res, "Owner equipment listings retrieved successfully", result.equipment, result.meta);
  });

  /**
   * GET /api/owner/equipment/:id
   * Get a single equipment listing owned by authenticated owner
   */
  public static getById = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const equipmentId = req.params.id as string;
    const equipment = await EquipmentService.getOwnerEquipmentById(ownerId, equipmentId);
    ResponseFormatter.ok(res, "Equipment listing retrieved successfully", equipment);
  });

  /**
   * PUT /api/owner/equipment/:id
   * Update own equipment listing
   */
  public static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const equipmentId = req.params.id as string;
    const equipment = await EquipmentService.updateOwnerEquipment(ownerId, equipmentId, req.body);
    ResponseFormatter.ok(res, "Equipment listing updated successfully", equipment);
  });

  /**
   * DELETE /api/owner/equipment/:id
   * Delete own equipment listing
   */
  public static remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const ownerId = req.user!.id;
    const equipmentId = req.params.id as string;
    const result = await EquipmentService.deleteOwnerEquipment(ownerId, equipmentId);
    ResponseFormatter.ok(res, result.message, { id: result.id });
  });
}
