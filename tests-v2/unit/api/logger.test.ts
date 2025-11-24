import assert from 'node:assert';
import test from 'node:test';
import { createRequestLogger } from '../../../lib/api/logger.ts';

test.describe('api/logger', () => {
  test('escreve logs com campos básicos e captura payloads', () => {
    const calls: any[] = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    console.log = (...args: any[]) => calls.push({ level: 'log', args });
    console.warn = (...args: any[]) => calls.push({ level: 'warn', args });
    console.error = (...args: any[]) => calls.push({ level: 'error', args });

    try {
      const logger = createRequestLogger({
        requestId: 'r1',
        path: '/health',
        method: 'GET',
        ip: '1.1.1.1',
        userAgent: 'agent',
      });

      const circular: any = {};
      circular.self = circular;

      logger.info('evt.info', { ok: true });
      logger.warn('evt.warn', { warn: true });
      logger.error('evt.error', circular); // força fallback de stringify
      logger.debug('evt.debug', undefined);
      logger.audit('evt.audit', { audit: true });

      assert.strictEqual(calls.length, 5);
      const levels = calls.map((c) => c.level);
      assert.ok(levels.includes('error'));
      assert.ok(levels.includes('log'));
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  });
});
