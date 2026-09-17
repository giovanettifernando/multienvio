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

// Schema para API de registro - aceita campos em português do frontend
export const RegisterSchema = z
  .object({
    nomeCompleto: z
      .string({ message: 'Nome completo é obrigatório' })
      .min(3, 'Nome deve ter no mínimo 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres')
      .trim()
      .optional(),
    name: z
      .string({ message: 'Nome é obrigatório' })
      .min(2, 'Nome deve ter no mínimo 2 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres')
      .trim()
      .optional(),
    email: z
      .string({ message: 'Email é obrigatório' })
      .email('Email inválido')
      .toLowerCase()
      .trim(),
    senha: z
      .string({ message: 'Senha é obrigatória' })
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .max(100, 'Senha deve ter no máximo 100 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Senha deve conter letra maiúscula, minúscula e número'
      )
      .optional(),
    password: z
      .string({ message: 'Senha é obrigatória' })
      .min(8, 'Senha deve ter no mínimo 8 caracteres')
      .max(100, 'Senha deve ter no máximo 100 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Senha deve conter letra maiúscula, minúscula e número'
      )
      .optional(),
    confirmarSenha: z
      .string()
      .optional(),
    telefone: z
      .string()
      .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((val) => val === '' ? null : val),
    phone: z
      .string()
      .regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX')
      .optional()
      .nullable()
      .or(z.literal(''))
      .transform((val) => val === '' ? null : val),
    aceiteTermos: z
      .union([z.boolean(), z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val === 'true' || val === '1' || val === 'on';
        if (typeof val === 'number') return val === 1;
        return false;
      }),
    acceptTerms: z
      .union([z.boolean(), z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val === 'true' || val === '1' || val === 'on';
        if (typeof val === 'number') return val === 1;
        return false;
      }),
    consentLGPD: z
      .union([z.boolean(), z.string(), z.number()])
      .optional()
      .transform((val) => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val === 'true' || val === '1' || val === 'on';
        if (typeof val === 'number') return val === 1;
        return false;
      }),
  })
  .superRefine((data, ctx) => {
    // Validar que pelo menos um campo de nome foi fornecido
    const name = data.nomeCompleto || data.name;
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Nome é obrigatório',
        path: ['nomeCompleto'],
      });
    }

    // Validar que pelo menos um campo de senha foi fornecido
    const password = data.senha || data.password;
    if (!password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Senha é obrigatória',
        path: ['senha'],
      });
    }

    // Validar confirmação de senha se fornecida
    if (data.confirmarSenha && password && data.confirmarSenha !== password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'As senhas não coincidem',
        path: ['confirmarSenha'],
      });
    }

    // Validar aceite de termos
    const termsAccepted = data.aceiteTermos || data.acceptTerms || data.consentLGPD;
    if (!termsAccepted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Você deve aceitar os termos de uso e política de privacidade',
        path: ['aceiteTermos'],
      });
    }
  })
  .transform((data) => ({
    name: data.nomeCompleto || data.name || '',
    email: data.email,
    password: data.senha || data.password || '',
    phone: data.telefone || data.phone || null,
    acceptTerms: data.aceiteTermos || data.acceptTerms || data.consentLGPD || false,
  }));

export type RegisterAPIInput = z.infer<typeof RegisterSchema>;

export const ForgotPasswordSchema = z.object({
  email: z
    .string({ message: 'Email é obrigatório' })
    .email('Email inválido')
    .toLowerCase()
    .trim(),
});

export type ForgotPasswordAPIInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string({ message: 'Token é obrigatório' }),
  password: z
    .string({ message: 'Senha é obrigatória' })
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(100, 'Senha deve ter no máximo 100 caracteres')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Senha deve conter letra maiúscula, minúscula e número'
    ),
});

export type ResetPasswordAPIInput = z.infer<typeof ResetPasswordSchema>;

