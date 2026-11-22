import { Request, Response } from "express";
import { Types } from "mongoose";
import { User, RoleUpgradeRequest } from "../models";
import { ResponseFormatter } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

export class UpgradeController {
  /**
   * POST /api/users/upgrade-request
   * Customer: Request role upgrade to Fleet Owner
   */
  public static createRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest("Invalid user ID");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound("User not found");
    }

    if (user.role === "owner" || user.role === "admin") {
      throw ApiError.badRequest(`You already have ${user.role === "admin" ? "Administrator" : "Fleet Owner"} clearance.`);
    }

    // Check for existing pending request
    const existing = await RoleUpgradeRequest.findOne({
      user: user._id,
      status: "pending",
    });

    if (existing) {
      ResponseFormatter.ok(res, "An upgrade request is already pending administrator review.", existing);
      return;
    }

    const newRequest = await RoleUpgradeRequest.create({
      user: user._id,
      userName: user.name,
      userEmail: user.email,
      requestedRole: "owner",
      reason: req.body?.reason || "Contractor requested upgrade to Fleet Owner to list machinery assets.",
    });

    ResponseFormatter.created(
      res,
      "Upgrade request submitted successfully. A platform administrator will review your account.",
      newRequest
    );
  });

  /**
   * GET /api/users/upgrade-request/status
   * Customer: Get current user's upgrade request status
   */
  public static getMyStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;

    if (!Types.ObjectId.isValid(userId)) {
      throw ApiError.badRequest("Invalid user ID");
    }

    const latest = await RoleUpgradeRequest.findOne({ user: userId }).sort({ createdAt: -1 });

    ResponseFormatter.ok(res, "Upgrade request status retrieved", {
      hasPendingRequest: latest?.status === "pending",
      request: latest || null,
    });
  });

  /**
   * GET /api/admin/upgrade-requests
   * Admin: View all incoming contractor upgrade requests
   */
  public static getAdminRequests = asyncHandler(async (_req: Request, res: Response): Promise<void> => {
    const requests = await RoleUpgradeRequest.find().sort({ createdAt: -1 }).limit(50);
    const pendingCount = requests.filter((r) => r.status === "pending").length;

    ResponseFormatter.ok(res, "Upgrade requests retrieved successfully", requests, {
      total: requests.length,
      pendingCount,
    });
  });

  /**
   * PATCH /api/admin/upgrade-requests/:id/approve
   * Admin: Approve an upgrade request and promote user to Fleet Owner
   */
  public static approveRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const adminName = req.user!.name || "Administrator";
    const requestId = req.params.id as string;

    if (!Types.ObjectId.isValid(requestId)) {
      throw ApiError.badRequest("Invalid upgrade request ID");
    }

    const request = await RoleUpgradeRequest.findById(requestId);
    if (!request) {
      throw ApiError.notFound("Upgrade request not found");
    }

    if (request.status !== "pending") {
      throw ApiError.badRequest(
        `This request was already ${request.status} by Admin ${request.reviewedByName || "another administrator"}.`
      );
    }

    request.status = "approved";
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedByName = adminName;
    request.reviewedAt = new Date();
    await request.save();

    // Promote the user in the database
    await User.findByIdAndUpdate(request.user, { role: "owner" });

    ResponseFormatter.ok(
      res,
      `User ${request.userName} has been successfully promoted to Fleet Owner by Admin ${adminName}.`,
      request
    );
  });

  /**
   * PATCH /api/admin/upgrade-requests/:id/reject
   * Admin: Reject an upgrade request
   */
  public static rejectRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const adminName = req.user!.name || "Administrator";
    const requestId = req.params.id as string;

    if (!Types.ObjectId.isValid(requestId)) {
      throw ApiError.badRequest("Invalid upgrade request ID");
    }

    const request = await RoleUpgradeRequest.findById(requestId);
    if (!request) {
      throw ApiError.notFound("Upgrade request not found");
    }

    if (request.status !== "pending") {
      throw ApiError.badRequest(
        `This request was already ${request.status} by Admin ${request.reviewedByName || "another administrator"}.`
      );
    }

    request.status = "rejected";
    request.reviewedBy = new Types.ObjectId(adminId);
    request.reviewedByName = adminName;
    request.reviewedAt = new Date();
    await request.save();

    ResponseFormatter.ok(
      res,
      `Upgrade request for ${request.userName} was rejected by Admin ${adminName}.`,
      request
    );
  });
}
