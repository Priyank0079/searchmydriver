import { z } from "zod";

export const userValidationSchema = z.object({
  name: z
    .string()
    .min(2, "Minimum length 2 required")
    .trim(),

  email: z
    .string()
    .email("Invalid email format")
    .trim(),

  phone_no: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits"),

role: z
  .string()
  .refine((val) => ["user", "admin"].includes(val), {
    message: "Role must be user or admin",
  }).optional(),

  password: z
    .string()
    .min(8, "Minimum 8 characters")
    .max(15, "Maximum 15 characters")
    .trim(),
});


export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
