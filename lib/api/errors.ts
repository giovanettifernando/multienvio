import { Prisma } from "@prisma/client";
import { schedulePrismaReconnect, isDatabaseUnavailableError } from "../db";

export type ApiErrorInput = {
  code: string;
  message: string;
  status?: number;
  details?: unknown;
  cause?: unknown;
};

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor({ code, message, status = 400, details, cause }: ApiErrorInput) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    if (cause) {
      this.cause = cause;
    }
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError({ code: "BAD_REQUEST", message, status: 400, details });
  }

  static notFound(message: string, details?: unknown) {
    return new ApiError({ code: "NOT_FOUND", message, status: 404, details });
  }

  static validation(message: string, details?: unknown) {
    return new ApiError({ code: "VALIDATION_ERROR", message, status: 422, details });
  }

  static unauthorized(message: string, details?: unknown) {
    return new ApiError({ code: "UNAUTHORIZED", message, status: 401, details });
  }

  static forbidden(message: string, details?: unknown) {
    return new ApiError({ code: "FORBIDDEN", message, status: 403, details });
  }
}

function isRelationMissing(error: Prisma.PrismaClientKnownRequestError | Error) {
  const message = error.message ?? "";
  return /relation .* does not exist/i.test(message) || /table .* does not exist/i.test(message);
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof Prisma.PrismaClientInitializationError || isDatabaseUnavailableError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    void schedulePrismaReconnect();
    return new ApiError({
      code: "service_unavailable",
      message: "Banco de dados indisponível. Tente novamente em instantes.",
      status: 503,
      details: { message },
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && isRelationMissing(error)) {
    return new ApiError({
      code: "schema_out_of_date",
      message: "Estrutura de dados indisponível. Execute `npx prisma migrate deploy`.",
      status: 503,
      details: { code: error.code, meta: error.meta },
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError && isRelationMissing(error as Error)) {
    return new ApiError({
      code: "schema_out_of_date",
      message: "Estrutura de dados indisponível. Execute `npx prisma migrate deploy`.",
      status: 503,
      details: { message: error.message },
      cause: error,
    });
  }

  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    return new ApiError({
      code: "INTERNAL_ERROR",
      message: "Erro inesperado, tente novamente mais tarde.",
      status: 500,
      details: { name: error.name, message: error.message, stack: error.stack },
      cause: error,
    });
  }

  return new ApiError({
    code: "INTERNAL_ERROR",
    message: "Erro inesperado, tente novamente mais tarde.",
    status: 500,
    details: { value: error },
  });
}
