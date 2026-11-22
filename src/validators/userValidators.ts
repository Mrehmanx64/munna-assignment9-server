import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const adminUserQuerySchema = z.object({
  search: z.string().optional(),
  role: z.enum(["customer", "owner", "admin", "all"]).optional().default("all"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(["customer", "owner", "admin"]),
});

export const userIdParamSchema = z.object({
  id: z
    .string()
    .regex(objectIdRegex, "Invalid user ID format (must be a 24-character hexadecimal ObjectId)"),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
  phone: z.string().trim().optional(),
  address: z.string().trim().optional(),
  avatarUrl: z.string().trim().url("Invalid avatar URL format").optional().or(z.literal("")),
  image: z.string().trim().url("Invalid image URL format").optional().or(z.literal("")),
});

export type AdminUserQueryInput = z.infer<typeof adminUserQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
