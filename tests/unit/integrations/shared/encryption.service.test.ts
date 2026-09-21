import assert from 'node:assert';
import test from 'node:test';
import path from 'node:path';

const MODULE_PATH = path.resolve(__dirname, '../../../../platform/integrations/shared/encryption.service.ts');
const FIXED_KEY = 'a'.repeat(64);
const originalEnvKey = process.env.ENCRYPTION_KEY;

function loadModule() {
  delete require.cache[MODULE_PATH];
  process.env.ENCRYPTION_KEY = FIXED_KEY;
   
  return require(MODULE_PATH) as typeof import('../../../../platform/integrations/shared/encryption.service.ts');
}

test.after(() => {
  process.env.ENCRYPTION_KEY = originalEnvKey;
});

test.describe('encryption.service', () => {
  test('encrypt/decrypt devolve texto original e gera saída não vazia', async () => {
    const { encrypt, decrypt } = await loadModule();
    const cipher = encrypt('segredo');
    assert.ok(cipher.includes(':'));
    const plain = decrypt(cipher);
    assert.strictEqual(plain, 'segredo');
  });

  test('decrypt lança para formato inválido', async () => {
    const { decrypt } = await loadModule();
    await assert.rejects(async () => decrypt('sem-dois-pontos'), /Invalid encrypted format/);
  });

  test('encryptCredentialFields encripta apenas campos sensíveis', async () => {
    const { encryptCredentialFields, decrypt } = await loadModule();
    const data = {
      apiKey: 'k1',
      clientSecret: 's1',
      password: 'p1',
      token: 't1',
      secretKey: 'sk1',
      accessToken: 'a1',
      refreshToken: 'r1',
      keep: 'plain',
    };
    const encrypted = encryptCredentialFields(data);
    assert.strictEqual(encrypted.keep, 'plain');
    for (const key of [
      'apiKey',
      'clientSecret',
      'password',
      'token',
      'secretKey',
      'accessToken',
      'refreshToken',
    ]) {
      const value = encrypted[key] as string;
      assert.notStrictEqual(value, data[key]);
      assert.strictEqual(decrypt(value), data[key]);
    }
  });

  test('decryptCredentialFields devolve valores originais e mantém inválidos sem quebrar', async () => {
    const { encrypt, decryptCredentialFields } = await loadModule();
    const encryptedToken = encrypt('tok123');
    const input = {
      token: encryptedToken,
      accessToken: 'bad-format',
      refreshToken: null,
    };

    const decrypted = decryptCredentialFields(input);
    assert.strictEqual(decrypted.token, 'tok123');
    // valor inválido permanece inalterado
    assert.strictEqual(decrypted.accessToken, 'bad-format');
    // null permanece null
    assert.strictEqual(decrypted.refreshToken, null);
  });
});
