import { z } from "zod";

const rentalTypeSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const lower = val.toLowerCase();
    if (lower === "daily") return "Daily";
    if (lower === "weekly") return "Weekly";
    if (lower === "monthly") return "Monthly";
  }
  return val;
}, z.enum(["Daily", "Weekly", "Monthly"]));

const equipmentConditionSchema = z.preprocess((val) => {
  if (typeof val === "string") {
    const map: Record<string, string> = {
      "like new": "Like New",
      "excellent": "Excellent",
      "good": "Good",
      "fair": "Fair",
    };
    const key = val.toLowerCase();
    if (map[key]) return map[key];
  }
  return val;
}, z.enum(["Like New", "Excellent", "Good", "Fair"]));

const specificationSchema = z.object({
  label: z.string().trim().min(1, "Specification label is required"),
  value: z.string().trim().min(1, "Specification value is required"),
});

export const createEquipmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Equipment name must be at least 2 characters")
    .max(150, "Equipment name cannot exceed 150 characters")
    .optional(),
  title: z
    .string()
    .trim()
    .min(2, "Equipment title must be at least 2 characters")
    .max(150, "Equipment title cannot exceed 150 characters")
    .optional(),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(3000, "Description cannot exceed 3000 characters"),
  category: z
    .string()
    .trim()
    .min(2, "Category must be at least 2 characters"),
  location: z
    .string()
    .trim()
    .min(2, "Location must be at least 2 characters"),
  rentalPrice: z
    .number()
    .positive("Rental price must be greater than 0"),
  rentalType: rentalTypeSchema.default("Daily"),
  availableQuantity: z
    .number()
    .int("Available quantity must be an integer")
    .min(0, "Available quantity cannot be negative")
    .default(1),
  totalQuantity: z
    .number()
    .int("Total quantity must be an integer")
    .min(1, "Total quantity must be at least 1")
    .default(1),
  condition: equipmentConditionSchema.default("Excellent"),
  brand: z
    .string()
    .trim()
    .min(1, "Brand is required"),
  model: z
    .string()
    .trim()
    .min(1, "Model is required"),
  imageUrl: z
    .string()
    .trim()
    .min(5, "Equipment image URL is required"),
  images: z.array(z.string()).optional(),
  rentalTerms: z
    .string()
    .trim()
    .min(5, "Rental terms must be at least 5 characters"),
  specifications: z.array(specificationSchema).optional(),
  featured: z.boolean().optional().default(false),
}).refine((data) => data.name || data.title, {
  message: "Either name or title must be provided for the equipment",
  path: ["name"],
});

export const updateEquipmentSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  title: z.string().trim().min(2).max(150).optional(),
  description: z.string().trim().min(10).max(3000).optional(),
  category: z.string().trim().min(2).optional(),
  location: z.string().trim().min(2).optional(),
  rentalPrice: z.number().positive().optional(),
  rentalType: rentalTypeSchema.optional(),
  availableQuantity: z.number().int().min(0).optional(),
  totalQuantity: z.number().int().min(1).optional(),
  condition: equipmentConditionSchema.optional(),
  brand: z.string().trim().min(1).optional(),
  model: z.string().trim().min(1).optional(),
  imageUrl: z.string().trim().min(5).optional(),
  images: z.array(z.string()).optional(),
  rentalTerms: z.string().trim().min(5).optional(),
  specifications: z.array(specificationSchema).optional(),
  featured: z.boolean().optional(),
});

export const adminEquipmentStatusSchema = z.object({
  status: z.enum(["Approved", "Rejected"]).optional().default("Rejected"),
  rejectionReason: z.string().trim().optional(),
  reason: z.string().trim().optional(),
}).refine((data) => {
  const reasonText = data.rejectionReason || data.reason;
  if (data.status === "Rejected" && (!reasonText || reasonText.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: "Rejection reason is required when rejecting an equipment listing",
  path: ["rejectionReason"],
});

export const equipmentQuerySchema = z.object({
  search: z.string().trim().optional(),
  q: z.string().trim().optional(),
  category: z.string().trim().optional(),
  location: z.string().trim().optional(),
  rentalType: z.preprocess((val) => {
    if (typeof val === "string") {
      const lower = val.toLowerCase();
      if (lower === "daily") return "Daily";
      if (lower === "weekly") return "Weekly";
      if (lower === "monthly") return "Monthly";
    }
    return val;
  }, z.enum(["Daily", "Weekly", "Monthly"]).optional()),
  minPrice: z.preprocess((val) => {
    if (typeof val === "string") return parseFloat(val);
    return val;
  }, z.number().min(0).optional()),
  maxPrice: z.preprocess((val) => {
    if (typeof val === "string") return parseFloat(val);
    return val;
  }, z.number().min(0).optional()),
  available: z.preprocess((val) => {
    if (typeof val === "string") return val.toLowerCase() === "true" || val === "1";
    if (typeof val === "boolean") return val;
    return undefined;
  }, z.boolean().optional()),
  sort: z.enum(["price_asc", "price_desc", "newest", "rating"]).optional(),
  page: z.preprocess((val) => {
    if (typeof val === "string") return parseInt(val, 10);
    return val;
  }, z.number().int().min(1).default(1)),
  limit: z.preprocess((val) => {
    if (typeof val === "string") return parseInt(val, 10);
    return val;
  }, z.number().int().min(1).max(100).default(12)),
  status: z.enum(["Pending", "Approved", "Rejected"]).optional(),
});

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;
export type AdminEquipmentStatusInput = z.infer<typeof adminEquipmentStatusSchema>;
export type EquipmentQueryInput = z.infer<typeof equipmentQuerySchema>;
