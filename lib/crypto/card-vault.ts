/**
 * Card Vault - Criptografia de PANs (números de cartão)
 *
 * Usa AES-256-GCM para criptografar números de cartão.
 * A chave deve ser configurada via CARD_VAULT_KEY (base64, 32 bytes).
 *
 * Rotação de chaves:
 * - Configure CARD_VAULT_KEY_OLD com a chave antiga
 * - O sistema tentará descriptografar com a chave nova primeiro,
 *   depois com a antiga se falhar
 * - Recriptografe os dados gradualmente usando a nova chave
 *
 * Segurança:
 * - CARD_VAULT_KEY é obrigatória em produção
 * - AES-256-GCM fornece autenticação e confidencialidade
 * - IV único para cada criptografia
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { logger } from '@/lib/logger';

// Validar CARD_VAULT_KEY em produção
if (process.env.NODE_ENV === 'production' && !process.env.CARD_VAULT_KEY) {
  throw new Error(
    'SECURITY ERROR: CARD_VAULT_KEY environment variable is required in production. ' +
    'Generate with: openssl rand -base64 32'
  );
}

export type PanCipherPayload = {
  cipher: string;
  iv: string;
  tag: string;
  keyId?: string; // Identificador da chave usada (para rotação)
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_ID_CURRENT = 'current';
const KEY_ID_OLD = 'old';

/**
 * Carrega e valida uma chave de criptografia
 */
function loadKey(envVar: string): Buffer | null {
  const raw = process.env[envVar];
  if (!raw) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length !== 32) {
      logger.error({
        event: 'card_vault_key_invalid_length',
        envVar,
        length: decoded.length,
        expected: 32,
      }, 'Card vault key has invalid length');
      return null;
    }
    return decoded;
  } catch (error) {
    logger.error({
      event: 'card_vault_key_decode_error',
      envVar,
      err: error instanceof Error ? { message: error.message, name: error.name } : error,
    }, 'Failed to decode card vault key');
    return null;
  }
}

/**
 * Carrega a chave atual do vault
 * @returns Buffer com a chave ou null se não configurada
 */
export function loadVaultKey(): Buffer | null {
  return loadKey('CARD_VAULT_KEY');
}

/**
 * Carrega a chave antiga para rotação
 * @returns Buffer com a chave antiga ou null se não configurada
 */
export function loadOldVaultKey(): Buffer | null {
  return loadKey('CARD_VAULT_KEY_OLD');
}

/**
 * Criptografa um PAN (número de cartão)
 * @param pan - Número do cartão (apenas dígitos)
 * @param key - Chave de criptografia (32 bytes)
 * @returns Payload com dados criptografados
 */
export function encryptPan(pan: string, key: Buffer): PanCipherPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(pan, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipher: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    keyId: KEY_ID_CURRENT,
  };
}

/**
 * Descriptografa um PAN usando a chave especificada
 * @throws Error se a descriptografia falhar
 */
function decryptPanWithKey(payload: PanCipherPayload, key: Buffer): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const pan = Buffer.concat([
    decipher.update(Buffer.from(payload.cipher, 'base64')),
    decipher.final(),
  ]).toString('utf8');
  return pan;
}

/**
 * Descriptografa um PAN
 * Tenta primeiro com a chave atual, depois com a antiga (para rotação)
 * @param payload - Payload criptografado
 * @param key - Chave atual de criptografia
 * @returns PAN descriptografado
 * @throws Error se nenhuma chave conseguir descriptografar
 */
export function decryptPan(payload: PanCipherPayload, key: Buffer): string {
  // Tentar com a chave atual primeiro
  try {
    return decryptPanWithKey(payload, key);
  } catch (currentKeyError) {
    // Se falhou e temos uma chave antiga, tentar com ela
    const oldKey = loadOldVaultKey();
    if (oldKey) {
      try {
        const pan = decryptPanWithKey(payload, oldKey);
        logger.info({
          event: 'card_vault_decrypted_with_old_key',
        }, 'PAN decrypted with old key - consider re-encrypting');
        return pan;
      } catch (oldKeyError) {
        logger.error({
          event: 'card_vault_decrypt_failed_both_keys',
        }, 'Failed to decrypt PAN with both current and old keys');
        throw currentKeyError; // Lança o erro original
      }
    }

    // Sem chave antiga, propagar o erro
    throw currentKeyError;
  }
}

/**
 * Serializa o payload para armazenamento (JSON string)
 */
export function serializePanCipher(payload: PanCipherPayload): string {
  return JSON.stringify(payload);
}

/**
 * Parseia um payload serializado
 * @returns Payload ou null se inválido
 */
export function parsePanCipher(serialized: string | null): PanCipherPayload | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as PanCipherPayload;
    if (
      typeof parsed.cipher !== 'string' ||
      typeof parsed.iv !== 'string' ||
      typeof parsed.tag !== 'string'
    ) {
      logger.warn({
        event: 'card_vault_invalid_payload_structure',
      }, 'Invalid PAN cipher payload structure');
      return null;
    }
    return parsed;
  } catch (error) {
    logger.error({
      event: 'card_vault_parse_error',
      err: error instanceof Error ? { message: error.message, name: error.name } : error,
    }, 'Failed to parse PAN cipher payload');
    return null;
  }
}

/**
 * Recriptografa um payload com a nova chave
 * Útil durante rotação de chaves
 */
export function reencryptPan(
  payload: PanCipherPayload,
  currentKey: Buffer,
  newKey: Buffer
): PanCipherPayload {
  const pan = decryptPan(payload, currentKey);
  return encryptPan(pan, newKey);
}

// ============================================================================
// FINGERPRINT - Identificação única de cartão sem expor o PAN
// ============================================================================

const FINGERPRINT_DELIMITER = '-';

export type CardFingerprintParts = {
  bin: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

/**
 * Cria um fingerprint do cartão (BIN-LAST4-YEAR-MONTH)
 * Usado para identificar cartões sem expor o PAN completo
 */
export function makeFingerprint(pan: string, expMonth: number, expYear: number): string {
  const bin = pan.slice(0, 6);
  const last4 = pan.slice(-4);
  const month = String(expMonth).padStart(2, '0');
  return [bin, last4, String(expYear), month].join(FINGERPRINT_DELIMITER);
}

/**
 * Parseia um fingerprint para suas partes componentes
 * @throws Error se o fingerprint for inválido
 */
export function parseFingerprint(fingerprint: string): CardFingerprintParts {
  const segments = fingerprint.split(FINGERPRINT_DELIMITER);
  if (segments.length !== 4) {
    throw new Error('Fingerprint malformado');
  }

  const [bin, last4, expYear, expMonth] = segments;
  if (!/^\d{6}$/u.test(bin) || !/^\d{4}$/u.test(last4)) {
    throw new Error('Fingerprint inválido');
  }

  const month = Number(expMonth);
  const year = Number(expYear);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    throw new Error('Fingerprint inválido');
  }

  return {
    bin,
    last4,
    expMonth: month,
    expYear: year,
  };
}
