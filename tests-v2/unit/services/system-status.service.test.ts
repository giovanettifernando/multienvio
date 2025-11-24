import assert from 'node:assert';
import test from 'node:test';
import * as repo from '../../../lib/repositories/system-status.repository.ts';
import { getSystemStatus, updateSystemStatus } from '../../../lib/services/system-status.service.ts';

test.describe('services/system-status.service', () => {
  test.afterEach(() => {
    test.mock.restoreAll();
  });

  test('getSystemStatus delega ao repositório e registra debug', async () => {
    const status = { maintenance: false, message: 'ok', updatedAt: '2020-01-01' };
    const getSpy = test.mock.method(repo, 'getSystemStatus', async () => status);
    let debugCalled = false;
    const logger = { debug: () => { debugCalled = true; } } as any;

    const result = await getSystemStatus(logger);
    assert.deepStrictEqual(result, status);
    assert.strictEqual(debugCalled, true);
    getSpy.mock.restore();
  });

  test('updateSystemStatus delega e registra audit', async () => {
    const updated = { maintenance: true, message: 'manut', updatedAt: '2021-01-01' };
    const updateSpy = test.mock.method(repo, 'updateSystemStatus', async () => updated);
    let auditCalled = false;
    const logger = { audit: () => { auditCalled = true; } } as any;

    const result = await updateSystemStatus({ maintenance: true, message: 'manut' }, logger);
    assert.deepStrictEqual(result, updated);
    assert.strictEqual(auditCalled, true);
    updateSpy.mock.restore();
  });
});
