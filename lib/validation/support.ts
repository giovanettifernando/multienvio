import { z } from 'zod';

// Enums
export const PrioritySchema = z.enum(['baixa', 'media', 'alta', 'critica']);
export const StatusSchema = z.enum(['aberto', 'em_atendimento', 'resolvido', 'fechado']);
export const AuthorRoleSchema = z.enum(['cliente', 'admin']);

export type Priority = z.infer<typeof PrioritySchema>;
export type Status = z.infer<typeof StatusSchema>;
export type AuthorRole = z.infer<typeof AuthorRoleSchema>;

// Attachment schema
export const SupportAttachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number().nonnegative(),
  type: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
});

export type SupportAttachment = z.infer<typeof SupportAttachmentSchema>;

// Message schema
export const SupportMessageSchema = z.object({
  id: z.string(),
  at: z.string(), // ISO date
  authorRole: AuthorRoleSchema,
  authorName: z.string().min(1),
  text: z.string().min(1),
  attachments: z.array(SupportAttachmentSchema).default([]),
});

export type SupportMessage = z.infer<typeof SupportMessageSchema>;

// Requester schema
export const SupportRequesterSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  phone: z.string().optional().nullable(),
});

export type SupportRequester = z.infer<typeof SupportRequesterSchema>;

// Full ticket schema
export const SupportTicketSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: StatusSchema.default('aberto'),
  priority: PrioritySchema.default('media'),
  subject: z.string().min(3, 'Assunto deve ter no mínimo 3 caracteres'),
  description: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres'),
  tags: z.array(z.string()).default([]),
  requester: SupportRequesterSchema,
  messages: z.array(SupportMessageSchema).default([]),
  attachments: z.array(SupportAttachmentSchema).default([]),
  assignedTo: z.string().optional().nullable(),
});

export type SupportTicket = z.infer<typeof SupportTicketSchema>;

// Input schema for creating new ticket
export const NewTicketInputSchema = z.object({
  requester: SupportRequesterSchema,
  subject: z.string().min(3, 'Assunto deve ter no mínimo 3 caracteres'),
  priority: PrioritySchema,
  description: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres'),
  tags: z.array(z.string()).optional().default([]),
  attachments: z.array(SupportAttachmentSchema).optional().default([]),
});

export type NewTicketInput = z.infer<typeof NewTicketInputSchema>;

// Helper functions
export function newTicket(input: NewTicketInput): SupportTicket {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    status: 'aberto',
    priority: input.priority,
    subject: input.subject.trim(),
    description: input.description.trim(),
    tags: input.tags ?? [],
    requester: input.requester,
    messages: [],
    attachments: input.attachments ?? [],
    assignedTo: null,
  };
}

export function newMessage(params: {
  authorRole: AuthorRole;
  authorName: string;
  text: string;
  attachments?: SupportAttachment[];
}): SupportMessage {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    authorRole: params.authorRole,
    authorName: params.authorName,
    text: params.text.trim(),
    attachments: params.attachments ?? [],
  };
}
