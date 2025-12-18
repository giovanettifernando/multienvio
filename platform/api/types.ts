import type { NextRequest } from "next/server";

export type RequestLogger = {
  info: (event: string, payload?: Record<string, unknown>) => void;
  warn: (event: string, payload?: Record<string, unknown>) => void;
  error: (event: string, payload?: Record<string, unknown>) => void;
  debug: (event: string, payload?: Record<string, unknown>) => void;
  audit: (event: string, payload?: Record<string, unknown>) => void;
};

export type ApiResponseMeta = {
  requestId: string;
  method: string;
  path: string;
  timestamp: string;
  durationMs: number;
  tags?: string[];
  [key: string]: unknown;
};

export type ApiSuccessBody<T> = {
  data: T;
  error: null;
  meta: ApiResponseMeta;
};

export type ApiErrorBody = {
  data: null;
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
  meta: ApiResponseMeta;
};

export type ApiResponseBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export type ApiHandlerResult<T> = {
  data: T;
  status?: number;
  headers?: Record<string, string>;
  meta?: Partial<Omit<ApiResponseMeta, "requestId" | "method" | "path" | "timestamp" | "durationMs">>;
};

export type RequestContext<P = Record<string, any>> = {
  req: NextRequest;
  params: P;
  logger: RequestLogger;
  requestId: string;
  startTime: number;
};
