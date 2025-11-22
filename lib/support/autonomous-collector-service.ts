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
    collector: { select: { id: true; pfNome: true; pfEmail: true; pfCelular: true } };
    messages: {
      include: {
        attachments: true;
      };
      orderBy: { createdAt: 'asc' };
    };
  };
}>;

export interface AutonomousCollectorTicketFilters {
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
      ? (record.collector?.pfNome ?? 'Coletor')
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
      name: record.collector?.pfNome ?? 'Desconhecido',
      email: record.collector?.pfEmail ?? '',
      phone: record.collector?.pfCelular ?? null,
    },
    messages,
    attachments,
    assignedTo: record.assignedTo ?? null,
  };
}

function buildWhereForAutonomousCollector(
  collectorId: string,
  filters: AutonomousCollectorTicketFilters
): Prisma.SupportTicketWhereInput {
  const where: Prisma.SupportTicketWhereInput = {
    collectorId: collectorId,
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

export async function listTicketsForAutonomousCollector(
  collectorId: string,
  filters: AutonomousCollectorTicketFilters = {}
): Promise<SupportTicket[]> {
  const where = buildWhereForAutonomousCollector(collectorId, filters);

  const records = await prisma.supportTicket.findMany({
    where,
    include: {
      collector: {
        select: {
          id: true,
          pfNome: true,
          pfEmail: true,
          pfCelular: true,
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
      lastActivityAt: 'desc',
    },
  });

  return records.map(mapTicketFromDb);
}

export async function getTicketForAutonomousCollector(
  ticketId: string,
  collectorId: string
): Promise<SupportTicket | null> {
  const record = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      collectorId: collectorId,
    },
    include: {
      collector: {
        select: {
          id: true,
          pfNome: true,
          pfEmail: true,
          pfCelular: true,
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

export async function createTicketForAutonomousCollector(
  collectorId: string,
  data: NewTicketInput
): Promise<SupportTicket> {
  // Buscar informações do coletor
  const collector = await prisma.collector.findUnique({
    where: { id: collectorId },
    select: { pfNome: true, pfEmail: true },
  });

  if (!collector) {
    throw new Error('Coletor não encontrado');
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      subject: data.subject,
      description: data.description,
      priority: priorityToDb[data.priority],
      status: DbStatus.OPEN,
      collectorId: collectorId,
      tags: data.tags ?? [],
      messages: {
        create: {
          body: data.description,
          authorId: collectorId,
          authorRole: DbAuthorRole.USER,
        },
      },
    },
    include: {
      collector: {
        select: {
          id: true,
          pfNome: true,
          pfEmail: true,
          pfCelular: true,
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

export async function addMessageToTicketForAutonomousCollector(
  ticketId: string,
  collectorId: string,
  content: string,
  attachments?: Array<{ filename: string; url: string; size: number }>
): Promise<SupportMessage> {
  // Verificar se o ticket pertence ao coletor
  const ticket = await prisma.supportTicket.findFirst({
    where: {
      id: ticketId,
      collectorId: collectorId,
    },
    include: {
      collector: {
        select: { pfNome: true },
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
      authorId: collectorId,
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
    authorName: ticket.collector?.pfNome ?? 'Coletor',
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
