import { z } from "zod";

export const topupSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Valor deve ser positivo")
    .max(50000, "Valor máximo R$ 50.000,00")
    .refine((v) => !!v, "Informe o valor"), // substitui required_error
});

export const cardSchema = z.object({
  holder: z
    .string()
    .min(1, "Informe o titular")
    .min(3, "Informe o titular"),
  number: z
    .string()
    .min(1, "Informe o número")
    .regex(/^[0-9]{12,19}$/u, "Número inválido"),
  expMonth: z.coerce
    .number()
    .min(1, "Informe o mês")
    .max(12),
  expYear: z.coerce
    .number()
    .min(new Date().getFullYear(), "Informe o ano")
    .max(new Date().getFullYear() + 15),
  cvc: z
    .string()
    .min(1, "Informe o CVC")
    .regex(/^[0-9]{3,4}$/u, "CVC inválido"),
});

export type TopupInput = z.infer<typeof topupSchema>;
export type CardInput = z.infer<typeof cardSchema>;
