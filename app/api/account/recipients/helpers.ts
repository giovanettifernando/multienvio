import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getUserFromRequest } from "@/lib/auth/session";
import type { RequestContext } from "@/lib/api/types";
import { RecipientValidationError } from "@/lib/validation/recipient";

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

export function enforceRecipientWriteLimit(context: RequestContext) {
  const key = `account:recipients:write:${getClientIp(context.req)}`;
  enforceRateLimit({
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
