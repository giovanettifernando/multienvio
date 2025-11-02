import { prisma } from '@/lib/db';
import {
  type SupportTicket,
  type SupportMessage,
  type SupportAttachment as UiAttachment,
  type NewTicketInput,
  type Status,
  type Priority,
  type AuthorRole,
} from '@/lib/validation/support';
import {
  Prisma,
  SupportAuthorRole as DbAuthorRole,
  SupportPriority as DbPriority,
  SupportTicketStatus as DbStatus,
} from '@prisma/client';

type TicketRecord = Prisma.SupportTicketGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; phone: true } };
    messages: {
      include: {
        attachments: true;
      };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

type MessageRecord = TicketRecord['messages'][number];

export interface TicketFilters {
  status?: Status[];
  priority?: Priority[];
  query?: string;
  requesterEmail?: string;
  assignedTo?: string | null;
}

export interface PaginatedTickets {
  items: SupportTicket[];
  total: number;
  page: number;
  pageSize: number;
}

const statusFromDb: Record<DbStatus, Status> = {
  [DbStatus.OPEN]: 'aberto',
  [DbStatus.IN_PROGRESS]: 'em_atendimento',
  [DbStatus.RESOLVED]: 'resolvido',
  [DbStatus.CLOSED]: 'fechado',
};

const statusToDb: Record<Status, DbStatus> = {
  aberto: DbStatus.OPEN,
  em_atendimento: DbStatus.IN_PROGRESS,
  resolvido: DbStatus.RESOLVED,
  fechado: DbStatus.CLOSED,
};

const priorityFromDb: Record<DbPriority, Priority> = {
  [DbPriority.LOW]: 'baixa',
  [DbPriority.MEDIUM]: 'media',
  [DbPriority.HIGH]: 'alta',
  [DbPriority.URGENT]: 'critica',
};

const priorityToDb: Record<Priority, DbPriority> = {
  baixa: DbPriority.LOW,
  media: DbPriority.MEDIUM,
  alta: DbPriority.HIGH,
  critica: DbPriority.URGENT,
};

const authorRoleFromDb: Record<DbAuthorRole, AuthorRole> = {
  [DbAuthorRole.USER]: 'cliente',
  [DbAuthorRole.AGENT]: 'admin',
};

const authorRoleToDb: Record<AuthorRole, DbAuthorRole> = {
  cliente: DbAuthorRole.USER,
  admin: DbAuthorRole.AGENT,
};

function normalizeTags(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function mapAttachment(record: { id: string; filename: string; url: string; size: number | null }): UiAttachment {
  return {
    id: record.id,
    name: record.filename,
    url: record.url,
    size: record.size ?? 0,
    type: null,
  };
}

function deduplicateAttachments(attachments: UiAttachment[]): UiAttachment[] {
  const seen = new Set<string>();
  const result: UiAttachment[] = [];
  for (const attachment of attachments) {
    if (seen.has(attachment.id)) continue;
    seen.add(attachment.id);
    result.push(attachment);
  }
  return result;
}

async function resolveAgentNames(agentIds: string[]): Promise<Map<string, string>> {
  if (!agentIds.length) return new Map();
  const agents = await prisma.staffUser.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true },
  });
  return new Map(agents.map((agent) => [agent.id, agent.name]));
}

