import { z } from 'zod';

export const carrierSchema = z.object({
  name: z
    .string({ message: 'Nome é obrigatório' })
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome deve ter no máximo 100 caracteres'),
  slug: z
    .string({ message: 'Slug é obrigatório' })
    .min(2, 'Slug deve ter pelo menos 2 caracteres')
    .max(50, 'Slug deve ter no máximo 50 caracteres')
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens')
    .transform((val) => val.toLowerCase()),
  website: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  logoUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  enabled: z.boolean().optional().default(true),
  services: z
    .array(z.enum(['quote', 'label', 'tracking']))
    .min(1, 'Selecione pelo menos um serviço')
    .optional()
    .default([]),
});

export type CarrierSchemaType = z.infer<typeof carrierSchema>;

export const apiSchema = z.object({
  carrierId: z.string({ message: 'Transportadora é obrigatória' }),
  environment: z.enum(['sandbox', 'production'], {
    message: 'Ambiente é obrigatório',
  }),
  quoteUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  labelUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  trackingUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  active: z.boolean().optional().default(true),
  notes: z.string().max(500, 'Notas devem ter no máximo 500 caracteres').optional(),
});

export type ApiSchemaType = z.infer<typeof apiSchema>;

export const authFieldSchema = z.object({
  key: z.string().min(1, 'Chave é obrigatória'),
  label: z.string().min(1, 'Label é obrigatório'),
  type: z.enum(['text', 'password', 'token']),
  value: z.string().optional(),
  masked: z.boolean().optional(),
});

export const authSchema = z.object({
  carrierId: z.string({ message: 'Transportadora é obrigatória' }),
  fields: z.array(authFieldSchema).min(1, 'Adicione pelo menos um campo de autenticação'),
});

export type AuthSchemaType = z.infer<typeof authSchema>;

export const paymentGatewaySchema = z.object({
  provider: z.enum(['mercadoPago'], {
    message: 'Provider é obrigatório',
  }),
  publicKey: z.string().min(1, 'Public Key é obrigatória').optional().or(z.literal('')),
  accessToken: z.string().min(1, 'Access Token é obrigatório').optional().or(z.literal('')),
  webhookUrl: z
    .string()
    .url('URL inválida')
    .optional()
    .or(z.literal('')),
  webhookSecret: z.string().optional().or(z.literal('')),
  active: z.boolean().optional().default(false),
});

export type PaymentGatewaySchemaType = z.infer<typeof paymentGatewaySchema>;
