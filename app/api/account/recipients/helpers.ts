import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/rate-limit-redis";
import { getUserFromRequest } from "@/lib/auth/session";
import type { RequestContext } from "@/lib/api/types";
import { RecipientValidationError } from "@/lib/validation/recipient";
import { isDatabaseUnavailableError, schedulePrismaReconnect } from "@/lib/db";

const WRITE_LIMIT = 10;
const WRITE_WINDOW_MS = 60_000;

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    ((req as unknown as { ip?: string }).ip ?? "unknown")
  );
}

export async function requireUserId(req: NextRequest) {
  const session = await getUserFromRequest(req);
  if (!session?.userId) {
    throw new ApiError({
      code: "unauthorized",
      message: "Autenticação necessária.",
      status: 401,
    });
  }
  return session.userId;
}

export async function enforceRecipientWriteLimit(context: RequestContext) {
  const key = `account:recipients:write:${getClientIp(context.req)}`;
  await enforceRateLimit({
    key,
    limit: WRITE_LIMIT,
    windowMs: WRITE_WINDOW_MS,
  });
}

export function parsePositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function makeSchemaOutOfDateError(): never {
  throw new ApiError({
    code: "schema_out_of_date",
    message: "Estrutura de destinatários indisponível. Execute as migrações (public.recipients).",
    status: 503,
  });
}

const MISSING_RECIPIENT_PATTERNS = [
  /relation ["`]recipients["`] does not exist/i,
  /table ["`]recipients["`]/i,
];

export function handleRecipientDataStoreError(error: unknown): never {
  if (isDatabaseUnavailableError(error)) {
    void schedulePrismaReconnect();
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      makeSchemaOutOfDateError();
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    if (MISSING_RECIPIENT_PATTERNS.some((pattern) => pattern.test(error.message))) {
      makeSchemaOutOfDateError();
    }
  }

  if (error instanceof Error) {
    if (MISSING_RECIPIENT_PATTERNS.some((pattern) => pattern.test(error.message))) {
      makeSchemaOutOfDateError();
    }
  }

  throw error;
}

export function mapRecipientValidationError(error: unknown): never {
  if (error instanceof RecipientValidationError) {
    switch (error.code) {
      case "invalid_cpf":
        throw new ApiError({
          code: "invalid_cpf",
          message: "CPF inválido.",
          status: 422,
        });
      case "invalid_cnpj":
        throw new ApiError({
          code: "invalid_cnpj",
          message: "CNPJ inválido.",
          status: 422,
        });
      case "invalid_phone":
        throw new ApiError({
          code: "invalid_phone",
          message: "Telefone inválido.",
          status: 422,
        });
      case "invalid_cep":
        throw new ApiError({
          code: "invalid_cep",
          message: "CEP inválido.",
          status: 422,
        });
      case "invalid_uf":
        throw new ApiError({
          code: "invalid_uf",
          message: "UF inválida.",
          status: 422,
        });
      case "invalid_payload":
      default:
        throw new ApiError({
          code: "invalid_payload",
          message: error.message,
          status: 400,
        });
    }
  }

  throw error;
}
