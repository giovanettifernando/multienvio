import { mkdir, writeFile } from 'fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateFileContent, SUPPORT_ALLOWED_EXTENSIONS } from './file-validation';

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
const SUPPORT_UPLOAD_DIR =
  process.env.SUPPORT_UPLOAD_DIR ?? path.join(process.cwd(), 'public', 'uploads', 'support');

function sanitizeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export interface PersistedSupportAttachment {
  storedFileName: string;
  originalName: string;
  publicUrl: string;
  size: number;
}

export async function ensureSupportUploadDir(ticketId: string): Promise<string> {
  const safeTicketId = sanitizeSegment(ticketId);
  const targetDir = path.join(SUPPORT_UPLOAD_DIR, safeTicketId);
  await mkdir(targetDir, { recursive: true });
  return targetDir;
}

export async function persistSupportAttachment(
  ticketId: string,
  file: File,
): Promise<PersistedSupportAttachment> {
  if (!(file instanceof File)) {
    throw new Error('Arquivo inválido.');
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error('Cada arquivo deve ter no máximo 10 MB.');
  }

  const ticketDir = await ensureSupportUploadDir(ticketId);
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // SECURITY: Validar conteúdo do arquivo por magic bytes
  const validation = validateFileContent(buffer, file.name, SUPPORT_ALLOWED_EXTENSIONS);
  if (!validation.valid) {
    throw new Error(validation.error || 'Tipo de arquivo não permitido');
  }

  const parsedName = path.parse(file.name || 'arquivo');
  const safeName = sanitizeSegment(parsedName.name) || 'arquivo';
  const safeExt = sanitizeSegment(parsedName.ext.replace('.', '')) || '';

  const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const storedFileName = safeExt
    ? `${uniqueId}-${safeName}.${safeExt}`
    : `${uniqueId}-${safeName}`;

  // Use template literal to avoid Turbopack overly broad file pattern analysis
  const filePath = `${ticketDir}${path.sep}${storedFileName}`;
  await writeFile(filePath, buffer);

  const safeTicketId = sanitizeSegment(ticketId);
  const publicUrl = `/uploads/support/${safeTicketId}/${storedFileName}`;

  return {
    storedFileName,
    originalName: file.name || storedFileName,
    publicUrl,
    size: buffer.length,
  };
}

export async function persistSupportAttachments(
  ticketId: string,
  files: File[],
): Promise<Array<{ name: string; url: string; size: number }>> {
  const persisted = await Promise.all(
    files.map(async (file) => persistSupportAttachment(ticketId, file)),
  );

  return persisted.map(({ originalName, publicUrl, size }) => ({
    name: originalName,
    url: publicUrl,
    size,
  }));
}
