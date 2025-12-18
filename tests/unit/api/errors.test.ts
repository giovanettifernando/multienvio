import assert from 'node:assert';
import test from 'node:test';
import { ApiError, toApiError } from '@/platform/api/errors';
import { prisma } from '@/platform/db/db';

const originalDisconnect = prisma.$disconnect;

test.describe('api/errors', () => {
  test.afterEach(() => {
    prisma.$disconnect = originalDisconnect;
  });

  test('mantém ApiError existente ou converte Error genérico', () => {
    const existing = ApiError.badRequest('bad');
    assert.strictEqual(toApiError(existing), existing);

    const err = new Error('boom');
    const apiErr = toApiError(err);
    assert.strictEqual(apiErr.code, 'INTERNAL_ERROR');
    assert.strictEqual(apiErr.status, 500);
    assert.strictEqual(apiErr instanceof ApiError, true);
  });

  test('marca indisponibilidade de banco e agenda reconnect', async () => {
    let disconnected = false;
    prisma.$disconnect = async () => {
      disconnected = true;
    };

    const apiErr = toApiError(new Error("Can't reach database server"));
    assert.strictEqual(apiErr.status, 503);
    assert.strictEqual(apiErr.code, 'service_unavailable');
    // schedulePrismaReconnect executa de forma assíncrona
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.strictEqual(disconnected, true);
  });
});
