/**
 * POST /api/public/upload/collector-document
 *
 * Public endpoint for uploading collector documents during registration
 * Accepts multipart/form-data with a single file
 * Returns the public URL for the uploaded file
 */

import { NextRequest } from 'next/server';
import { mkdir, writeFile } from 'fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = (formData.get('documentType') as string) || 'document';

    if (!file) {
      return Response.json(
        { message: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { message: 'Arquivo muito grande. Máximo permitido: 10MB' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { message: `Tipo de arquivo não permitido. Use: ${ALLOWED_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Read file content - use arrayBuffer for broader compatibility
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    return Response.json({
      url: publicUrl,
      name: file.name,
      size: buffer.length,
      type: file.type,
    });

  } catch (error) {
    console.error('[Upload API] Error:', error);
    return Response.json(
      { message: 'Erro ao fazer upload do arquivo' },
      { status: 500 }
    );
  }
}
