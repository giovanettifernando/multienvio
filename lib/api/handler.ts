import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError, toApiError } from "@/lib/api/errors";
import { createRequestLogger } from "@/lib/api/logger";
import { buildMeta, failure, success } from "@/lib/api/response";
import type { ApiHandlerResult, RequestContext } from "@/lib/api/types";

type Handler<P, T> = (context: RequestContext<P>) => Promise<ApiHandlerResult<T>>;

type RouteContext<P> = {
  params: Promise<P>;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- P must accept catch-all routes with string[] values
export function withApiHandler<T = unknown, P extends Record<string, any> = Record<string, string>>(
  handler: Handler<P, T>,
): (req: NextRequest, context: RouteContext<P>) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    context: RouteContext<P>
  ) => {
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
      const params = await context.params;

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

/**
 * Handler type for routes that need full control over the response.
 * Used for auth routes (cookies), PDF downloads, redirects, etc.
 */
type ResponseHandler<P> = (context: RequestContext<P>) => Promise<NextResponse>;

/**
 * Wrapper for routes that need to return NextResponse directly.
 * Provides the same benefits as withApiHandler (logging, requestId, error handling)
 * but allows full control over the response (cookies, headers, redirects, binary data).
 *
 * Use cases:
 * - Auth routes that set/clear cookies
 * - PDF/file downloads
 * - Redirects
 * - Custom headers
 *
 * @example
 * export const POST = withApiHandlerResponse(async (context) => {
 *   // ... auth logic ...
 *   const response = NextResponse.json({ success: true });
 *   response.cookies.set('session', token, { httpOnly: true });
 *   return response;
 * });
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- P must accept catch-all routes with string[] values
export function withApiHandlerResponse<P extends Record<string, any> = Record<string, string>>(
  handler: ResponseHandler<P>,
): (req: NextRequest, context: RouteContext<P>) => Promise<NextResponse> {
  return async (
    req: NextRequest,
    context: RouteContext<P>
  ) => {
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
      const params = await context.params;

      // Handler returns NextResponse directly
      const response = await handler({
        req,
        params,
        logger,
        requestId,
        startTime,
      });

      const durationMs = Date.now() - startTime;

      // Add correlation headers to response
      response.headers.set("x-request-id", requestId);

      logger.info("request.completed", {
        status: response.status,
        durationMs,
      });

      return response;
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

      // For response handler, still return JSON error format
      const body = failure(apiError, meta);
      const response = NextResponse.json(body, { status: apiError.status ?? 500 });
      response.headers.set("x-request-id", requestId);
      return response;
    }
  };
}
