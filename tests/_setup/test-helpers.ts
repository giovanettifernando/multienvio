import { mock } from 'node:test';

// Ensure consistent test env
if (!process.env.NODE_ENV) {
  (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
}

export function resetAllMocks() {
  mock.restoreAll();
}

export function createMockedPrisma<T extends object>(target: T): T {
  return target;
}

/**
 * Utility to patch a method and return the spy for assertions.
 */
export function stubMethod<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  implementation: T[K]
) {
  return mock.method(obj, key as string, implementation as never);
}

/**
 * Tiny helper to advance timers in tests that rely on setTimeout.
 */
export async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
