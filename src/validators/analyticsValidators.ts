import { z } from "zod";

export const monthlyAnalyticsQuerySchema = z.object({
  months: z.coerce
    .number()
    .int()
    .min(1, "Months must be at least 1")
    .max(24, "Months cannot exceed 24")
    .default(6),
});

export type MonthlyAnalyticsQueryInput = z.infer<typeof monthlyAnalyticsQuerySchema>;
