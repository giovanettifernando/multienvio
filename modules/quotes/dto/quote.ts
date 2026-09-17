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

/**
 * Dimensões mínimas aceitas para um volume, em centímetros.
 *
 * Regra de negócio do Multienvio — mais restritiva que o mínimo dos Correios
 * (que valida as três dimensões ORDENADAS: menor ≥ 2, média ≥ 11, maior ≥ 16,
 * em `platform/integrations/correios/correios-volume-validator.ts`). Qualquer
 * volume que passe por estes mínimos também satisfaz os dos Correios.
 *
 * Exportado para que os formulários mostrem o mesmo número no texto de ajuda —
 * sem isso, o valor da dica e o da validação divergem no primeiro ajuste.
 */
export const DIMENSOES_MINIMAS_CM = {
  altura: 15,
  largura: 16,
  comprimento: 10,
} as const;

export const pacoteQuoteSchema = z.object({
  pesoKg: z.coerce
    .number()
    .positive("Informe o peso")
    .max(30, "Peso máximo 30kg"),
  valorDeclarado: z.coerce
    .number()
    .min(0, "Valor declarado deve ser positivo"),
  // Mínimos por campo (e não num `refine` no objeto): assim o aviso aparece
  // embaixo do campo errado. O refine anterior apontava sempre para
  // `comprimentoCm`, então errar a altura acusava erro no comprimento.
  comprimentoCm: z.coerce
    .number()
    .min(
      DIMENSOES_MINIMAS_CM.comprimento,
      `Comprimento mínimo ${DIMENSOES_MINIMAS_CM.comprimento}cm`,
    )
    .max(150, "Comprimento máximo 150cm"),
  larguraCm: z.coerce
    .number()
    .min(
      DIMENSOES_MINIMAS_CM.largura,
      `Largura mínima ${DIMENSOES_MINIMAS_CM.largura}cm`,
    )
    .max(120, "Largura máxima 120cm"),
  alturaCm: z.coerce
    .number()
    .min(
      DIMENSOES_MINIMAS_CM.altura,
      `Altura mínima ${DIMENSOES_MINIMAS_CM.altura}cm`,
    )
    .max(120, "Altura máxima 120cm"),
  categoria: z
    .string()
    .trim()
    .min(2, "Informe a categoria"),
});

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
