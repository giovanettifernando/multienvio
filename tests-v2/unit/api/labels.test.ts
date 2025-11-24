import assert from 'node:assert';
import test from 'node:test';
import { fetchLabels } from '../../../lib/api/labels.ts';

test.describe('api/labels fetchLabels', () => {
  test('monta query e lança em erro de status', async () => {
    let called = '';
    const originalFetch = global.fetch;
    global.fetch = (async (url: any, init: any) => {
      called = String(url);
      return {
        ok: false,
        status: 500,
      } as any;
    }) as any;
    try {
      await assert.rejects(() => fetchLabels({ page: 2, pageSize: 10, q: 'abc', printStatus: 'printed' }));
      assert.ok(called.includes('page=2'));
      assert.ok(called.includes('pageSize=10'));
      assert.ok(called.includes('q=abc'));
      assert.ok(called.includes('printStatus=printed'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  test('retorna json quando ok', async () => {
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: true,
      json: async () => ({ items: [], total: 0 }),
    })) as any;
    try {
      const res = await fetchLabels();
      assert.deepStrictEqual(res, { items: [], total: 0 });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
