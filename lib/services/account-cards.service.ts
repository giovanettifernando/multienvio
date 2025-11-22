import { randomUUID } from "crypto";
import type { Card, Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "../api/errors";
import prisma from "../db";
import {
  decryptPan,
  encryptPan,
  loadVaultKey,
  makeFingerprint,
  parseFingerprint,
  parsePanCipher,
  serializePanCipher,
} from "../crypto/card-vault";
import type { RequestLogger } from "../api/types";
import { isCardExpired } from "../utils/card";
import type { NormalizedCardCreateInput, NormalizedCardUpdateInput } from "../validation/card";

export type AccountCardDto = Pick<
  Card,
  "id" | "brand" | "holderName" | "last4" | "expMonth" | "expYear" | "isDefault" | "billingAddressId" | "createdAt"
>;

type PrismaCardModel = PrismaClient["card"];
type PrismaAddressModel = PrismaClient["address"];
type PrismaLike = {
  card: PrismaCardModel;
  address: PrismaAddressModel;
  $transaction: <T>(fn: (tx: PrismaLike) => Promise<T>) => Promise<T>;
};

type ServiceDeps = {
  prisma: PrismaLike;
  loadVaultKey: () => Buffer | null;
  appEnv: string;
  logger?: RequestLogger;
};

type PartialDeps = Partial<Omit<ServiceDeps, "prisma">> & { prisma?: PrismaLike };

type CardListResult = {
  items: AccountCardDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function getDefaultDeps(overrides?: PartialDeps): ServiceDeps {
  const appEnv = overrides?.appEnv ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
  return {
    prisma: overrides?.prisma ?? (prisma as unknown as PrismaLike),
    loadVaultKey: overrides?.loadVaultKey ?? loadVaultKey,
    appEnv,
    logger: overrides?.logger,
  };
}

function shouldStorePanCipher(appEnv: string): boolean {
  return appEnv !== "production";
}

function requireVaultKey(loader: () => Buffer | null): Buffer {
  const key = loader();
  if (!key) {
    throw new ApiError({
      code: "vault_not_configured",
      message: "CARD_VAULT_KEY ausente ou inválido.",
      status: 422,
    });
  }
  return key;
}

function mapToDto(card: Card): AccountCardDto {
  return {
    id: card.id,
    brand: card.brand,
    holderName: card.holderName,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    isDefault: card.isDefault,
    billingAddressId: card.billingAddressId,
    createdAt: card.createdAt,
  };
}

function ensureValidExpiration(expMonth: number, expYear: number) {
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const minYear = nowYear - 1;
  const maxYear = nowYear + 15;

  if (expMonth < 1 || expMonth > 12) {
    throw new ApiError({
      code: "invalid_exp_month",
      message: "Mês inválido (01–12).",
      status: 422,
    });
  }

  if (expYear < minYear || expYear > maxYear) {
    throw new ApiError({
      code: "invalid_exp_year",
      message: "Ano inválido.",
      status: 422,
    });
  }

  if (isCardExpired(expMonth, expYear, now)) {
    throw new ApiError({
      code: "card_expired",
      message: "Cartão expirado.",
      status: 422,
    });
  }
}

async function ensureBillingAddressOwnership(
  tx: PrismaLike,
  userId: string,
  billingAddressId: string,
) {
  const address = await tx.address.findUnique({
    where: { id: billingAddressId },
    select: { id: true, userId: true },
  });

  if (!address || address.userId !== userId) {
    throw new ApiError({
      code: "forbidden",
      message: "Endereço de cobrança inválido para este usuário.",
      status: 403,
    });
  }

  return address.id;
}

async function createBillingAddressIfNeeded(
  tx: PrismaLike,
  userId: string,
  billingAddress?: NormalizedCardCreateInput["billingAddress"],
): Promise<string | null> {
  if (!billingAddress) {
    return null;
  }

  const created = await tx.address.create({
    data: {
      userId,
      label: billingAddress.label,
      cep: billingAddress.cep,
      logradouro: billingAddress.logradouro,
      numero: billingAddress.numero,
      complemento: billingAddress.complemento,
      bairro: billingAddress.bairro,
      cidade: billingAddress.cidade,
      uf: billingAddress.uf,
      isDefault: false,
    },
    select: { id: true },
  });

  return created.id;
}

function resolveFingerprintForExpirationChange(
  card: Card,
  expMonth: number,
  expYear: number,
): string {
  try {
    const { bin, last4 } = parseFingerprint(card.fingerprint);
    const month = String(expMonth).padStart(2, "0");
    return [bin, last4, String(expYear), month].join("-");
  } catch {
    return card.fingerprint;
  }
}

async function setDefaultCard(
  tx: PrismaLike,
  userId: string,
  cardId: string,
) {
  await tx.card.updateMany({
    where: {
      userId,
      NOT: { id: cardId },
    },
    data: {
      isDefault: false,
    },
  });

  await tx.card.update({
    where: { id: cardId },
    data: { isDefault: true },
  });
}

async function promoteMostRecentCard(
  tx: PrismaLike,
  userId: string,
) {
  const fallback = await tx.card.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  if (!fallback) {
    return;
  }

  await setDefaultCard(tx, userId, fallback.id);
}

export async function listUserCards(
  userId: string,
  options?: { page?: number; pageSize?: number },
  deps?: PartialDeps,
): Promise<CardListResult> {
  const { prisma: db } = getDefaultDeps(deps);
  const page = Math.max(1, options?.page ?? 1);
  const requestedPageSize = options?.pageSize ?? DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(Math.max(1, requestedPageSize), MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const [total, cards] = await Promise.all([
    db.card.count({ where: { userId } }),
    db.card.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);

  return {
    items: cards.map(mapToDto),
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function createUserCard(
  userId: string,
  input: NormalizedCardCreateInput,
  deps?: PartialDeps,
): Promise<AccountCardDto> {
  const { prisma: db, loadVaultKey: keyLoader, appEnv, logger } = getDefaultDeps(deps);
  const key = requireVaultKey(keyLoader);
  const fingerprint = makeFingerprint(input.pan, input.expMonth, input.expYear);
  const storePanCipher = shouldStorePanCipher(appEnv);
  ensureValidExpiration(input.expMonth, input.expYear);

  return db.$transaction(async (tx) => {
    const existing = await tx.card.findFirst({
      where: {
        userId,
        fingerprint,
      },
    });

    if (existing) {
      throw new ApiError({
        code: "duplicate_card",
        message: "Cartão já cadastrado para este usuário.",
        status: 409,
      });
    }

    if (input.billingAddressId) {
      await ensureBillingAddressOwnership(tx, userId, input.billingAddressId);
    }

    const billingAddressId =
      input.billingAddressId ??
      (await createBillingAddressIfNeeded(tx, userId, input.billingAddress));

    const cardCount = await tx.card.count({ where: { userId } });
    const shouldBeDefault = cardCount === 0 || input.requestDefault;

    if (shouldBeDefault && cardCount > 0) {
      await tx.card.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }

    const card = await tx.card.create({
      data: {
        userId,
        brand: input.brand,
        holderName: input.holderName,
        last4: input.last4,
        expMonth: input.expMonth,
        expYear: input.expYear,
        fingerprint,
        isDefault: shouldBeDefault,
        billingAddressId,
        vaultToken: randomUUID(),
        panCipher: storePanCipher
          ? serializePanCipher(encryptPan(input.pan, key))
          : null,
      },
    });

    logger?.audit?.("account.card.created", {
      userId,
      cardId: card.id,
      brand: card.brand,
      last4: card.last4,
      isDefault: card.isDefault,
    });

    return mapToDto(card);
  });
}

export async function updateUserCard(
  userId: string,
  cardId: string,
  input: NormalizedCardUpdateInput,
  deps?: PartialDeps,
): Promise<AccountCardDto> {
  const { prisma: db, logger } = getDefaultDeps(deps);

  return db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) {
      throw new ApiError({
        code: "not_found",
        message: "Cartão não encontrado.",
        status: 404,
      });
    }

    const data: Prisma.CardUncheckedUpdateInput = {};

    if (input.holderName) {
      data.holderName = input.holderName;
    }

    if (input.expMonth !== undefined && input.expYear !== undefined) {
      ensureValidExpiration(input.expMonth, input.expYear);
      data.expMonth = input.expMonth;
      data.expYear = input.expYear;
      const nextFingerprint = resolveFingerprintForExpirationChange(card, input.expMonth, input.expYear);
      if (nextFingerprint !== card.fingerprint) {
        const exists = await tx.card.findFirst({
          where: {
            userId,
            fingerprint: nextFingerprint,
            NOT: { id: cardId },
          },
        });
        if (exists) {
          throw new ApiError({
            code: "duplicate_card",
            message: "Outro cartão com os mesmos dados já existe.",
            status: 409,
          });
        }
      }
      data.fingerprint = nextFingerprint;
    }

    if (input.billingAddressId !== undefined) {
      if (input.billingAddressId === null) {
        data.billingAddressId = null;
      } else {
        const addressId = await ensureBillingAddressOwnership(tx, userId, input.billingAddressId);
        data.billingAddressId = addressId;
      }
    }

    let promoteFallback = false;
    let ensureDefault = false;

    if (input.isDefault !== undefined) {
      if (input.isDefault) {
        ensureDefault = true;
      } else {
        data.isDefault = false;
        promoteFallback = card.isDefault;
      }
    }

    let updated = await tx.card.update({
      where: { id: cardId },
      data,
    });

    if (ensureDefault) {
      await setDefaultCard(tx, userId, cardId);
      updated = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
      logger?.audit?.("account.card.set_default", {
        userId,
        cardId,
      });
    } else if (promoteFallback) {
      await promoteMostRecentCard(tx, userId);
      updated = await tx.card.findUniqueOrThrow({ where: { id: cardId } });
    }

    logger?.audit?.("account.card.updated", {
      userId,
      cardId,
    });

    return mapToDto(updated);
  });
}

export async function makeUserCardDefault(
  userId: string,
  cardId: string,
  deps?: PartialDeps,
): Promise<AccountCardDto> {
  const { prisma: db, logger } = getDefaultDeps(deps);

  return db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) {
      throw new ApiError({
        code: "not_found",
        message: "Cartão não encontrado.",
        status: 404,
      });
    }

    await setDefaultCard(tx, userId, cardId);
    const updated = await tx.card.findUniqueOrThrow({ where: { id: cardId } });

    logger?.audit?.("account.card.set_default", {
      userId,
      cardId,
    });

    return mapToDto(updated);
  });
}

