import { Request, Response } from "express";
import { UserService } from "../services/userService";
import { asyncHandler } from "../utils/asyncHandler";
import { ResponseFormatter } from "../utils/ApiResponse";
import { AdminUserQueryInput, UpdateUserRoleInput } from "../validators/userValidators";
import { UserRole } from "../models/userModel";

export class AdminUserController {
  /**
   * GET /api/admin/users
   * Retrieve platform user directory with search, role filters, and pagination
   */
  public static getUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const query = req.query as unknown as AdminUserQueryInput;

    const result = await UserService.getAdminUsers(query);

    ResponseFormatter.ok(
      res,
      "User directory retrieved successfully",
      result.users,
      result.meta
    );
  });

  /**
   * PATCH /api/admin/users/:id/role
   * Update a user's role with self-demotion protection
   */
  public static updateRole = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const adminUserId = req.user!.id;
    const targetUserId = req.params.id as string;
    const { role } = req.body as UpdateUserRoleInput;

    const updatedUser = await UserService.updateUserRole(
      adminUserId,
      targetUserId,
      role as UserRole
    );

    ResponseFormatter.ok(
      res,
      `User role updated to '${role}' successfully`,
      updatedUser
    );
  });
}