function buildWhereForFilters(filters: TicketFilters): Prisma.SupportTicketWhereInput {
  const where: Prisma.SupportTicketWhereInput = {};

  if (filters.status?.length) {
    const mapped = filters.status
      .map((status) => statusToDb[status])
      .filter((status): status is DbStatus => Boolean(status));
    if (mapped.length) {
      where.status = { in: mapped };
    }
  }

  if (filters.priority?.length) {
    const mapped = filters.priority
      .map((priority) => priorityToDb[priority])
      .filter((priority): priority is DbPriority => Boolean(priority));
    if (mapped.length) {
      where.priority = { in: mapped };
    }
  }

  if (filters.query && filters.query.trim().length > 0) {
    const q = filters.query.trim();
    where.OR = [
      { subject: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { assignedTo: { contains: q, mode: 'insensitive' } },
      { id: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (filters.requesterEmail) {
    where.user = { email: { equals: filters.requesterEmail, mode: 'insensitive' } };
  }

  if (filters.assignedTo === null) {
    where.assignedTo = null;
  } else if (typeof filters.assignedTo === 'string' && filters.assignedTo.trim().length > 0) {
    where.assignedTo = { equals: filters.assignedTo.trim() };
  }

  return where;
}

function mapMessage(
  ticket: TicketRecord,
  message: MessageRecord,
  agentNames: Map<string, string>,
): SupportMessage {
  const role = authorRoleFromDb[message.authorRole] ?? 'admin';
  const attachments = message.attachments.map(mapAttachment);
  let authorName: string;

  if (role === 'cliente') {
    authorName = ticket.user.name;
  } else {
    authorName = agentNames.get(message.authorId) ?? 'Suporte';
  }

  return {
    id: message.id,
    at: message.createdAt.toISOString(),
    authorRole: role,
    authorName,
    text: message.body,
    attachments,
  };
}

function mapTicketRecord(ticket: TicketRecord, agentNames: Map<string, string>): SupportTicket {
  const tags = normalizeTags(ticket.tags);
  const attachments: UiAttachment[] = [];

  const publicMessages = ticket.messages.filter((msg: MessageRecord) => !msg.isInternal);
  const messages = publicMessages.map((message: MessageRecord) => {
    const mapped = mapMessage(ticket, message, agentNames);
    attachments.push(...mapped.attachments);
    return mapped;
  });

  const assignedTo =
    ticket.assignedTo && agentNames.has(ticket.assignedTo)
      ? agentNames.get(ticket.assignedTo) ?? ticket.assignedTo
      : ticket.assignedTo ?? null;

  return {
    id: ticket.id,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    status: statusFromDb[ticket.status] ?? 'aberto',
    priority: priorityFromDb[ticket.priority] ?? 'media',
    subject: ticket.subject,
    description: ticket.description,
    tags,
    requester: {
      name: ticket.user.name,
      email: ticket.user.email,
      phone: ticket.user.phone ?? undefined,
    },
    messages,
    attachments: deduplicateAttachments(attachments),
    assignedTo,
  };
}

async function mapTickets(records: TicketRecord[]): Promise<SupportTicket[]> {
  const agentIds = new Set<string>();
  for (const ticket of records) {
    for (const message of ticket.messages) {
      if (message.authorRole === DbAuthorRole.AGENT) {
        agentIds.add(message.authorId);
      }
    }
    if (ticket.assignedTo) {
      agentIds.add(ticket.assignedTo);
    }
  }

  const agentNames = await resolveAgentNames([...agentIds]);
  return records.map((record) => mapTicketRecord(record, agentNames));
}

async function fetchTicketRecord(ticketId: string): Promise<TicketRecord | null> {
  return prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: {
        include: { attachments: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

export async function listTicketsForUser(userId: string, filters: TicketFilters = {}): Promise<SupportTicket[]> {
  const where = buildWhereForFilters(filters);
  where.userId = userId;

  const records = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: { include: { attachments: true }, orderBy: { createdAt: 'asc' } },
    },
  });

  return mapTickets(records);
}

export async function listTicketsForAdmin(
  filters: TicketFilters = {},
  page = 1,
  pageSize = 20,
): Promise<PaginatedTickets> {
  const where = buildWhereForFilters(filters);

  const skip = Math.max(page - 1, 0) * pageSize;
  const take = pageSize;

  const [records, total] = await prisma.$transaction([
    prisma.supportTicket.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        messages: { include: { attachments: true }, orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.supportTicket.count({ where }),
  ]);

  const items = await mapTickets(records);

  return {
    items,
    total,
    page,
    pageSize,
  };
}

export async function getTicketForUser(userId: string, ticketId: string): Promise<SupportTicket | null> {
  const record = await fetchTicketRecord(ticketId);
  if (!record || record.userId !== userId) {
    return null;
  }
  const [ticket] = await mapTickets([record]);
  return ticket;
}

export async function getTicket(ticketId: string): Promise<SupportTicket | null> {
  const record = await fetchTicketRecord(ticketId);
  if (!record) return null;
  const [ticket] = await mapTickets([record]);
  return ticket;
}

export async function createTicketForUser(userId: string, input: NewTicketInput): Promise<SupportTicket> {
  const priority = priorityToDb[input.priority] ?? DbPriority.MEDIUM;
  const now = new Date();

  const attachmentsData = (input.attachments ?? [])
    .filter((att): att is typeof att & { url: string } => typeof att.url === 'string' && att.url.length > 0)
    .map((att) => ({
      filename: att.name,
      url: att.url,
      size: att.size ?? null,
    }));

  const record = (await prisma.supportTicket.create({
    data: {
      userId,
      subject: input.subject,
      description: input.description,
      priority,
      status: DbStatus.OPEN,
      assignedTo: null,
      lastActivityAt: now,
      tags: input.tags ?? [],
      messages: {
        create: {
          authorId: userId,
          authorRole: DbAuthorRole.USER,
          body: input.description,
          createdAt: now,
          attachments: attachmentsData.length
            ? {
                create: attachmentsData,
              }
            : undefined,
        },
      },
    },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      messages: { include: { attachments: true }, orderBy: { createdAt: 'asc' } },
    },
  })) as TicketRecord;

  const [ticket] = await mapTickets([record]);
  return ticket;
}

async function resolveAuthorName(role: AuthorRole, authorId: string): Promise<string> {
  if (role === 'cliente') {
    const user = await prisma.user.findUnique({
      where: { id: authorId },
      select: { name: true },
    });
    return user?.name ?? 'Cliente';
  }

  const staff = await prisma.staffUser.findUnique({
    where: { id: authorId },
    select: { name: true },
  });
  return staff?.name ?? 'Suporte';
}

type MessageAttachmentInput = {
  name: string;
  url: string;
  size?: number;
};

export async function addMessageToTicket(params: {
  ticketId: string;
  authorId: string;
  role: AuthorRole;
  text: string;
  attachments?: MessageAttachmentInput[];
  isInternal?: boolean;
}): Promise<SupportMessage> {
  const roleDb = authorRoleToDb[params.role] ?? DbAuthorRole.AGENT;

  const attachmentsData = (params.attachments ?? [])
    .filter((att) => att.url && att.name)
    .map((att) => ({
      filename: att.name,
      url: att.url!,
      size: att.size ?? null,
    }));

  const created = await prisma.$transaction(async (tx) => {
    const message = await tx.supportMessage.create({
      data: {
        ticketId: params.ticketId,
        authorId: params.authorId,
        authorRole: roleDb,
        body: params.text,
        isInternal: params.isInternal ?? false,
        attachments: attachmentsData.length
          ? {
              create: attachmentsData,
            }
          : undefined,
      },
      include: { attachments: true },
    });

    await tx.supportTicket.update({
      where: { id: params.ticketId },
      data: {
        lastActivityAt: message.createdAt,
      },
    });

    return message;
  });

  const authorName = await resolveAuthorName(params.role, params.authorId);

  return {
    id: created.id,
    at: created.createdAt.toISOString(),
    authorRole: params.role,
    authorName,
    text: created.body,
    attachments: created.attachments.map(mapAttachment),
  };
}

export async function updateTicketStatus(ticketId: string, status: Status): Promise<SupportTicket | null> {
  const statusDb = statusToDb[status];
  if (!statusDb) return null;

  try {
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: statusDb,
        lastActivityAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        messages: { include: { attachments: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const [ticket] = await mapTickets([updated]);
    return ticket;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

export async function assignTicket(ticketId: string, assignedTo: string | null): Promise<SupportTicket | null> {
  try {
    const updated = await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        assignedTo,
        lastActivityAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        messages: { include: { attachments: true }, orderBy: { createdAt: 'asc' } },
      },
    });

    const [ticket] = await mapTickets([updated]);
    return ticket;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}
