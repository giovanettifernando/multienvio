import { z } from "zod";

const telefoneRegex = /^\(?\d{2}\)?\s?\d{5}-?\d{4}$/;
const senhaRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[\S]{8,}$/;

const optionalText = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value?.length ? value : undefined));

export const cadastroSchema = z
  .object({
    nomeCompleto: z
      .string()
      .trim()
      .min(1, "Informe o nome completo")
      .min(3, "Informe o nome completo"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "Informe o e-mail")
      .email("Informe um e-mail válido"),
    senha: z
      .string()
      .min(1, "Informe a senha")
      .regex(
        senhaRegex,
        "A senha deve ter 8 caracteres, letra maiúscula, minúscula e número",
      ),
    confirmarSenha: z
      .string()
      .min(1, "Confirme a senha"),
    telefone: optionalText.refine(
      (value) => !value || telefoneRegex.test(value),
      "Informe um telefone válido (DDD + 9 dígitos)",
    ),
    consentLGPD: z
      .boolean()
      .refine((value) => value, "É necessário aceitar a Política de Privacidade"),
  })
  .superRefine((data, ctx) => {
    if (data.senha !== data.confirmarSenha) {
      ctx.addIssue({
        code: "custom",
        message: "As senhas precisam ser iguais",
        path: ["confirmarSenha"],
      });
    }
  });

export type CadastroInput = z.infer<typeof cadastroSchema>;

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail")
    .email("Informe um e-mail válido"),
  senha: z
    .string()
    .min(1, "Informe a senha"),
  lembrarEmail: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Informe o e-mail")
    .email("Informe um e-mail válido"),
});

export type ForgotInput = z.infer<typeof forgotSchema>;

export const resetSchema = z
  .object({
    senha: z
      .string()
      .min(1, "Informe a nova senha")
      .regex(
        senhaRegex,
        "A senha deve ter 8 caracteres, letra maiúscula, minúscula e número",
      ),
    confirmarSenha: z
      .string()
      .min(1, "Confirme a nova senha"),
  })
  .superRefine((data, ctx) => {
    if (data.senha !== data.confirmarSenha) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmarSenha"],
        message: "As senhas não coincidem",
      });
    }
  });

export type ResetInput = z.infer<typeof resetSchema>;

// ============================================================================
// API Schemas (English names for backend routes)
// ============================================================================

export const LoginSchema = z.object({
  email: z
    .string({ message: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
  password: z
    .string({ message: 'Senha é obrigatória' })
    .min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

export type LoginAPIInput = z.infer<typeof LoginSchema>;

export const RegisterSchema = z
  .object({
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
      .min(6, 'Senha deve ter no mínimo 6 caracteres')
      .max(100, 'Senha deve ter no máximo 100 caracteres'),
    phone: z
      .string()
      .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
      .optional()
      .nullable(),
  });

export type RegisterAPIInput = z.infer<typeof RegisterSchema>;
