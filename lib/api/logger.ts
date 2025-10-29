type LogLevel = "info" | "warn" | "error" | "debug" | "audit";

type LoggerContext = {
  requestId: string;
  path: string;
  method: string;
  ip?: string | null;
  userAgent?: string | null;
};

type LogPayload = Record<string, unknown> | undefined;

function stringify(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: "failed-to-serialize-payload" });
  }
}

function writeLog(level: Exclude<LogLevel, "audit">, event: string, payload: LogPayload) {
  const entry = payload ?? {};
  const consoleMethod =
    level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleMethod(stringify({ level, event, ...entry }));
}

export function createRequestLogger(context: LoggerContext) {
  const base = {
    requestId: context.requestId,
    path: context.path,
    method: context.method,
    ip: context.ip ?? undefined,
    userAgent: context.userAgent ?? undefined,
  };

  const log = (level: Exclude<LogLevel, "audit">, event: string, payload?: LogPayload) => {
    writeLog(level, event, { ...base, ...payload });
  };

  return {
    info(event: string, payload?: LogPayload) {
      log("info", event, payload);
    },
    warn(event: string, payload?: LogPayload) {
      log("warn", event, payload);
    },
    error(event: string, payload?: LogPayload) {
      log("error", event, payload);
    },
    debug(event: string, payload?: LogPayload) {
      log("debug", event, payload);
    },
    audit(event: string, payload?: LogPayload) {
      writeLog("info", event, { ...base, category: "audit", ...payload });
    },
  };
}
