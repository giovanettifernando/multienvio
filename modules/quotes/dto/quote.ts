import { z } from "zod";

export const origemDestinoSchema = z.object({
  cepOrigem: z
    .string()
    .min(1, "Informe o CEP de origem")
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP de origem inválido"),
  cepDestino: z
    .string()
    .min(1, "Informe o CEP de destino")
    .regex(/^[0-9]{5}-?[0-9]{3}$/u, "CEP de destino inválido"),
  coleta: z.boolean().default(false),
  portaAPorta: z.boolean().default(false),
});

export const pacoteQuoteSchema = z
  .object({
    pesoKg: z.coerce
      .number()
      .positive("Informe o peso")
      .max(30, "Peso máximo 30kg"),
    valorDeclarado: z.coerce
      .number()
      .min(0, "Valor declarado deve ser positivo"),
    comprimentoCm: z.coerce
      .number()
      .positive()
      .max(150, "Comprimento máximo 150cm"),
    larguraCm: z.coerce
      .number()
      .positive()
      .max(120, "Largura máxima 120cm"),
    alturaCm: z.coerce
      .number()
      .positive()
      .max(120, "Altura máxima 120cm"),
    categoria: z
      .string()
      .trim()
      .min(2, "Informe a categoria"),
  })
  .refine(
    (pacote) =>
      pacote.comprimentoCm >= 16 &&
      pacote.larguraCm >= 11 &&
      pacote.alturaCm >= 2,
    {
      message: "Dimensões mínimas não atendidas (16x11x2cm)",
      path: ["comprimentoCm"],
    },
  );

export const transportadoraEnum = z.enum([
  "Correios",
  "Jadlog",
  "Loggi",
  "J&T",
]);

export const preferenciasSchema = z.object({
  prioridade: z.number().min(0, "Mínimo 0").max(100, "Máximo 100"),
  adicionais: z.object({
    seguro: z.boolean().default(false),
    avisoRecebimento: z.boolean().default(false),
    maoPropria: z.boolean().default(false),
  }),
  transportadoras: z.array(transportadoraEnum).optional(),
  usarTabelaContratada: z.boolean().default(false),
});

export const quoteSchema = z.object({
  origemDestino: origemDestinoSchema,
  pacote: pacoteQuoteSchema,
  preferencias: preferenciasSchema,
});

export type OrigemDestinoInput = z.infer<typeof origemDestinoSchema>;
export type PacoteQuoteInput = z.infer<typeof pacoteQuoteSchema>;
export type PreferenciasQuoteInput = z.infer<typeof preferenciasSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
