/**
 * Wallet Validation Schemas
 *
 * Validações Zod para operações de carteira
 */

import { z } from 'zod';

/**
 * Schema para criação de topup via PIX
 */
export const CreateTopupSchema = z.object({
  amountReais: z
    .number()
    .positive('O valor deve ser positivo')
    .min(1, 'O valor mínimo é R$ 1,00')
    .max(10000, 'O valor máximo é R$ 10.000,00'),
});

export type CreateTopupInput = z.infer<typeof CreateTopupSchema>;

/**
 * Schema para confirmação de pagamento
 */
export const ConfirmPaymentSchema = z.object({
  referenceId: z.string().min(1, 'Reference ID é obrigatório'),
});

export type ConfirmPaymentInput = z.infer<typeof ConfirmPaymentSchema>;

/**
 * Schema para listagem de transações
 */
export const ListTransactionsSchema = z.object({
  limit: z
    .string()
    .nullish()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().int().positive().max(100)),
  cursor: z.string().nullish(),
});

export type ListTransactionsInput = z.infer<typeof ListTransactionsSchema>;

/**
 * Schema para débito (compra) - formato legado
 */
export const DebitSchema = z.object({
  amountReais: z.number().positive('O valor deve ser positivo'),
  title: z.string().min(1, 'Título é obrigatório'),
  referenceId: z.string().optional(),
});

export type DebitInput = z.infer<typeof DebitSchema>;

/**
 * Schema para débito via API /api/wallet/debit
 * Suporta pagamento de shipment individual ou batch
 */
export const WalletDebitApiSchema = z.object({
  // Identificação do pagamento (um dos dois é obrigatório)
  shipmentId: z.string().uuid('ID do envio inválido').optional(),
  referenceId: z.string().min(1, 'Reference ID inválido').optional(),

  // Valor obrigatório
  amount: z
    .number()
    .positive('O valor deve ser positivo')
    .max(100000, 'Valor máximo excedido'),

  // Campos opcionais
  reason: z.string().max(255).optional(),
  trackingCode: z.string().max(50).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => data.shipmentId || data.referenceId,
  { message: 'shipmentId ou referenceId é obrigatório' }
);

export type WalletDebitApiInput = z.infer<typeof WalletDebitApiSchema>;
