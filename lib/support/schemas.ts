import { z } from "zod";
import type { TicketCategory, TicketStatus } from "./types";

export const ticketStatusValues = [
  "aberto",
  "pendente",
  "respondido",
  "resolvido",
  "fechado",
] as const satisfies readonly TicketStatus[];

export const ticketCategoryValues = [
  "integracao",
  "pagamento",
  "coleta",
  "rastreio",
  "outros",
] as const satisfies readonly TicketCategory[];

export const ticketFilterSchema = z.object({
  q: z
    .string()
    .min(1, "Informe ao menos um caractere para busca.")
    .optional(),
  status: z
    .enum([...ticketStatusValues])
    .or(z.literal("all"))
    .optional(),
  category: z
    .enum([...ticketCategoryValues])
    .or(z.literal("all"))
    .optional(),
  assignee: z.enum(["me", "unassigned", "all"]).optional(),
});

export const ticketReplySchema = z.object({
  message: z.string().min(1, "A mensagem é obrigatória."),
  attachments: z.array(z.string()).optional(),
});

export const ticketUpdateSchema = z
  .object({
    status: z.enum([...ticketStatusValues]).optional(),
    category: z.enum([...ticketCategoryValues]).optional(),
    assigneeUserId: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) =>
      data.status !== undefined ||
      data.category !== undefined ||
      data.assigneeUserId !== undefined,
    {
      message: "Informe ao menos um campo para atualizar.",
    },
  );

export type TicketFilterInput = z.infer<typeof ticketFilterSchema>;
export type TicketReplyInput = z.infer<typeof ticketReplySchema>;
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
