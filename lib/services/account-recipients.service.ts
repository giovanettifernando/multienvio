import { ApiError } from "@/lib/api/errors";
import prisma from "@/lib/db";
import type { RequestLogger } from "@/lib/api/types";
import type { NormalizedRecipientCreateInput, NormalizedRecipientUpdateInput } from "@/lib/validation/recipient";
import { Prisma } from "@prisma/client";

export type AccountRecipientDto = {
  id: string;
  name: string;
  email: string | null;
  document: string | null;
  phone: string | null;
  notes: string | null;
  isDefault: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaClientLike = {
  recipient: typeof prisma.recipient;
  $transaction: typeof prisma.$transaction;
};

type ListOptions = {
  page?: number;
  pageSize?: number;
  q?: string;
  city?: string;
  uf?: string;
  cep?: string;
};

export type RecipientListResult = {
  items: AccountRecipientDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type ServiceDeps = {
  prisma: PrismaClientLike;
  logger?: RequestLogger;
};

function getDeps(overrides?: Partial<ServiceDeps>): ServiceDeps {
  return {
    prisma: overrides?.prisma ?? prisma,
    logger: overrides?.logger,
  };
}

function mapToDto(recipient: { [key: string]: any }): AccountRecipientDto {
  return {
    id: recipient.id,
    name: recipient.name,
    email: recipient.email,
    document: recipient.document,
    phone: recipient.phone,
    notes: recipient.notes,
    isDefault: recipient.isDefault,
    cep: recipient.cep,
    logradouro: recipient.logradouro,
    numero: recipient.numero,
    complemento: recipient.complemento,
    bairro: recipient.bairro,
    cidade: recipient.cidade,
    uf: recipient.uf,
    createdAt: recipient.createdAt,
    updatedAt: recipient.updatedAt,
  };
}

function buildSearchWhere(userId: string, filters: ListOptions): Prisma.RecipientWhereInput {
  const where: Prisma.RecipientWhereInput = { userId };
  const or: Prisma.RecipientWhereInput["OR"] = [];

  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      or.push(
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { document: { contains: term } },
      );
    }
  }

  if (filters.city) {
    where.city = { equals: filters.city.trim(), mode: "insensitive" };
  }

  if (filters.uf) {
    where.uf = filters.uf.trim().toUpperCase();
  }

  if (filters.cep) {
    where.cep = filters.cep.replace(/\D/g, "");
  }

  if (or.length) {
    where.OR = or;
  }

  return where;
}

async function ensureNotDuplicate(
  db: PrismaClientLike,
  userId: string,
  data: NormalizedRecipientCreateInput | NormalizedRecipientUpdateInput,
  excludeId?: string,
) {
  if (!data.document) {
    return;
  }

  const existing = await db.recipient.findFirst({
    where: {
      userId,
      document: data.document,
      cep: data.cep ?? undefined,
      nameSearch: data.nameSearch ?? undefined,
      NOT: excludeId ? { id: excludeId } : undefined,
    },
  });

  if (existing) {
    throw new ApiError({
      code: "duplicate_recipient",
      message: "Destinatário já cadastrado.",
      status: 409,
    });
  }
}

async function unsetOtherDefaults(db: PrismaClientLike, userId: string, excludeId?: string) {
  await db.recipient.updateMany({
    where: {
      userId,
      NOT: excludeId ? { id: excludeId } : undefined,
    },
    data: {
      isDefault: false,
    },
  });
}

async function promoteLatestRecipient(db: PrismaClientLike, userId: string) {
  const latest = await db.recipient.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return;
  await db.recipient.update({
    where: { id: latest.id },
    data: { isDefault: true },
  });
}

