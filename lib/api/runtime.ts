declare global {
  var __envioLegalAppStartedAt: number | undefined;
}

const startedAtMs =
  globalThis.__envioLegalAppStartedAt ?? Date.now();

if (!globalThis.__envioLegalAppStartedAt) {
  globalThis.__envioLegalAppStartedAt = startedAtMs;
}

export function getAppStartedAt(): number {
  return startedAtMs;
}

export function getAppStartedAtIso(): string {
  return new Date(startedAtMs).toISOString();
}
