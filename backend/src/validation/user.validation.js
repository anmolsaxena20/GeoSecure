import { z } from "zod";

export const userIdSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    email: z.string().email().optional(),
    cloudinaryUrl: z.string().url().optional(),
    themePreference: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "At least one field is required",
  });
