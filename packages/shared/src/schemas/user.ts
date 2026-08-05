import { z } from "zod";
import { Role } from "../enums/role";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  organizationId: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;
