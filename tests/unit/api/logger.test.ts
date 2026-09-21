import assert from 'node:assert';
import test from 'node:test';
import { createRequestLogger } from '@/platform/api/logger';
import { logger } from '@/platform/logging/logger';

test.describe('api/logger', () => {
  test.afterEach(() => test.mock.restoreAll());

  test('cria logger filho com o contexto do request e grava evento + payload', () => {
    const chamadas: Array<{ nivel: string; obj: any; msg: string }> = [];
    const registra = (nivel: string) => (obj: any, msg: string) => chamadas.push({ nivel, obj, msg });
    const child = test.mock.method(logger, 'child', () => ({
      info: registra('info'),
      warn: registra('warn'),
      error: registra('error'),
      debug: registra('debug'),
    }) as any);

    const log = createRequestLogger({
      requestId: 'r1',
      path: '/health',
      method: 'GET',
      ip: null,
      userAgent: 'agent',
    });

    log.info('evt.info', { ok: true });
    log.warn('evt.warn');
    log.error('evt.error', { code: 'X' });
    log.debug('evt.debug', undefined);
    log.audit('evt.audit', { staffId: 's1' });

    assert.deepStrictEqual(child.mock.calls[0].arguments[0], {
      requestId: 'r1',
      path: '/health',
      method: 'GET',
      ip: undefined,
      userAgent: 'agent',
      userId: undefined,
      staffId: undefined,
    });
    assert.deepStrictEqual(chamadas.map((c) => c.nivel), ['info', 'warn', 'error', 'debug', 'info']);
    assert.deepStrictEqual(chamadas[0].obj, { event: 'evt.info', ok: true });
    assert.deepStrictEqual(chamadas[1].obj, { event: 'evt.warn' });
    assert.deepStrictEqual(chamadas[4], {
      nivel: 'info',
      obj: { event: 'evt.audit', category: 'audit', staffId: 's1' },
      msg: '[AUDIT] evt.audit',
    });
  });
});