export async function listRecipients(
  userId: string,
  options: ListOptions,
  overrides?: Partial<ServiceDeps>,
): Promise<RecipientListResult> {
  const { prisma: db } = getDeps(overrides);
  const page = Math.max(1, options.page ?? 1);
  const requestedSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requestedSize), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where = buildSearchWhere(userId, options);

  const [total, rows] = await Promise.all([
    db.recipient.count({ where }),
    db.recipient.findMany({
      where,
      orderBy: [
        { isDefault: "desc" },
        { updatedAt: "desc" },
      ],
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return {
    items: rows.map(mapToDto),
    page,
    pageSize,
    total,
    totalPages,
  };
}

export async function createRecipient(
  userId: string,
  input: NormalizedRecipientCreateInput,
  overrides?: Partial<ServiceDeps>,
): Promise<AccountRecipientDto> {
  const { prisma: db, logger } = getDeps(overrides);

  return db.$transaction(async (tx) => {
    await ensureNotDuplicate(tx, userId, input);

    const existingCount = await tx.recipient.count({ where: { userId } });
    const shouldBeDefault = existingCount === 0 || input.isDefault;

    if (shouldBeDefault && existingCount > 0) {
      await unsetOtherDefaults(tx, userId);
    }

    const recipient = await tx.recipient.create({
      data: {
        userId,
        name: input.name,
        nameSearch: input.nameSearch,
        email: input.email,
        document: input.document,
        phone: input.phone,
        notes: input.notes,
        isDefault: shouldBeDefault,
        cep: input.cep,
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        bairro: input.bairro,
        cidade: input.cidade,
        uf: input.uf,
      },
    });

    logger?.audit?.("account.recipient.created", {
      userId,
      recipientId: recipient.id,
      isDefault: recipient.isDefault,
    });

    return mapToDto(recipient);
  });
}

export async function updateRecipient(
  userId: string,
  recipientId: string,
  input: NormalizedRecipientUpdateInput,
  overrides?: Partial<ServiceDeps>,
): Promise<AccountRecipientDto> {
  const { prisma: db, logger } = getDeps(overrides);

  return db.$transaction(async (tx) => {
    const current = await tx.recipient.findUnique({ where: { id: recipientId } });

    if (!current || current.userId !== userId) {
      throw new ApiError({
        code: "recipient_not_found",
        message: "Destinatário não encontrado.",
        status: 404,
      });
    }

    await ensureNotDuplicate(tx, userId, {
      document: input.document ?? current.document,
      cep: input.cep ?? current.cep,
      nameSearch: input.nameSearch ?? current.nameSearch,
    }, recipientId);

    const data: Prisma.RecipientUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.nameSearch !== undefined) data.nameSearch = input.nameSearch;
    if (input.email !== undefined) data.email = input.email;
    if (input.document !== undefined) data.document = input.document;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.cep !== undefined) data.cep = input.cep;
    if (input.logradouro !== undefined) data.logradouro = input.logradouro;
    if (input.numero !== undefined) data.numero = input.numero;
    if (input.complemento !== undefined) data.complemento = input.complemento;
    if (input.bairro !== undefined) data.bairro = input.bairro;
    if (input.cidade !== undefined) data.cidade = input.cidade;
    if (input.uf !== undefined) data.uf = input.uf;

    const shouldSetDefault = input.isDefault === true;
    if (shouldSetDefault) {
      await unsetOtherDefaults(tx, userId, recipientId);
      data.isDefault = true;
    } else if (input.isDefault === false) {
      data.isDefault = false;
    }

    const updated = await tx.recipient.update({
      where: { id: recipientId },
      data,
    });

    if (!updated.isDefault && current.isDefault && input.isDefault === false) {
      await promoteLatestRecipient(tx, userId);
    }

    logger?.audit?.("account.recipient.updated", {
      userId,
      recipientId,
      isDefault: updated.isDefault,
    });

    return mapToDto(updated);
  });
}

export async function deleteRecipient(
  userId: string,
  recipientId: string,
  overrides?: Partial<ServiceDeps>,
): Promise<void> {
  const { prisma: db, logger } = getDeps(overrides);

  await db.$transaction(async (tx) => {
    const current = await tx.recipient.findUnique({ where: { id: recipientId } });
    if (!current || current.userId !== userId) {
      throw new ApiError({
        code: "recipient_not_found",
        message: "Destinatário não encontrado.",
        status: 404,
      });
    }

    await tx.recipient.delete({ where: { id: recipientId } });

    if (current.isDefault) {
      await promoteLatestRecipient(tx, userId);
    }

    logger?.audit?.("account.recipient.deleted", {
      userId,
      recipientId,
    });
  });
}

export async function makeRecipientDefault(
  userId: string,
  recipientId: string,
  overrides?: Partial<ServiceDeps>,
): Promise<AccountRecipientDto> {
  const { prisma: db, logger } = getDeps(overrides);

  return db.$transaction(async (tx) => {
    const current = await tx.recipient.findUnique({ where: { id: recipientId } });
    if (!current || current.userId !== userId) {
      throw new ApiError({
        code: "recipient_not_found",
        message: "Destinatário não encontrado.",
        status: 404,
      });
    }

    await unsetOtherDefaults(tx, userId, recipientId);
    const updated = await tx.recipient.update({
      where: { id: recipientId },
      data: { isDefault: true },
    });

    logger?.audit?.("account.recipient.set_default", {
      userId,
      recipientId,
    });

    return mapToDto(updated);
  });
}
