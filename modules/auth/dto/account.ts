import { z } from "zod";

const telefoneRegex = /^\(?\d{2}\)?\s?\d{5}-?\d{4}$/u;

export const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Informe o nome")
    .min(3, "Informe o nome completo"),
  email: z.string().email(),
  phone: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || telefoneRegex.test(value),
      "Informe um telefone válido (DDD + 9 dígitos)",
    ),
  avatarUrl: z
    .string()
    .url("URL do avatar inválida")
    .optional(),
});

export type ProfileData = z.infer<typeof profileSchema>;

// ============================================================================
// Recurring Items Schemas
// ============================================================================

export const RecurringItemCreateSchema = z.object({
  descricao: z
    .string({ message: 'Descrição é obrigatória' })
    .min(1, 'Descrição é obrigatória')
    .max(255, 'Descrição deve ter no máximo 255 caracteres')
    .trim(),
  valorUnitario: z
    .number({ message: 'Valor unitário é obrigatório' })
    .positive('Valor unitário deve ser positivo')
    .max(999999.99, 'Valor máximo excedido'),
});

export type RecurringItemCreateInput = z.infer<typeof RecurringItemCreateSchema>;

export const RecurringItemUpdateSchema = z.object({
  descricao: z
    .string()
    .min(1, 'Descrição não pode ser vazia')
    .max(255, 'Descrição deve ter no máximo 255 caracteres')
    .trim()
    .optional(),
  valorUnitario: z
    .number()
    .positive('Valor unitário deve ser positivo')
    .max(999999.99, 'Valor máximo excedido')
    .optional(),
});

export type RecurringItemUpdateInput = z.infer<typeof RecurringItemUpdateSchema>;

// ============================================================================
// User Preferences Schema
// ============================================================================

export const UserPreferencesSchema = z.object({
  defaultPostingUnitId: z
    .string()
    .min(1, 'ID da unidade inválido')
    .nullable()
    .optional(),
});

export type UserPreferencesInput = z.infer<typeof UserPreferencesSchema>;
