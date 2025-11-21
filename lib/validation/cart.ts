import { z } from 'zod';

// Schemas para dados dentro dos snapshots JSON

export const addressSnapshotSchema = z.object({
  nome: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().optional(),
  documento: z.string().optional(),
  complemento: z.string().optional(),
  id: z.string().optional(),
  apelido: z.string().optional(),
  logradouro: z.string(),
  numero: z.string(),
  bairro: z.string(),
  cidade: z.string(),
  uf: z.string(),
  cep: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const volumeSnapshotSchema = z.object({
  idx: z.number().optional(),
  comprimentoCm: z.number(),
  larguraCm: z.number(),
  alturaCm: z.number(),
  pesoKg: z.number(),
  pesoCubadoKg: z.number().optional(),
});

export const preferencesSnapshotSchema = z.object({
  pickupRequested: z.boolean().optional(),
  reverse: z.boolean().optional(),
  reminder: z.string().optional(),
});

export const selectedQuoteSnapshotSchema = z.object({
  carrier: z.string(),
  serviceCode: z.string().optional(),
  serviceName: z.string(),
  price: z.number(),
  deadlineDays: z.number(),
  source: z.enum(['real', 'mock']).optional(),
});

export const totalsSnapshotSchema = z.object({
  subtotal: z.number().optional(),
  desconto: z.number().optional(),
  taxas: z.number().optional(),
  pickupFee: z.number().optional(),
  total: z.number(),
  moeda: z.string().default('BRL'),
});

export const pickupPointSnapshotSchema = z.object({
  id: z.string(),
  nome: z.string().optional(),
  endereco: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  cep: z.string().optional(),
}).nullable();

export const pickupFeeSnapshotSchema = z.object({
  collectorId: z.string(),
  feeAmount: z.number(),
  distanceKm: z.number(),
}).nullable();

// Schema para adicionar item ao carrinho
export const addCartItemSchema = z.object({
  originAddress: addressSnapshotSchema,
  destination: addressSnapshotSchema,
  volumes: z.array(volumeSnapshotSchema),
  preferences: preferencesSnapshotSchema,
  insuranceValue: z.number().optional(),
  pickupPoint: pickupPointSnapshotSchema.optional(),
  pickupFee: pickupFeeSnapshotSchema.optional(),
  selectedQuote: selectedQuoteSnapshotSchema,
  totals: totalsSnapshotSchema,
});

export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

// Schema para atualizar item do carrinho
export const updateCartItemSchema = z.object({
  originAddress: addressSnapshotSchema.optional(),
  destination: addressSnapshotSchema.optional(),
  volumes: z.array(volumeSnapshotSchema).optional(),
  preferences: preferencesSnapshotSchema.optional(),
  insuranceValue: z.number().optional(),
  pickupPoint: pickupPointSnapshotSchema.optional(),
  pickupFee: pickupFeeSnapshotSchema.optional(),
  selectedQuote: selectedQuoteSnapshotSchema.optional(),
  totals: totalsSnapshotSchema.optional(),
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

// Schema para checkout
export const checkoutCartSchema = z.object({
  itemIds: z.array(z.string()).optional(), // Se vazio, usa todos os itens
  paymentMethod: z.enum(['wallet', 'pix', 'card']).optional(), // Método de pagamento escolhido
});

export type CheckoutCartInput = z.infer<typeof checkoutCartSchema>;
