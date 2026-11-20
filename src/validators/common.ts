import { z } from "zod";

export const mongoIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid 24-character hex ObjectId");

export const mongoIdParamSchema = z.object({
  id: mongoIdSchema,
});

export const paginationQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default("1")
    .transform((val) => Math.max(1, parseInt(val, 10) || 1)),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => Math.min(100, Math.max(1, parseInt(val, 10) || 10))),
  sortBy: z.string().optional().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  search: z.string().trim().optional(),
});
