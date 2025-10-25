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
