import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const favoriteParamsSchema = z.object({
  equipmentId: z
    .string()
    .regex(objectIdRegex, "Invalid equipment ID format (must be a 24-character hexadecimal ObjectId)"),
});

export const favoriteQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type FavoriteParamsInput = z.infer<typeof favoriteParamsSchema>;
export type FavoriteQueryInput = z.infer<typeof favoriteQuerySchema>;
