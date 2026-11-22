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

const specificationsPreprocessor = z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (val && typeof val === "object") {
    return Object.entries(val).map(([label, value]) => ({
      label,
      value: String(value),
    }));
  }
  return [];
}, z.array(specificationSchema).optional().default([]));

const rentalTermsSchema = z.preprocess((val) => {
  if (Array.isArray(val)) {
    return val.filter((t) => typeof t === "string" && t.trim().length > 0).join("\n").trim();
  }
  if (typeof val === "string") {
    return val.trim();
  }
  return val;
}, z.string().min(5, "Rental terms must be at least 5 characters"));

const preprocessEquipmentInput = (raw: unknown) => {
  if (!raw || typeof raw !== "object") return raw;
  const input = { ...(raw as Record<string, any>) };

  // Harmonize rentalTerms and terms
  if (!input.rentalTerms && input.terms) {
    input.rentalTerms = input.terms;
  }
  if (!input.terms && input.rentalTerms) {
    input.terms = input.rentalTerms;
  }

  // Preprocess rentalTerms if array
  if (Array.isArray(input.rentalTerms)) {
    input.rentalTerms = input.rentalTerms
      .filter((t: any) => typeof t === "string" && t.trim().length > 0)
      .join("\n")
      .trim();
  }

  // Fallback default for rentalTerms if empty
  if (!input.rentalTerms || (typeof input.rentalTerms === "string" && input.rentalTerms.trim().length < 5)) {
    input.rentalTerms = "Standard commercial equipment rental terms and operating safety guidelines apply.";
  }

  // Harmonize name and title
  if (!input.name && input.title) {
    input.name = input.title;
  }
  if (!input.title && input.name) {
    input.title = input.name;
  }

  // Harmonize imageUrl and images
  if (!input.imageUrl && Array.isArray(input.images) && input.images.length > 0) {
    input.imageUrl = input.images[0];
  }
  if (input.imageUrl && (!Array.isArray(input.images) || input.images.length === 0)) {
    input.images = [input.imageUrl];
  }

  return input;
};

export const createEquipmentSchema = z.preprocess(
  preprocessEquipmentInput,
  z.object({
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
    rentalPrice: z.coerce
      .number()
      .positive("Rental price must be greater than 0"),
    rentalType: rentalTypeSchema.default("Daily"),
    availableQuantity: z.coerce
      .number()
      .int("Available quantity must be an integer")
      .min(0, "Available quantity cannot be negative")
      .default(1),
    totalQuantity: z.coerce
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
    rentalTerms: rentalTermsSchema.default("Standard commercial equipment rental terms and operating safety guidelines apply."),
    terms: z.any().optional(),
    specifications: specificationsPreprocessor,
    featured: z.boolean().optional().default(false),
  }).refine((data) => data.name || data.title, {
    message: "Either name or title must be provided for the equipment",
    path: ["name"],
  })
);

export const updateEquipmentSchema = z.preprocess(
  preprocessEquipmentInput,
  z.object({
    name: z.string().trim().min(2).max(150).optional(),
    title: z.string().trim().min(2).max(150).optional(),
    description: z.string().trim().min(10).max(3000).optional(),
    category: z.string().trim().min(2).optional(),
    location: z.string().trim().min(2).optional(),
    rentalPrice: z.coerce.number().positive().optional(),
    rentalType: rentalTypeSchema.optional(),
    availableQuantity: z.coerce.number().int().min(0).optional(),
    totalQuantity: z.coerce.number().int().min(1).optional(),
    condition: equipmentConditionSchema.optional(),
    brand: z.string().trim().min(1).optional(),
    model: z.string().trim().min(1).optional(),
    imageUrl: z.string().trim().min(5).optional(),
    images: z.array(z.string()).optional(),
    rentalTerms: rentalTermsSchema.optional(),
    terms: z.any().optional(),
    specifications: z.preprocess((val) => {
      if (Array.isArray(val)) return val;
      if (val && typeof val === "object") {
        return Object.entries(val).map(([label, value]) => ({
          label,
          value: String(value),
        }));
      }
      return val;
    }, z.array(specificationSchema).optional()),
    featured: z.boolean().optional(),
  })
);

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
