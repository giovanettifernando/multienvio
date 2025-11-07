import { z } from 'zod';

/**
 * Backend validation schemas for quotation system
 * These schemas validate API payloads and database operations
 */

// CEP validation (without hyphen, 8 digits)
export const cepSchema = z
  .string()
  .min(1, 'CEP é obrigatório')
  .transform((val) => val.replace(/\D/g, ''))
  .pipe(
    z
      .string()
      .length(8, 'CEP deve ter 8 dígitos')
      .regex(/^[0-9]{8}$/, 'CEP inválido')
  );

// Volume validation (matching frontend constraints)
export const volumeSchema = z.object({
  comprimentoCm: z.coerce
    .number()
    .int('Comprimento deve ser inteiro')
    .positive('Comprimento deve ser positivo')
    .max(150, 'Comprimento máximo: 150cm'),
  larguraCm: z.coerce
    .number()
    .int('Largura deve ser inteira')
    .positive('Largura deve ser positiva')
    .max(120, 'Largura máxima: 120cm'),
  alturaCm: z.coerce
    .number()
    .int('Altura deve ser inteira')
    .positive('Altura deve ser positiva')
    .max(120, 'Altura máxima: 120cm'),
  pesoKg: z.coerce
    .number()
    .positive('Peso deve ser positivo')
    .max(30, 'Peso máximo: 30kg'),
});

export type VolumeInput = z.infer<typeof volumeSchema>;

// Document type enum
export const documentTypeSchema = z.enum(['NFE', 'DECLARACAO'], {
  message: 'Tipo de documento inválido',
});

export type DocumentType = z.infer<typeof documentTypeSchema>;

// Quote request schema (POST /api/cotacoes)
export const quoteRequestSchema = z.object({
  origem: z.object({
    cep: cepSchema,
  }),
  destino: z.object({
    cep: cepSchema,
  }),
  volumes: z
    .array(volumeSchema)
    .min(1, 'Pelo menos 1 volume é obrigatório')
    .max(10, 'Máximo de 10 volumes por cotação'),
  seguro: z.number().min(0).nullable().optional(),
  coleta: z.boolean().default(false),
  devolucao: z.boolean().default(false),
  lembrete: z.string().max(500, 'Lembrete muito longo').nullable().optional(),
});

export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

// Quote selection schema (POST /api/cotacoes/selecionar)
export const quoteSelectionSchema = z.object({
  quoteId: z.string().cuid('ID de cotação inválido'),
  serviceId: z.string().min(1, 'serviceId é obrigatório'),
  seguro: z.number().min(0).nullable().optional(),
});

export type QuoteSelectionRequest = z.infer<typeof quoteSelectionSchema>;

// Quote finalize schema (POST /api/cotacoes/finalizar)
export const quoteFinalizeSchema = z.object({
  quoteId: z.string().cuid('ID de cotação inválido'),
  documento: documentTypeSchema,
  nfeNumero: z.string().optional(),
  nfeValor: z.number().positive().optional(),
  declaracao: z
    .array(
      z.object({
        descricao: z.string().min(1, 'Descrição é obrigatória'),
        valorUnitario: z.number().positive('Valor unitário deve ser positivo'),
        quantidade: z.number().int().positive('Quantidade deve ser inteira e positiva'),
      })
    )
    .optional(),
});

export type QuoteFinalizeRequest = z.infer<typeof quoteFinalizeSchema>;

// List quotes query params
export const listQuotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['DRAFT', 'SELECTED', 'CONFIRMED', 'EXPIRED', 'CANCELED']).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'expiresAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;

// Helper function to calculate cubic weight
export function calculateCubicWeight(
  comprimentoCm: number,
  larguraCm: number,
  alturaCm: number
): number {
  // Peso cúbico = (A × L × C) / 6000
  const cubicWeight = (alturaCm * larguraCm * comprimentoCm) / 6000;
  return Math.round(cubicWeight * 100) / 100; // Round to 2 decimal places
}

// Helper function to normalize CEP (remove hyphens)
export function normalizeCep(cep: string): string {
  return cep.replace(/\D/g, '');
}

// Helper function to format CEP (add hyphen)
export function formatCep(cep: string): string {
  const normalized = normalizeCep(cep);
  if (normalized.length === 8) {
    return `${normalized.slice(0, 5)}-${normalized.slice(5)}`;
  }
  return cep;
}

// Helper function to calculate quote expiration (24 hours from now)
export function calculateQuoteExpiration(): Date {
  const now = new Date();
  return new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
}

// Business rules validation
export const validateQuoteBusinessRules = {
  /**
   * Validates if a quote is still valid (not expired)
   */
  isQuoteValid(expiresAt: Date): boolean {
    return new Date() < expiresAt;
  },

  /**
   * Validates if a quote can be selected
   */
  canSelectQuote(status: string, expiresAt: Date): boolean {
    return status === 'DRAFT' && this.isQuoteValid(expiresAt);
  },

  /**
   * Validates if a quote can be confirmed
   */
  canConfirmQuote(status: string, expiresAt: Date): boolean {
    return status === 'SELECTED' && this.isQuoteValid(expiresAt);
  },

  /**
   * Validates if a quote can be canceled
   */
  canCancelQuote(status: string): boolean {
    return status !== 'CONFIRMED' && status !== 'CANCELED';
  },
};
