import { z } from 'zod';

/**
 * Schema de validação para login admin
 * Regras mais rígidas que cliente
 */
export const AdminLoginSchema = z.object({
  email: z
    .string({ message: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z
    .string({ message: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

export type AdminLoginInput = z.infer<typeof AdminLoginSchema>;

/**
 * Schema de validação para registro de staff
 * Apenas admin pode criar novos staff
 */
export const AdminRegisterSchema = z.object({
  name: z
    .string({ message: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter no mínimo 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres')
    .trim(),
  email: z
    .string({ message: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z
    .string({ message: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(100, 'Senha deve ter no máximo 100 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Senha deve conter letra maiúscula, minúscula e número'
    ),
  roleId: z
    .string()
    .optional(), // Se não fornecido, usa 'operator' por padrão
});

export type AdminRegisterInput = z.infer<typeof AdminRegisterSchema>;
