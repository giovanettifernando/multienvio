/**
 * Schemas de validação Zod para o módulo de pagamento pelo destinatário
 */

import { z } from 'zod';

/**
 * Schema para um volume
 */
export const packageInputSchema = z.object({
  packageNumber: z.number().int().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  length: z.number().positive(),
  weight: z.number().positive(),
});

/**
 * Helper para normalizar CEP (remover hífen se houver)
 */
const cepSchema = z.string()
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length === 8, { message: 'CEP deve ter 8 dígitos' });

/**
 * Schema para dados de origem
 */
export const originInputSchema = z.object({
  addressId: z.string().optional(),
  cep: cepSchema,
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres'),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
});

/**
 * Schema para dados de destino
 */
export const destinationInputSchema = z.object({
  cep: cepSchema,
  city: z.string().min(1, 'Cidade é obrigatória'),
  state: z.string().length(2, 'Estado deve ter 2 caracteres'),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
});

/**
 * Schema para dados do destinatário
 */
export const recipientInputSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional(),
  document: z.string().optional(),
});

/**
 * Schema para dados da cotação
 */
export const quoteInputSchema = z.object({
  /** Cotação salva de onde sai o preço (o valor enviado pela tela é ignorado). */
  quoteId: z.string().min(1, 'Cotação obrigatória'),
  carrier: z.string().min(1, 'Transportadora é obrigatória'),
  service: z.string().min(1, 'Serviço é obrigatório'),
  serviceCode: z.string().optional(),
  estimatedDays: z.number().int().positive().optional(),
  freightCostCents: z.number().int().min(0, 'Valor do frete deve ser positivo'),
  totalCents: z.number().int().min(1, 'Valor total deve ser positivo'),
  shippingCommissionCents: z.number().int().min(0).optional(),
});

/**
 * Schema para criar um RecipientPaymentRequest (input da API - sem senderId)
 * O senderId é adicionado automaticamente pela sessão do usuário
 */
export const createRecipientPaymentSchema = z.object({
  origin: originInputSchema,
  destination: destinationInputSchema,
  recipient: recipientInputSchema,
  packages: z.array(packageInputSchema).min(1, 'Pelo menos um volume é obrigatório'),
  quote: quoteInputSchema,
  totalWeight: z.number().positive('Peso total deve ser positivo'),
  declaredValue: z.number().min(0, 'Valor declarado não pode ser negativo'),
  document: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema para pagamento pelo destinatário
 */
export const processPaymentSchema = z.object({
  paymentToken: z.string().min(1, 'Token de pagamento é obrigatório'),
  paymentMethod: z.enum(['PIX', 'CREDIT_CARD'], {
    message: 'Método de pagamento inválido',
  }),
  // Dados do cartão (se método for CREDIT_CARD)
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(12).optional(),
});

/**
 * Schema para cancelamento
 */
export const cancelRequestSchema = z.object({
  requestId: z.string().uuid('ID do request inválido'),
  reason: z.string().optional(),
});

/**
 * Schema para reenvio de link
 */
export const resendLinkSchema = z.object({
  requestId: z.string().uuid('ID do request inválido'),
});

/**
 * Schema para listagem de requests
 */
export const listRequestsSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'EXPIRED', 'CANCELLED']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// Types inferidos dos schemas
export type PackageInputDto = z.infer<typeof packageInputSchema>;
export type OriginInputDto = z.infer<typeof originInputSchema>;
export type DestinationInputDto = z.infer<typeof destinationInputSchema>;
export type RecipientInputDto = z.infer<typeof recipientInputSchema>;
export type QuoteInputDto = z.infer<typeof quoteInputSchema>;
export type CreateRecipientPaymentDto = z.infer<typeof createRecipientPaymentSchema>;
export type ProcessPaymentDto = z.infer<typeof processPaymentSchema>;
export type CancelRequestDto = z.infer<typeof cancelRequestSchema>;
export type ResendLinkDto = z.infer<typeof resendLinkSchema>;
export type ListRequestsDto = z.infer<typeof listRequestsSchema>;
