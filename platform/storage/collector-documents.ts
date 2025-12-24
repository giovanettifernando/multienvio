/**
 * Storage utility for collector documents (CNH, CRLV, Address Proof, etc.)
 * Based on support-attachments.ts pattern
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateFileContent, COLLECTOR_DOC_EXTENSIONS } from './file-validation';

const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const COLLECTOR_UPLOAD_DIR =
  process.env.COLLECTOR_UPLOAD_DIR ?? path.join(process.cwd(), 'public', 'uploads', 'collectors');

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

  const collectorDir = await ensureCollectorUploadDir(collectorId);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // SECURITY: Validar conteúdo do arquivo por magic bytes
  const validation = validateFileContent(buffer, file.name, COLLECTOR_DOC_EXTENSIONS);
  if (!validation.valid) {
    throw new Error(validation.error || 'Tipo de arquivo não permitido');
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
