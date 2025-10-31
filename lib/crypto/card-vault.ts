import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export type PanCipherPayload = {
  cipher: string;
  iv: string;
  tag: string;
};

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

export function loadVaultKey(): Buffer | null {
  const raw = process.env.CARD_VAULT_KEY;
  if (!raw) {
    return null;
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length !== 32) {
      return null;
    }
    return decoded;
  } catch (error) {
    console.error("[card-vault] Failed to decode CARD_VAULT_KEY:", error);
    return null;
  }
}

export function encryptPan(pan: string, key: Buffer): PanCipherPayload {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(pan, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    cipher: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptPan(payload: PanCipherPayload, key: Buffer): string {
  const iv = Buffer.from(payload.iv, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const pan = Buffer.concat([
    decipher.update(Buffer.from(payload.cipher, "base64")),
    decipher.final(),
  ]).toString("utf8");
  return pan;
}

export function serializePanCipher(payload: PanCipherPayload): string {
  return JSON.stringify(payload);
}

export function parsePanCipher(serialized: string | null): PanCipherPayload | null {
  if (!serialized) return null;
  try {
    const parsed = JSON.parse(serialized) as PanCipherPayload;
    if (typeof parsed.cipher !== "string" || typeof parsed.iv !== "string" || typeof parsed.tag !== "string") {
      return null;
    }
    return parsed;
  } catch (error) {
    console.error("[card-vault] Failed to parse panCipher payload:", error);
    return null;
  }
}

const FINGERPRINT_DELIMITER = "-";

export type CardFingerprintParts = {
  bin: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export function makeFingerprint(pan: string, expMonth: number, expYear: number): string {
  const bin = pan.slice(0, 6);
  const last4 = pan.slice(-4);
  const month = String(expMonth).padStart(2, "0");
  return [bin, last4, String(expYear), month].join(FINGERPRINT_DELIMITER);
}

export function parseFingerprint(fingerprint: string): CardFingerprintParts {
  const segments = fingerprint.split(FINGERPRINT_DELIMITER);
  if (segments.length !== 4) {
    throw new Error("Fingerprint malformado");
  }

  const [bin, last4, expYear, expMonth] = segments;
  if (!/^\d{6}$/u.test(bin) || !/^\d{4}$/u.test(last4)) {
    throw new Error("Fingerprint inválido");
  }

  const month = Number(expMonth);
  const year = Number(expYear);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    throw new Error("Fingerprint inválido");
  }

  return {
    bin,
    last4,
    expMonth: month,
    expYear: year,
  };
}
