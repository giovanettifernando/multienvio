import type { ApiError } from "@/lib/api/errors";
import type { ApiErrorBody, ApiResponseMeta, ApiSuccessBody } from "@/lib/api/types";

type BaseMetaInput = {
  requestId: string;
  path: string;
  method: string;
  durationMs: number;
};

type MetaInput = BaseMetaInput & {
  timestamp?: string;
  extras?: Record<string, unknown>;
};

export function buildMeta({ requestId, path, method, durationMs, timestamp, extras }: MetaInput) {
  const meta: ApiResponseMeta = {
    requestId,
    path,
    method,
    durationMs,
    timestamp: timestamp ?? new Date().toISOString(),
  };

  if (extras) {
    Object.assign(meta, extras);
  }

  return meta;
}

export function success<T>(data: T, meta: ApiResponseMeta): ApiSuccessBody<T> {
  return {
    data,
    error: null,
    meta,
  };
}

export function failure(error: ApiError, meta: ApiResponseMeta): ApiErrorBody {
  return {
    data: null,
    error: {
      code: error.code,
      message: error.message,
      requestId: meta.requestId,
      details: error.details,
    },
    meta,
  };
}
