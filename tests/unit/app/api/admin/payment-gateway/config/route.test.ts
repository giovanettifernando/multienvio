import assert from 'node:assert';
import test from 'node:test';
import { GET, POST } from '@/app/api/admin/payment-gateway/config/route';
import { prisma } from '@/platform/db/db';
import { encrypt, decrypt } from '@/platform/integrations/shared/encryption.service';
import * as adminSessionModule from '@/modules/auth/application/admin-session';
import { adminSession, apiRequest, callRoute, readApi } from '../../../../../../_setup/test-helpers';

const original = { paymentGateway: prisma.paymentGateway, paymentCredential: prisma.paymentCredential };

const ver = (qs = '') => callRoute(GET, apiRequest(`/api/admin/payment-gateway/config${qs}`));
const salvar = (json: unknown) => callRoute(POST, apiRequest('/api/admin/payment-gateway/config', { json }));

function gatewayCom(credencial: Record<string, unknown> | null) {
  prisma.paymentGateway = {
    findFirst: async () => ({
      id: 'g1',
      environment: 'SANDBOX',
      credentials: credencial ? [credencial] : [],
    }),
  } as any;
}

test.describe('app/api/admin/payment-gateway/config', () => {
  test.beforeEach(() => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['INTEGRACOES'] })
    );
  });

  test.afterEach(() => {
    test.mock.restoreAll();
    Object.assign(prisma, original);
  });

  test('GET e POST exigem a permissão INTEGRACOES', async () => {
    test.mock.method(adminSessionModule, 'getAdminSessionFromRequest', async () =>
      adminSession({ permissions: ['FINANCEIRO'] })
    );
    assert.strictEqual((await ver()).status, 403);
    assert.strictEqual((await salvar({ environment: 'SANDBOX' })).status, 403);
  });

  test('GET devolve config nula quando não há credencial', async () => {
    gatewayCom(null);
    const res = await readApi(await ver());
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.data, { config: null });
  });

  test('GET esconde a chave e o token do webhook por padrão', async () => {
    gatewayCom({ accessToken: encrypt('$aact_chave'), clientSecret: encrypt('token-webhook'), publicKey: null });

    const res = await readApi(await ver());

    assert.strictEqual(res.data.config.accessToken, '***configurado***');
    assert.strictEqual(res.data.config.webhookSecret, '***configurado***');
    assert.strictEqual(res.data.config.hasAccessToken, true);
    assert.strictEqual(res.data.config.environment, 'SANDBOX');
  });

  test('GET com reveal=true devolve os valores em claro', async () => {
    gatewayCom({ accessToken: encrypt('$aact_chave'), clientSecret: encrypt('token-webhook') });
    const res = await readApi(await ver('?reveal=true'));
    assert.strictEqual(res.data.config.accessToken, '$aact_chave');
    assert.strictEqual(res.data.config.webhookSecret, 'token-webhook');
  });

  test('GET avisa quando não consegue descriptografar (chave de criptografia trocada)', async () => {
    gatewayCom({ accessToken: 'lixo-que-nao-descriptografa' });
    const res = await readApi(await ver());
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.config.accessTokenDecryptionFailed, true);
  });

  test('POST recusa ambiente desconhecido', async () => {
    const res = await readApi(await salvar({ environment: 'TESTE' }));
    assert.strictEqual(res.status, 400);
  });

  test('POST cria gateway e credencial com a chave criptografada', async () => {
    let credencial: any;
    prisma.paymentGateway = {
      findFirst: async () => null,
      create: async (a: any) => ({ id: 'g1', ...a.data }),
    } as any;
    prisma.paymentCredential = {
      findFirst: async () => null,
      create: async (a: any) => { credencial = a.data; return { id: 'c1', ...a.data }; },
    } as any;

    const res = await readApi(await salvar({ environment: 'SANDBOX', accessToken: '$aact_nova', webhookSecret: 'wh' }));

    assert.strictEqual(res.status, 200);
    assert.strictEqual(credencial.gatewayId, 'g1');
    assert.strictEqual(credencial.isActive, true);
    assert.notStrictEqual(credencial.accessToken, '$aact_nova', 'a chave não pode ser gravada em claro');
    assert.strictEqual(decrypt(credencial.accessToken), '$aact_nova');
    // o Asaas lê o token do webhook de clientSecret
    assert.strictEqual(decrypt(credencial.clientSecret), 'wh');
  });

  test('POST sem chave nova mantém a que já está gravada', async () => {
    let atualizado: any;
    prisma.paymentGateway = {
      findFirst: async () => ({ id: 'g1' }),
      update: async (a: any) => ({ id: 'g1', ...a.data }),
    } as any;
    prisma.paymentCredential = {
      findFirst: async () => ({ id: 'c1' }),
      update: async (a: any) => { atualizado = a.data; return { id: 'c1' }; },
    } as any;

    const res = await readApi(await salvar({ environment: 'PRODUCTION' }));

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(atualizado, {});
  });
});
