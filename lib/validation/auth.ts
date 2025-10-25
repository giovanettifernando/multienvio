import { z } from "zod";

const telefoneRegex = /^\(?\d{2}\)?\s?\d{5}-?\d{4}$/;
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;
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
    empresa: optionalText,
    cnpj: optionalText.refine(
      (value) => !value || cnpjRegex.test(value),
      "Informe um CNPJ no formato 00.000.000/0000-00",
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
