import { z } from "zod";

export const ticketCreateSchema = z.object({
  title: z.string().min(6, "Informe um título mais descritivo"),
  category: z
    .enum([
      "FINANCEIRO",
      "LOGISTICA",
      "ETIQUETA",
      "RASTREAMENTO",
      "COLETAS",
      "OUTROS",
    ])
    .default("OUTROS"),
  requester: z.object({
    name: z.string().min(3, "Informe o nome"),
    email: z.string().email("E-mail inválido").optional(),
    phone: z
      .string()
      .regex(/^(\(?\d{2}\)?\s?\d{4,5}-?\d{4})$/u, "Telefone inválido")
      .optional(),
  }),
  linkedTrackingCode: z.string().optional(),
  description: z.string().min(10, "Descreva o problema"),
});

export const ticketUpdateSchema = z.object({
  title: z.string().min(6).optional(),
  category: z
    .enum([
      "FINANCEIRO",
      "LOGISTICA",
      "ETIQUETA",
      "RASTREAMENTO",
      "COLETAS",
      "OUTROS",
    ])
    .optional(),
  status: z
    .enum(["OPEN", "PENDING", "WAITING_CUSTOMER", "RESOLVED", "CLOSED"])
    .optional(),
  assignee: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});

export const ticketCommentSchema = z.object({
  message: z.string().min(1, "Escreva uma mensagem"),
  internal: z.boolean().optional(),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
export type TicketCommentInput = z.infer<typeof ticketCommentSchema>;
