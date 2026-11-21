import { Types } from "mongoose";
import { User, IUser, UserRole } from "../models/userModel";
import { AdminUserQueryInput } from "../validators/userValidators";
import { ApiError } from "../utils/ApiError";
import { escapeRegex } from "../utils/sanitize";

export class UserService {
  /**
   * Helper to validate MongoDB ObjectId
   */
  public static validateObjectId(id: string, entityName = "User ID"): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest(`Invalid ${entityName} format: ${id}`);
    }
    return new Types.ObjectId(id);
  }

  /**
   * Admin: Retrieve paginated user directory with search and role filters
   * Never exposes password hashes or internal auth credentials
   */
  public static async getAdminUsers(query: AdminUserQueryInput): Promise<{
    users: Partial<IUser>[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const filter: Record<string, any> = {};

    // 1. Role filter
    if (query.role && query.role !== "all") {
      filter.role = query.role;
    }

    // 2. Search filter (name or email)
    if (query.search && query.search.trim()) {
      const term = escapeRegex(query.search.trim());
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { email: { $regex: term, $options: "i" } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [userDocs, total] = await Promise.all([
      User.find(filter)
        .select("name email role phone address avatarUrl image emailVerified createdAt updatedAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const users = userDocs.map((doc: any) => ({
      ...doc,
      id: doc._id.toString(),
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      users,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Admin: Update user role
   * Enforces self-demotion protection: Admins cannot remove their own admin privileges
   */
  public static async updateUserRole(
    adminUserId: string,
    targetUserId: string,
    newRole: UserRole
  ): Promise<Partial<IUser>> {
    const adminObjectId = this.validateObjectId(adminUserId, "Admin User ID");
    const targetObjectId = this.validateObjectId(targetUserId, "Target User ID");

    // Self-demotion guard
    if (adminObjectId.toString() === targetObjectId.toString() && newRole !== "admin") {
      throw ApiError.badRequest(
        "Administrators cannot demote themselves. Transfer administrative privileges from another administrator account."
      );
    }

    const user = await User.findById(targetObjectId);
    if (!user) {
      throw ApiError.notFound(`User with ID ${targetUserId} not found`);
    }

    user.role = newRole;
    await user.save();

    const sanitized = user.toJSON() as Partial<IUser>;
    return sanitized;
  }
}