export async function deleteUserCard(
  userId: string,
  cardId: string,
  deps?: PartialDeps,
): Promise<void> {
  const { prisma: db, logger } = getDefaultDeps(deps);

  await db.$transaction(async (tx) => {
    const card = await tx.card.findUnique({ where: { id: cardId } });
    if (!card || card.userId !== userId) {
      throw new ApiError({
        code: "not_found",
        message: "Cartão não encontrado.",
        status: 404,
      });
    }

    await tx.card.delete({ where: { id: cardId } });

    if (card.isDefault) {
      await promoteMostRecentCard(tx, userId);
    }

    logger?.audit?.("account.card.deleted", {
      userId,
      cardId,
    });
  });
}

export async function getCardPanForDev(
  userId: string,
  cardId: string,
  deps?: PartialDeps,
): Promise<string> {
  const { prisma: db, loadVaultKey: keyLoader, appEnv } = getDefaultDeps(deps);

  if (appEnv === "production") {
    throw new ApiError({
      code: "not_found",
      message: "Endpoint indisponível.",
      status: 404,
    });
  }

  const card = await db.card.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId) {
    throw new ApiError({
      code: "not_found",
      message: "Cartão não encontrado.",
      status: 404,
    });
  }

  const cipher = parsePanCipher(card.panCipher ?? null);
  if (!cipher) {
    throw new ApiError({
      code: "pan_unavailable",
      message: "PAN não disponível para este cartão.",
      status: 404,
    });
  }

  const key = requireVaultKey(keyLoader);
  return decryptPan(cipher, key);
}
