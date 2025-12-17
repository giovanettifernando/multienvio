/**
 * Debug types and helpers for Assistant
 *
 * Provides structured debug events for tracing assistant requests
 * through the entire flow: client -> route -> orchestrator -> openrouter
 */

// ============================================================================
// Types
// ============================================================================

export type DebugEventType =
  | 'request_start'
  | 'request_end'
  | 'openrouter_call_start'
  | 'openrouter_call_end'
  | 'openrouter_retry'
  | 'openrouter_error'
  | 'tool_call_start'
  | 'tool_call_end'
  | 'tool_iterations_limit_hit'
  | 'idempotency_hit'
  | 'error';

export interface DebugEvent {
  type: DebugEventType;
  requestId: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface DebugContext {
  requestId: string;
  debug: boolean;
  events: DebugEvent[];
  callIndex: number;
}

export interface DebugSummary {
  requestId: string;
  durationMs: number;
  callsTotal: number;
  toolCallsTotal: number;
  retriesTotal: number;
  fallbackUsed: boolean;
  success: boolean;
  error?: string;
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Creates a new debug context for a request
 */
export function createDebugContext(requestId: string, debug: boolean): DebugContext {
  return {
    requestId,
    debug,
    events: [],
    callIndex: 0,
  };
}

/**
 * Adds an event to the debug context
 */
export function addDebugEvent(
  ctx: DebugContext,
  type: DebugEventType,
  data?: Record<string, unknown>
): void {
  if (!ctx.debug) return;

  ctx.events.push({
    type,
    requestId: ctx.requestId,
    timestamp: Date.now(),
    data,
  });
}

/**
 * Increments the call index and returns it
 */
export function nextCallIndex(ctx: DebugContext): number {
  ctx.callIndex += 1;
  return ctx.callIndex;
}

/**
 * Generates a summary from the debug context
 */
export function generateDebugSummary(
  ctx: DebugContext,
  startTime: number,
  success: boolean,
  error?: string
): DebugSummary {
  const events = ctx.events;

  const callsTotal = events.filter(
    (e) => e.type === 'openrouter_call_start'
  ).length;

  const toolCallsTotal = events.filter(
    (e) => e.type === 'tool_call_start'
  ).length;

  const retriesTotal = events.filter(
    (e) => e.type === 'openrouter_retry'
  ).length;

  const fallbackUsed = events.some(
    (e) => e.type === 'openrouter_error' && e.data?.fallback === true
  );

  return {
    requestId: ctx.requestId,
    durationMs: Date.now() - startTime,
    callsTotal,
    toolCallsTotal,
    retriesTotal,
    fallbackUsed,
    success,
    error,
  };
}

// ============================================================================
// Sanitization (for safe logging)
// ============================================================================

/**
 * Sanitizes data for logging - removes sensitive info
 */
export function sanitizeForLog(data: unknown): unknown {
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Truncate long strings
    if (data.length > 200) {
      return data.slice(0, 200) + '...[truncated]';
    }
    return data;
  }

  if (Array.isArray(data)) {
    if (data.length > 10) {
      return [...data.slice(0, 10).map(sanitizeForLog), `...[${data.length - 10} more]`];
    }
    return data.map(sanitizeForLog);
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive keys
      if (['apiKey', 'authorization', 'password', 'token', 'secret'].includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      sanitized[key] = sanitizeForLog(value);
    }

    return sanitized;
  }

  return data;
}

/**
 * Creates a safe tool args summary for logging
 */
export function summarizeToolArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== 'object') {
    return { raw: String(args).slice(0, 100) };
  }

  const obj = args as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string' && value.length > 50) {
      summary[key] = value.slice(0, 50) + '...';
    } else if (Array.isArray(value)) {
      summary[key] = `[Array(${value.length})]`;
    } else if (typeof value === 'object' && value !== null) {
      summary[key] = '[Object]';
    } else {
      summary[key] = value;
    }
  }

  return summary;
}

/**
 * Creates a safe tool result summary for logging
 */
export function summarizeToolResult(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object') {
    return { raw: String(result).slice(0, 100) };
  }

  const obj = result as Record<string, unknown>;

  return {
    success: obj.success,
    hasData: 'data' in obj,
    error: obj.error ? String(obj.error).slice(0, 100) : undefined,
  };
}
