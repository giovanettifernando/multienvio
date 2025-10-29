import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, toApiError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { buildMeta, failure, success } from "@/lib/api/response";
import type { ApiHandlerResult, RequestContext } from "@/lib/api/types";

type Handler<P, T> = (context: RequestContext<P>) => Promise<ApiHandlerResult<T>>;

type RouteContext<P> = {
  params: P | Promise<P>;
};

function extractClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for") ??
    req.headers.get("x-real-ip") ??
    // NextRequest no longer expõe ip tipado; usar casting defensivo.
    ((req as unknown as { ip?: string }).ip ?? null) ??
    null
  );
}

function extractUserAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}

export function withApiHandler<P extends Record<string, string>, T>(
  handler: Handler<P, T>,
) {
  return async (req: NextRequest, context?: RouteContext<P>) => {
    const startTime = Date.now();
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const path = req.nextUrl.pathname;
    const method = req.method;
    const logger = createRequestLogger({
      requestId,
      path,
      method,
      ip: extractClientIp(req),
      userAgent: extractUserAgent(req),
    });

    logger.info("request.received", {
      query: Object.fromEntries(req.nextUrl.searchParams.entries()),
    });

    try {
      const params = context?.params
        ? await context.params
        : ({} as P);

      const result = await handler({
        req,
        params,
        logger,
        requestId,
        startTime,
      });

      const durationMs = Date.now() - startTime;
      const meta = buildMeta({
        requestId,
        path,
        method,
        durationMs,
        extras: result.meta ?? undefined,
      });

      logger.info("request.completed", {
        status: result.status ?? 200,
        durationMs,
      });

      const body = success(result.data, meta);
      const init = {
        status: result.status ?? 200,
        headers: result.headers,
      };

      return NextResponse.json(body, init);
    } catch (error) {
      const apiError = toApiError(error);
      const durationMs = Date.now() - startTime;
      const meta = buildMeta({
        requestId,
        path,
        method,
        durationMs,
      });

      logger.error("request.failed", {
        status: apiError.status ?? 500,
        code: apiError.code,
        message: apiError.message,
      });

      const body = failure(apiError, meta);
      return NextResponse.json(body, { status: apiError.status ?? 500 });
    }
  };
}

export function ensureMethod(req: NextRequest, allowed: string[]) {
  if (!allowed.includes(req.method)) {
    throw new ApiError({
      code: "METHOD_NOT_ALLOWED",
      message: `Método ${req.method} não permitido.`,
      status: 405,
      details: { allowed },
    });
  }
}
