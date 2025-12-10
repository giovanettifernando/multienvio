import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
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
  // Already an ApiError - return as is
  if (error instanceof ApiError) {
    return error;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return new ApiError({
      code: "VALIDATION_ERROR",
      message: firstIssue?.message || "Dados inválidos",
      status: 422,
      details: {
        errors: error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
          code: issue.code,
        })),
      },
      cause: error,
    });
  }

  // Prisma database initialization errors
  if (error instanceof Prisma.PrismaClientInitializationError || isDatabaseUnavailableError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    void schedulePrismaReconnect();
    return new ApiError({
      code: "SERVICE_UNAVAILABLE",
      message: "Banco de dados indisponível. Tente novamente em instantes.",
      status: 503,
      details: { message },
      cause: error,
    });
  }

  // Prisma schema out of date
  if (error instanceof Prisma.PrismaClientKnownRequestError && isRelationMissing(error)) {
    return new ApiError({
      code: "SCHEMA_OUT_OF_DATE",
      message: "Estrutura de dados indisponível. Execute `npx prisma migrate deploy`.",
      status: 503,
      details: { code: error.code, meta: error.meta },
      cause: error,
    });
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError && isRelationMissing(error as Error)) {
    return new ApiError({
      code: "SCHEMA_OUT_OF_DATE",
      message: "Estrutura de dados indisponível. Execute `npx prisma migrate deploy`.",
      status: 503,
      details: { message: error.message },
      cause: error,
    });
  }

  // Prisma known request errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002": // Unique constraint violation
        const target = (error.meta?.target as string[])?.join(", ") || "campo";
        return new ApiError({
          code: "DUPLICATE_ENTRY",
          message: `Já existe um registro com este ${target}.`,
          status: 409,
          details: { field: target, prismaCode: error.code },
          cause: error,
        });
      case "P2025": // Record not found
        return new ApiError({
          code: "NOT_FOUND",
          message: "Registro não encontrado.",
          status: 404,
          details: { prismaCode: error.code },
          cause: error,
        });
      case "P2003": // Foreign key constraint failed
        return new ApiError({
          code: "REFERENCE_ERROR",
          message: "Registro referenciado não existe ou foi removido.",
          status: 400,
          details: { prismaCode: error.code },
          cause: error,
        });
      default:
        // Other Prisma errors - log but don't expose details
        return new ApiError({
          code: "DATABASE_ERROR",
          message: "Erro ao acessar o banco de dados.",
          status: 500,
          details: process.env.NODE_ENV === "development" ? { prismaCode: error.code, meta: error.meta } : undefined,
          cause: error,
        });
    }
  }

  // Generic errors
  if (error instanceof Error) {
    // 🛡️ SECURITY FIX: Não expor stack traces em produção
    const isDev = process.env.NODE_ENV === "development";
    return new ApiError({
      code: "INTERNAL_ERROR",
      message: "Erro inesperado, tente novamente mais tarde.",
      status: 500,
      details: isDev ? { name: error.name, message: error.message, stack: error.stack } : undefined,
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
