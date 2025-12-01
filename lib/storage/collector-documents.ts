/**
 * Storage utility for collector documents (CNH, CRLV, Address Proof, etc.)
 * Based on support-attachments.ts pattern
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const COLLECTOR_UPLOAD_DIR =
  process.env.COLLECTOR_UPLOAD_DIR ?? path.join(process.cwd(), 'public', 'uploads', 'collectors');

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

/**
 * SECURITY: Magic bytes para validação de tipo de arquivo
 * Não confiar apenas no MIME type enviado pelo cliente
 */
const MAGIC_BYTES: Record<string, { bytes: number[]; offset?: number }[]> = {
  'image/jpeg': [
    { bytes: [0xFF, 0xD8, 0xFF] },
  ],
  'image/png': [
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] },
  ],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] },
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] },
  ],
  'application/pdf': [
    { bytes: [0x25, 0x50, 0x44, 0x46] },
  ],
};

/**
 * Valida os magic bytes do arquivo
 */
function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  const signatures = MAGIC_BYTES[claimedType];
  if (!signatures) {
    return false;
  }

  const matchFound = signatures.some((sig) => {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) {
      return false;
    }
    return sig.bytes.every((byte, idx) => buffer[offset + idx] === byte);
  });

  if (!matchFound) return false;

  // WebP tem validação adicional
  if (claimedType === 'image/webp') {
    if (buffer.length < 12) return false;
    const webpSignature = [0x57, 0x45, 0x42, 0x50];
    const hasWebpSignature = webpSignature.every((byte, idx) => buffer[8 + idx] === byte);
    if (!hasWebpSignature) return false;
  }

  return true;
}

/**
 * Sanitize a string to be safe for filesystem
 */
function sanitizeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export interface PersistedCollectorDocument {
  storageKey: string; // Unique file identifier
  originalName: string;
  publicUrl: string;
  size: number;
  mimeType: string;
}

/**
 * Ensure upload directory exists for a specific collector
 */
export async function ensureCollectorUploadDir(collectorId: string): Promise<string> {
  const safeCollectorId = sanitizeSegment(collectorId);
  const targetDir = path.join(COLLECTOR_UPLOAD_DIR, safeCollectorId);
  await mkdir(targetDir, { recursive: true });
  return targetDir;
}

/**
 * Persist a single collector document to filesystem
 * @param collectorId - Collector ID (used for directory organization)
 * @param file - File to upload
 * @param documentType - Type of document (cnh, crlv, pf_address_proof)
 * @returns Persisted document metadata
 */
export async function persistCollectorDocument(
  collectorId: string,
  file: File,
  documentType: string
): Promise<PersistedCollectorDocument> {
  if (!(file instanceof File)) {
    throw new Error('Arquivo inválido.');
  }

  if (file.size > MAX_DOCUMENT_SIZE) {
    throw new Error('Cada arquivo deve ter no máximo 10 MB.');
  }

  // SECURITY: Validar tipo de arquivo permitido
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Tipo de arquivo não permitido: ${file.type}. Tipos aceitos: imagens (JPEG, PNG, GIF, WebP) e PDF.`);
  }

  const collectorDir = await ensureCollectorUploadDir(collectorId);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // SECURITY: Validar magic bytes do arquivo
  if (!validateMagicBytes(buffer, file.type)) {
    throw new Error('Arquivo inválido ou corrompido. O tipo declarado não corresponde ao conteúdo.');
  }

  const parsedName = path.parse(file.name || 'documento');
  const safeName = sanitizeSegment(parsedName.name) || 'documento';
  const safeExt = sanitizeSegment(parsedName.ext.replace('.', '')) || '';
  const safeDocType = sanitizeSegment(documentType);

  // Format: {timestamp}-{uuid}-{docType}-{filename}.{ext}
  const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const storedFileName = safeExt
    ? `${uniqueId}-${safeDocType}-${safeName}.${safeExt}`
    : `${uniqueId}-${safeDocType}-${safeName}`;

  // Use template literal to avoid Turbopack overly broad file pattern analysis
  const filePath = `${collectorDir}${path.sep}${storedFileName}`;
  await writeFile(filePath, buffer);

  const safeCollectorId = sanitizeSegment(collectorId);
  const publicUrl = `/uploads/collectors/${safeCollectorId}/${storedFileName}`;

  return {
    storageKey: `${safeCollectorId}/${storedFileName}`,
    originalName: file.name || storedFileName,
    publicUrl,
    size: buffer.length,
    mimeType: file.type || 'application/octet-stream',
  };
}

/**
 * Persist multiple collector documents
 * @param collectorId - Collector ID
 * @param documents - Array of files with their types
 * @returns Array of persisted documents
 */
export async function persistCollectorDocuments(
  collectorId: string,
  documents: Array<{ file: File; type: string }>
): Promise<PersistedCollectorDocument[]> {
  const persisted = await Promise.all(
    documents.map(async ({ file, type }) => persistCollectorDocument(collectorId, file, type))
  );

  return persisted;
}
