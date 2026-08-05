import { z } from "zod";
import { Role } from "../enums/role";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
  organizationId: z.string(),
  fullName: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const tokensSchema = z.object({
  accessToken: z.string(),
});
export type Tokens = z.infer<typeof tokensSchema>;
