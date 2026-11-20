import { z } from "zod";
import { mongoIdSchema } from "./common";

export const createBookingSchema = z
  .object({
    equipmentId: mongoIdSchema,
    startDate: z.string().datetime({ message: "Start date must be a valid ISO date string" }).or(
      z.string().regex(/^\d{4}-\d{2}-\d{2}/, "Start date must be in YYYY-MM-DD format")
    ),
    endDate: z.string().datetime({ message: "End date must be a valid ISO date string" }).or(
      z.string().regex(/^\d{4}-\d{2}-\d{2}/, "End date must be in YYYY-MM-DD format")
    ),
    quantity: z
      .number()
      .int("Quantity must be an integer")
      .min(1, "Quantity must be at least 1"),
    contactNumber: z
      .string()
      .trim()
      .min(7, "Contact number must be at least 7 characters"),
    deliveryAddress: z
      .string()
      .trim()
      .min(5, "Delivery address must be at least 5 characters"),
    additionalNotes: z.string().trim().optional(),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
    },
    {
      message: "End date must be strictly after the start date",
      path: ["endDate"],
    }
  );

export const updateBookingStatusSchema = z.object({
  bookingStatus: z.enum([
    "Pending",
    "Confirmed",
    "Active",
    "Completed",
    "Cancelled",
  ]),
});

export const availabilityQuerySchema = z
  .object({
    startDate: z.string().min(1, "startDate is required"),
    endDate: z.string().min(1, "endDate is required"),
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      return !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;
    },
    {
      message: "End date must be strictly after the start date",
      path: ["endDate"],
    }
  );

export const bookingQuerySchema = z.object({
  status: z.enum(["Pending", "Confirmed", "Active", "Completed", "Cancelled"]).optional(),
  paymentStatus: z.enum(["Pending", "Paid", "Failed", "Refunded"]).optional(),
  page: z.preprocess((val) => {
    if (typeof val === "string") return parseInt(val, 10);
    return val;
  }, z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => {
    if (typeof val === "string") return parseInt(val, 10);
    return val;
  }, z.number().int().min(1).max(100).default(10)),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
export type AvailabilityQueryInput = z.infer<typeof availabilityQuerySchema>;
export type BookingQueryInput = z.infer<typeof bookingQuerySchema>;
