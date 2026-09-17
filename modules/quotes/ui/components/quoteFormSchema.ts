import { z } from "zod";

export const MAX_VOLUMES = 3;
const cepRegex = /^\d{5}-?\d{3}$/;

export const volumeSchema = z.object({
  id: z.string().min(1),
  comprimentoCm: z.number().optional(),
  larguraCm: z.number().optional(),
  alturaCm: z.number().optional(),
  pesoKg: z.number().optional(),
});

export const quoteFormSchema = z.object({
  origem: z.any().optional().default({}),
  destino: z.any().optional().default({}),
  modoOrigem: z.enum(["manual", "recorrente"]).optional(),
  modoDestino: z.enum(["manual", "recorrente"]).optional(),
  remetenteRecorrenteId: z.string().nullable().optional(),
  destinatarioRecorrenteId: z.string().nullable().optional(),
  origemCep: z
    .string()
    .trim()
    .transform((val) => {
      const normalized = val.replace(/\D/g, "");
      return normalized.length === 8 ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : val;
    })
    .refine((val) => cepRegex.test(val), { message: "CEP inválido." }),
  destinoCep: z
    .string()
    .trim()
    .transform((val) => {
      const normalized = val.replace(/\D/g, "");
      return normalized.length === 8 ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : val;
    })
    .refine((val) => cepRegex.test(val), { message: "CEP inválido." }),
  devolucao: z.boolean(),
  seguroValor: z
    .union([
      z.number().min(0, "Valor do seguro deve ser maior ou igual a zero."),
      z.literal(null),
      z.undefined(),
    ])
    .optional(),
  volumes: z
    .array(volumeSchema)
    .min(1, "Adicione ao menos um volume.")
    .max(MAX_VOLUMES, `Limite máximo de ${MAX_VOLUMES} volumes.`),
});

export type QuoteFormValues = z.input<typeof quoteFormSchema>;

export type RouteHeaderInfo = {
  cidade?: string;
  uf?: string;
  label?: string;
  cep?: string;
  isDefault?: boolean;
} | null;
