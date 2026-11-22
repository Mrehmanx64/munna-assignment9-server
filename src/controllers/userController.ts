import { Request, Response } from "express";
import { UserService } from "../services/userService";
import { asyncHandler } from "../utils/asyncHandler";
import { ResponseFormatter } from "../utils/ApiResponse";
import { UpdateProfileInput } from "../validators/userValidators";

export class UserController {
  /**
   * PATCH /api/users/me
   * Update own profile (name, phone, address, avatarUrl)
   */
  public static updateMe = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const body = req.body as UpdateProfileInput;

    const updatedUser = await UserService.updateProfile(userId, body);

    ResponseFormatter.ok(
      res,
      "Profile updated successfully",
      { user: updatedUser }
    );
  });
}
