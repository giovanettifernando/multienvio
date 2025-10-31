import { NextRequest } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/api/rate-limit";
import { getUserFromRequest } from "@/lib/auth/session";
import type { RequestContext } from "@/lib/api/types";
import { CardValidationError } from "@/lib/validation/card";

const WRITE_LIMIT = 10;
const WRITE_WINDOW_MS = 60_000;

export const CARD_WRITE_LIMIT = WRITE_LIMIT;
export const CARD_WRITE_WINDOW_MS = WRITE_WINDOW_MS;

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

export function enforceCardWriteLimit(context: RequestContext) {
  const key = `account:cards:write:${getClientIp(context.req)}`;
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

export function rethrowCardValidation(error: unknown): never {
  if (error instanceof CardValidationError) {
    switch (error.code) {
      case "invalid_payload":
        throw new ApiError({
          code: "invalid_payload",
          message: error.message,
          status: 400,
        });
      case "invalid_number":
        throw new ApiError({
          code: "invalid_number",
          message: error.message,
          status: 422,
        });
      case "invalid_cvv":
        throw new ApiError({
          code: "invalid_cvv",
          message: error.message,
          status: 422,
        });
      case "invalid_exp_month":
        throw new ApiError({
          code: "invalid_exp_month",
          message: "Mês inválido (01–12).",
          status: 422,
        });
      case "invalid_exp_year":
        throw new ApiError({
          code: "invalid_exp_year",
          message: "Ano inválido.",
          status: 422,
        });
      case "card_expired":
        throw new ApiError({
          code: "card_expired",
          message: "Cartão expirado.",
          status: 422,
        });
      case "invalid_holder":
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
