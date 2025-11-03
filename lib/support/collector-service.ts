import { prisma } from '@/lib/db';
import {
  type SupportTicket,
  type SupportMessage,
  type NewTicketInput,
  type Status,
  type Priority,
} from '@/lib/validation/support';
import {
  Prisma,
  SupportAuthorRole as DbAuthorRole,
  SupportPriority as DbPriority,
  SupportTicketStatus as DbStatus,
} from '@prisma/client';

type TicketRecord = Prisma.SupportTicketGetPayload<{
  include: {
    pickupPoint: { select: { id: true; nomeFantasia: true; cnpj: true; email: true; telefone: true } };
    messages: {
      include: {
        attachments: true;
      };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

export interface CollectorTicketFilters {
  status?: Status[];
  priority?: Priority[];
  query?: string;
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

function normalizeTags(value: Prisma.JsonValue | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return [];
}

function mapTicketFromDb(record: TicketRecord): SupportTicket {
  const messages: SupportMessage[] = record.messages.map((msg) => ({
    id: msg.id,
    at: msg.createdAt.toISOString(),
    authorRole: msg.authorRole === DbAuthorRole.USER ? 'cliente' : 'admin',
    authorName: msg.authorRole === DbAuthorRole.USER
      ? (record.pickupPoint?.nomeFantasia ?? 'Ponto de Coleta')
      : 'Suporte',
    text: msg.body,
    attachments: msg.attachments.map((att) => ({
      id: att.id,
      name: att.filename,
      url: att.url,
      size: att.size ?? 0,
      type: null,
    })),
  }));

  const attachments = messages.flatMap((msg) => msg.attachments);

  return {
    id: record.id,
    subject: record.subject,
    description: record.description,
    status: statusFromDb[record.status],
    priority: priorityFromDb[record.priority],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    tags: normalizeTags(record.tags),
    requester: {
      name: record.pickupPoint?.nomeFantasia ?? 'Desconhecido',
      email: record.pickupPoint?.email ?? '',
      phone: record.pickupPoint?.telefone ?? null,
    },
    messages,
    attachments,
    assignedTo: record.assignedTo ?? null,
  };
}

function buildWhereForCollector(
  pointId: string,
  filters: CollectorTicketFilters
): Prisma.SupportTicketWhereInput {
  const where: Prisma.SupportTicketWhereInput = {
    pickupPointId: pointId,
  };

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
      { id: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
}

export async function listTicketsForCollector(
  pointId: string,
  filters: CollectorTicketFilters = {}
): Promise<SupportTicket[]> {
  const where = buildWhereForCollector(pointId, filters);

  const records = await prisma.supportTicket.findMany({
    where,
    include: {
      pickupPoint: {
        select: {
          id: true,
          nomeFantasia: true,
          cnpj: true,
          email: true,
          telefone: true,
        },
      },
      messages: {
        include: {
          attachments: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
  });

  return records.map(mapTicketFromDb);
}

export async function getTicketForCollector(
  ticketId: string,
  pointId: string
): Promise<SupportTicket | null> {
  const record = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      pickupPointId: pointId,
    },
    include: {
      pickupPoint: {
        select: {
          id: true,
          nomeFantasia: true,
          cnpj: true,
          email: true,
          telefone: true,
        },
      },
      messages: {
        include: {
          attachments: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!record) return null;
  return mapTicketFromDb(record);
}

export async function createTicketForCollector(
  pointId: string,
  data: NewTicketInput
): Promise<SupportTicket> {
  // Buscar informações do ponto de coleta
  const pickupPoint = await prisma.pickupPoint.findUnique({
    where: { id: pointId },
    select: { nomeFantasia: true, email: true },
  });

  if (!pickupPoint) {
    throw new Error('Ponto de coleta não encontrado');
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: data.subject,
      description: data.description,
      priority: priorityToDb[data.priority],
      status: DbStatus.OPEN,
      pickupPointId: pointId,
      tags: data.tags ?? [],
      messages: {
        create: {
          body: data.description,
          authorId: pointId,
          authorRole: DbAuthorRole.USER,
        },
      },
    },
    include: {
      pickupPoint: {
        select: {
          id: true,
          nomeFantasia: true,
          cnpj: true,
          email: true,
          telefone: true,
        },
      },
      messages: {
        include: {
          attachments: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  return mapTicketFromDb(ticket);
}

export async function addMessageToTicketForCollector(
  ticketId: string,
  pointId: string,
  content: string,
  attachments?: Array<{ filename: string; url: string; size: number }>
): Promise<SupportMessage> {
  // Verificar se o ticket pertence ao ponto de coleta
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      pickupPointId: pointId,
    },
    include: {
      pickupPoint: {
        select: { nomeFantasia: true },
      },
    },
  });

  if (!ticket) {
    throw new Error('Ticket não encontrado');
  }

  const message = await prisma.supportMessage.create({
    data: {
      ticketId,
      body: content,
      authorId: pointId,
      authorRole: DbAuthorRole.USER,
      attachments: attachments?.length
        ? {
            create: attachments.map((att) => ({
              filename: att.filename,
              url: att.url,
              size: att.size,
            })),
          }
        : undefined,
    },
    include: {
      attachments: true,
    },
  });

  // Atualizar data de modificação do ticket
  await prisma.supportTicket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  return {
    id: message.id,
    at: message.createdAt.toISOString(),
    authorRole: 'cliente',
    authorName: ticket.pickupPoint?.nomeFantasia ?? 'Ponto de Coleta',
    text: message.body,
    attachments: message.attachments.map((att) => ({
      id: att.id,
      name: att.filename,
      url: att.url,
      size: att.size ?? 0,
      type: null,
    })),
  };
}
