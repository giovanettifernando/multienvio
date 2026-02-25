/**
 * Schemas de validação para usuários admin
 */
import { z } from "zod";

export const adminUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nome é obrigatório")
    .min(3, "Nome deve ter pelo menos 3 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: z
    .string()
    .trim()
    .min(1, "E-mail é obrigatório")
    .email("E-mail inválido")
    .toLowerCase(),
  phone: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val?.trim() ? val : null)),
  status: z.enum(["active", "blocked"]),
  roles: z
    .array(z.string())
    .min(1, "Selecione pelo menos uma permissão")
    .refine(
      (roles) => {
        // Se tem admin.super, não precisa de outras
        if (roles.includes("admin.super")) return true;
        // Senão, precisa de pelo menos uma role
        return roles.length > 0;
      },
      { message: "Selecione pelo menos uma permissão" }
    ),
});

export const updateAdminUserSchema = adminUserSchema.partial();

export const filtersSchema = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "active", "blocked"]).optional(),
  role: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(100).optional(),
  sort: z
    .enum(["name_asc", "name_desc", "updated_asc", "updated_desc"])
    .optional(),
});

export const toggleStatusSchema = z.object({
  status: z.enum(["active", "blocked"]),
});

