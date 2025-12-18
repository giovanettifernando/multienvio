/**
 * Validações centralizadas usando Zod
 * Baseadas nos contratos globais
 */

import { z } from "zod";
import {
  ShipmentStatus,
  CollectionStatus,
  SupportStatus,
  SupportPriority,
  PickupPointStatus,
  UserStatus,
  AuthRole,
} from "./contracts";

// ============================================================================
// SCHEMAS DE ENUMS
// ============================================================================

export const shipmentStatusSchema = z.nativeEnum(ShipmentStatus);
export const collectionStatusSchema = z.nativeEnum(CollectionStatus);
export const supportStatusSchema = z.nativeEnum(SupportStatus);
export const supportPrioritySchema = z.nativeEnum(SupportPriority);
export const pickupPointStatusSchema = z.nativeEnum(PickupPointStatus);
export const userStatusSchema = z.nativeEnum(UserStatus);
export const authRoleSchema = z.nativeEnum(AuthRole);

// ============================================================================
// SCHEMAS COMPARTILHADOS
// ============================================================================

/**
 * Schema de endereço
 */
export const addressSchema = z.object({
  logradouro: z.string().min(3, "Logradouro deve ter no mínimo 3 caracteres"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional().nullable(),
  bairro: z.string().min(2, "Bairro deve ter no mínimo 2 caracteres"),
  cidade: z.string().min(2, "Cidade deve ter no mínimo 2 caracteres"),
  uf: z.string().length(2, "UF deve ter 2 caracteres"),
  cep: z.string().regex(/^\d{5}-?\d{3}$/, "CEP inválido"),
});

/**
 * Schema de email
 */
export const emailSchema = z
  .string()
  .email("Email inválido")
  .or(z.literal(""))
  .optional();

/**
 * Schema de telefone
 */
export const phoneSchema = z
  .string()
  .min(10, "Telefone deve ter no mínimo 10 dígitos")
  .optional()
  .nullable();

/**
 * Schema de CNPJ
 */
export const cnpjSchema = z
  .string()
  .regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/, "CNPJ inválido");

/**
 * Schema de CPF
 */
export const cpfSchema = z
  .string()
  .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido");

/**
 * Schema de documento (CPF ou CNPJ)
 */
export const documentSchema = z
  .string()
  .min(11, "Documento inválido");

// ============================================================================
// SCHEMAS DE DOMÍNIO
// ============================================================================

/**
 * Schema para criar/atualizar Coleta
 */
export const collectionFormSchema = z.object({
  shipmentId: z.string().min(1, "ID do envio é obrigatório"),
  status: collectionStatusSchema,
  origin: z.object({
    name: z.string().min(3, "Nome é obrigatório"),
    phone: phoneSchema,
    address: addressSchema,
  }),
  scheduledWindow: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * Schema para criar/atualizar Ticket de Suporte
 */
export const supportTicketFormSchema = z.object({
  title: z.string().min(5, "Título deve ter no mínimo 5 caracteres"),
  description: z.string().min(10, "Descrição deve ter no mínimo 10 caracteres"),
  status: supportStatusSchema.optional(),
  priority: supportPrioritySchema.optional(),
  category: z.string().min(1, "Categoria é obrigatória"),
  linkedTrackingCode: z.string().optional().nullable(),
});

/**
 * Schema para criar/atualizar Usuário
 */
export const userFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter no mínimo 3 caracteres"),
  email: z.string().email("Email inválido"),
  phone: phoneSchema,
  status: userStatusSchema,
  roles: z.array(authRoleSchema).min(1, "Selecione ao menos uma role"),
});

// ============================================================================
// SCHEMAS DE INPUT
// ============================================================================

/**
 * Schema para atualizar status de Coleta
 */
export const updateCollectionStatusSchema = z.object({
  status: collectionStatusSchema,
});

/**
 * Schema para atualizar status de Ticket
 */
export const updateTicketStatusSchema = z.object({
  status: supportStatusSchema,
});

/**
 * Schema para atualizar prioridade de Ticket
 */
export const updateTicketPrioritySchema = z.object({
  priority: supportPrioritySchema,
});

/**
 * Schema para mensagem de suporte
 */
export const supportMessageSchema = z.object({
  content: z.string().min(1, "Mensagem não pode estar vazia"),
});
