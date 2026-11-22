import { z } from "zod";

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),
    email: z
      .string()
      .trim()
      .email("Please provide a valid email address")
      .toLowerCase(),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100, "Password cannot exceed 100 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter"),
    confirmPassword: z.string().optional(),
    role: z
      .enum(["customer", "owner", "renter"])
      .optional()
      .default("customer")
      .transform((val) => (val === "owner" ? ("owner" as const) : ("customer" as const))),
    phone: z.string().trim().optional(),
    address: z.string().trim().optional(),
    avatarUrl: z.string().trim().url("Invalid avatar URL format").optional().or(z.literal("")),
  })
  .refine((data) => {
    if (data.confirmPassword && data.password !== data.confirmPassword) {
      return false;
    }
    return true;
  }, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .toLowerCase(),
  password: z
    .string()
    .min(1, "Password is required"),
});

export const googleAuthSchema = z.object({
  idToken: z.string().min(10, "Google ID token is required"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
