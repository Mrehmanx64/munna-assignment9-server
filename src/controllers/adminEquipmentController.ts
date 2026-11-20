import { Request, Response } from "express";
import { EquipmentService } from "../services/equipmentService";
import { ResponseFormatter } from "../utils/ApiResponse";
import { asyncHandler } from "../utils/asyncHandler";

export class AdminEquipmentController {
  /**
   * GET /api/admin/equipment
   * Admin: Get all equipment across all statuses with filtering and search
   */
  public static getAll = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const result = await EquipmentService.getAdminEquipment(req.query as any);
    ResponseFormatter.ok(res, "Admin equipment listings retrieved successfully", result.equipment, result.meta);
  });

  /**
   * PATCH /api/admin/equipment/:id/approve
   * Admin: Approve an equipment listing
   */
  public static approve = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const equipmentId = req.params.id as string;
    const approved = await EquipmentService.approveEquipment(equipmentId, adminId);
    ResponseFormatter.ok(res, "Equipment listing approved successfully", approved);
  });

  /**
   * PATCH /api/admin/equipment/:id/reject
   * Admin: Reject an equipment listing with a mandatory reason
   */
  public static reject = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const equipmentId = req.params.id as string;
    const reason = req.body.rejectionReason || req.body.reason;
    const rejected = await EquipmentService.rejectEquipment(equipmentId, adminId, reason);
    ResponseFormatter.ok(res, "Equipment listing rejected successfully", rejected);
  });

  /**
   * PUT /api/admin/equipment/:id
   * Admin: Update any equipment listing
   */
  public static update = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const equipmentId = req.params.id as string;
    const updated = await EquipmentService.adminUpdateEquipment(equipmentId, req.body);
    ResponseFormatter.ok(res, "Equipment listing updated successfully by administrator", updated);
  });

  /**
   * DELETE /api/admin/equipment/:id
   * Admin: Delete any equipment listing
   */
  public static remove = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const equipmentId = req.params.id as string;
    const result = await EquipmentService.adminDeleteEquipment(equipmentId);
    ResponseFormatter.ok(res, result.message, { id: result.id });
  });
}
