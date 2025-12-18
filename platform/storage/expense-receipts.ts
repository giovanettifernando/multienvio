import { mkdir, writeFile, unlink } from 'fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_RECEIPT_SIZE = 10 * 1024 * 1024; // 10 MB
const EXPENSE_UPLOAD_DIR =
  process.env.EXPENSE_UPLOAD_DIR ?? path.join(process.cwd(), 'public', 'uploads', 'expenses');

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

function sanitizeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export interface PersistedExpenseReceipt {
  storedFileName: string;
  originalName: string;
  publicUrl: string;
  size: number;
}

export async function ensureExpenseUploadDir(): Promise<string> {
  await mkdir(EXPENSE_UPLOAD_DIR, { recursive: true });
  return EXPENSE_UPLOAD_DIR;
}

export async function persistExpenseReceipt(
  file: File,
): Promise<PersistedExpenseReceipt> {
  if (!(file instanceof File)) {
    throw new Error('Arquivo inválido.');
  }

  if (file.size > MAX_RECEIPT_SIZE) {
    throw new Error('O arquivo deve ter no máximo 10 MB.');
  }

  const parsedName = path.parse(file.name || 'comprovante');
  const ext = parsedName.ext.replace('.', '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(`Extensão não permitida. Use: ${ALLOWED_EXTENSIONS.join(', ')}`);
  }

  const uploadDir = await ensureExpenseUploadDir();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeName = sanitizeSegment(parsedName.name) || 'comprovante';
  const safeExt = sanitizeSegment(ext);

  const uniqueId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const storedFileName = `${uniqueId}-${safeName}.${safeExt}`;

  const filePath = `${uploadDir}${path.sep}${storedFileName}`;
  await writeFile(filePath, buffer);

  const publicUrl = `/uploads/expenses/${storedFileName}`;

  return {
    storedFileName,
    originalName: file.name || storedFileName,
    publicUrl,
    size: buffer.length,
  };
}

export async function deleteExpenseReceipt(publicUrl: string): Promise<void> {
  if (!publicUrl || !publicUrl.startsWith('/uploads/expenses/')) {
    return;
  }

  const fileName = publicUrl.replace('/uploads/expenses/', '');
  const filePath = path.join(EXPENSE_UPLOAD_DIR, fileName);

  try {
    await unlink(filePath);
  } catch {
    // Ignore errors if file doesn't exist
  }
}
