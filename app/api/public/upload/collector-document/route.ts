/**
 * POST /api/public/upload/collector-document
 *
 * Public endpoint for uploading collector documents during registration
 * Accepts multipart/form-data with a single file
 * Returns the public URL for the uploaded file
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { mkdir, writeFile } from 'fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';


const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
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
    { bytes: [0xFF, 0xD8, 0xFF] }, // JPEG SOI marker
  ],
  'image/png': [
    { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }, // PNG signature
  ],
  'image/webp': [
    { bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF header (WebP starts with RIFF)
  ],
  'image/gif': [
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] }, // GIF87a
    { bytes: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] }, // GIF89a
  ],
  'application/pdf': [
    { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  ],
};

/**
 * Valida os magic bytes do arquivo
 */
function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  const signatures = MAGIC_BYTES[claimedType];
  if (!signatures) {
    // Tipo não reconhecido - rejeitar por segurança
    return false;
  }

  return signatures.some((sig) => {
    const offset = sig.offset || 0;
    if (buffer.length < offset + sig.bytes.length) {
      return false;
    }
    return sig.bytes.every((byte, idx) => buffer[offset + idx] === byte);
  });

  // WebP tem validação adicional - verificar "WEBP" nos bytes 8-11
  if (claimedType === 'image/webp') {
    if (buffer.length < 12) return false;
    const webpSignature = [0x57, 0x45, 0x42, 0x50]; // "WEBP"
    const hasWebpSignature = webpSignature.every((byte, idx) => buffer[8 + idx] === byte);
    if (!hasWebpSignature) return false;
  }

  return true;
}

const UPLOAD_DIR = process.env.COLLECTOR_UPLOAD_DIR ??
  path.join(process.cwd(), 'public', 'uploads', 'collectors', 'temp');

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

interface CollectorDocumentUploadResponse {
  url: string;
  name: string;
  size: number;
  type: string;
}

export const POST = withApiHandler<CollectorDocumentUploadResponse>(async ({ req }) => {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const documentType = (formData.get('documentType') as string) || 'document';

  if (!file) {
    throw new ApiError({
      code: 'NO_FILE',
      message: 'Nenhum arquivo enviado',
      status: 400,
    });
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new ApiError({
      code: 'FILE_TOO_LARGE',
      message: 'Arquivo muito grande. Máximo permitido: 10MB',
      status: 400,
    });
  }

  // Validate MIME type (first check)
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new ApiError({
      code: 'INVALID_FILE_TYPE',
      message: `Tipo de arquivo não permitido. Use: ${ALLOWED_TYPES.join(', ')}`,
      status: 400,
    });
  }

  // Read file content - use arrayBuffer for broader compatibility
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // SECURITY: Validate magic bytes (don't trust MIME type from client)
  if (!validateMagicBytes(buffer, file.type)) {
    throw new ApiError({
      code: 'INVALID_FILE_CONTENT',
      message: 'Arquivo inválido ou corrompido. O tipo de arquivo não corresponde ao conteúdo.',
      status: 400,
    });
  }

  // Ensure upload directory exists
  await mkdir(UPLOAD_DIR, { recursive: true });

  // Generate unique filename
  const parsedName = path.parse(file.name || 'documento');
  const safeName = sanitizeSegment(parsedName.name) || 'documento';
  const safeExt = sanitizeSegment(parsedName.ext.replace('.', '')) || '';
  const safeDocType = sanitizeSegment(documentType);

  const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const storedFileName = safeExt
    ? `${uniqueId}-${safeDocType}-${safeName}.${safeExt}`
    : `${uniqueId}-${safeDocType}-${safeName}`;

  const filePath = path.join(UPLOAD_DIR, storedFileName);
  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/collectors/temp/${storedFileName}`;

  return {
    data: {
      url: publicUrl,
      name: file.name,
      size: buffer.length,
      type: file.type,
    },
  };
});
