import assert from 'node:assert';
import test from 'node:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

test.describe('repositories/system-status.repository', () => {
  test('lê default, atualiza e persiste em disco isolado', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'system-status-'));
    const originalCwd = process.cwd();
    process.chdir(tmpDir);
    try {
      const repo = await import('../../../platform/db/system-status.repository.ts');
      const first = await repo.getSystemStatus();
      assert.strictEqual(first.maintenance, false);

      const updated = await repo.updateSystemStatus({ maintenance: true, message: 'manut' });
      assert.strictEqual(updated.maintenance, true);
      assert.strictEqual(updated.message, 'manut');

      // read again should use cache but clone
      const again = await repo.getSystemStatus();
      assert.deepStrictEqual(again.maintenance, true);

      await repo.waitForSync();
      const file = await fs.readFile(path.join(tmpDir, 'data/system-status.json'), 'utf8');
      assert.ok(file.includes('manut'));
    } finally {
      process.chdir(originalCwd);
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
