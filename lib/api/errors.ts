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

export function toApiError(error: unknown): ApiError {
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
