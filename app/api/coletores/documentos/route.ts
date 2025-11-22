/**
 * API Route para upload e persistência de documentos de coletores autônomos
 * POST /api/coletores/documentos - Salva documentos (CNH, CRLV, comprovante de endereço PF)
 *
 * Modes:
 * 1. Multipart upload: Client sends files + metadata via FormData
 * 2. JSON mode: Client already uploaded files and sends metadata with URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCollectorId } from '@/lib/auth/autonomous-collector-session';
import { persistCollectorDocument } from '@/lib/storage/collector-documents';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Validation schema for document metadata
const documentMetadataSchema = z.object({
  type: z.enum(['cnh', 'crlv', 'pf_address_proof']),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  filename: z.string(),
  mimeType: z.string().optional(),
  size: z.number().int().positive().optional(),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});

const documentsPayloadSchema = z.object({
  documents: z.array(documentMetadataSchema).min(1, 'Pelo menos um documento é obrigatório'),
});

type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

/**
 * POST /api/coletores/documentos
 * Handles both multipart and JSON modes
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Get collectorId from session (NEVER from client)
    let collectorId: string;
    try {
      collectorId = await getCollectorId();
    } catch {
      console.warn('[documentos] UNAUTHORIZED: No valid session');
      return NextResponse.json(
        {
          code: 'UNAUTHORIZED',
          message: 'Sessão expirada. Faça login novamente.',
        },
        { status: 401 }
      );
    }

    console.info('[documentos] REQUEST: CollectorId', collectorId);

    const contentType = request.headers.get('content-type') || '';

    // MODE 1: Multipart upload
    if (contentType.includes('multipart/form-data')) {
      return await handleMultipartUpload(request, collectorId);
    }

    // MODE 2: JSON with pre-uploaded files
    if (contentType.includes('application/json')) {
      return await handleJsonUpload(request, collectorId);
    }

    return NextResponse.json(
      {
        code: 'INVALID_CONTENT_TYPE',
        message: 'Content-Type deve ser multipart/form-data ou application/json',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('[documentos] SERVER_ERROR:', error);
    return NextResponse.json(
      {
        code: 'SERVER_ERROR',
        message: 'Erro ao processar documentos. Tente novamente mais tarde.',
      },
      { status: 500 }
    );
  }
}

/**
 * Handle multipart form data upload
 */
async function handleMultipartUpload(request: NextRequest, collectorId: string) {
  try {
    const formData = await request.formData();
    const documentsToUpload: Array<{ file: File; type: string; metadata?: Partial<DocumentMetadata> }> = [];

    // Extract files and metadata from FormData
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) {
        // Extract type from key (e.g., "cnh_file", "crlv_file")
        const typeMatch = key.match(/^(cnh|crlv|pf_address_proof)_file$/);
        if (typeMatch) {
          const type = typeMatch[1];

          // Get optional metadata from separate fields
          const issuedAt = formData.get(`${type}_issuedAt`);
          const expiresAt = formData.get(`${type}_expiresAt`);

          documentsToUpload.push({
            file: value,
            type,
            metadata: {
              issuedAt: issuedAt ? new Date(issuedAt as string).toISOString() : undefined,
              expiresAt: expiresAt ? new Date(expiresAt as string).toISOString() : undefined,
            },
          });
        }
      }
    }

    if (documentsToUpload.length === 0) {
      return NextResponse.json(
        {
          code: 'NO_FILES',
          message: 'Nenhum arquivo foi enviado',
        },
        { status: 400 }
      );
    }

    console.info('[documentos] MULTIPART: Uploading', documentsToUpload.length, 'files for collector', collectorId);

    // Upload files to storage
    const uploadedDocs = [];
    for (const { file, type, metadata } of documentsToUpload) {
      try {
        const persisted = await persistCollectorDocument(collectorId, file, type);
        uploadedDocs.push({
          type,
          ...persisted,
          ...metadata,
        });
      } catch (uploadError) {
        console.error('[documentos] UPLOAD_ERROR:', type, uploadError);
        return NextResponse.json(
          {
            code: 'UPLOAD_ERROR',
            message: uploadError instanceof Error ? uploadError.message : 'Erro ao fazer upload do arquivo',
          },
          { status: 400 }
        );
      }
    }

    // Persist to database with upsert
    const savedDocuments = await upsertDocuments(collectorId, uploadedDocs);

    console.info('[documentos] SUCCESS: Saved', savedDocuments.length, 'documents for collector', collectorId);

    return NextResponse.json(
      {
        message: 'Documentos salvos com sucesso',
        documents: savedDocuments,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[documentos] MULTIPART_ERROR:', error);
    throw error;
  }
}

/**
 * Handle JSON payload (files already uploaded)
 */
async function handleJsonUpload(request: NextRequest, collectorId: string) {
  try {
    const body = await request.json();

    // Validate payload
    const validation = documentsPayloadSchema.safeParse(body);
    if (!validation.success) {
      console.warn('[documentos] VALIDATION_ERROR:', validation.error);
      return NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          errors: validation.error.issues,
        },
        { status: 400 }
      );
    }

    const { documents } = validation.data;

    console.info('[documentos] JSON: Processing', documents.length, 'documents for collector', collectorId);

    // Ensure each document has either url or storageKey
    for (const doc of documents) {
      if (!doc.url && !doc.storageKey) {
        return NextResponse.json(
          {
            code: 'MISSING_URL',
            message: `Documento ${doc.type} precisa ter url ou storageKey`,
          },
          { status: 400 }
        );
      }
    }

    // Persist to database with upsert
    const savedDocuments = await upsertDocuments(collectorId, documents);

    console.info('[documentos] SUCCESS: Saved', savedDocuments.length, 'documents for collector', collectorId);

    return NextResponse.json(
      {
        message: 'Documentos salvos com sucesso',
        documents: savedDocuments,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[documentos] JSON_ERROR:', error);
    throw error;
  }
}

/**
 * Upsert documents in database
 * If document already exists for (collectorId, type), update it
 * Otherwise, create new document
 */
async function upsertDocuments(
  collectorId: string,
  documents: Array<{
    type: string;
    filename?: string;
    url?: string;
    storageKey?: string;
    mimeType?: string;
    size?: number;
    issuedAt?: string;
    expiresAt?: string;
    originalName?: string;
    publicUrl?: string;
  }>
) {
  const savedDocuments = [];

  for (const doc of documents) {
    try {
      const documentData = {
        type: doc.type,
        filename: doc.filename || doc.originalName || 'documento',
        url: doc.url || doc.publicUrl || null,
        storageKey: doc.storageKey || null,
        mimeType: doc.mimeType || null,
        size: doc.size || null,
        issuedAt: doc.issuedAt ? new Date(doc.issuedAt) : null,
        expiresAt: doc.expiresAt ? new Date(doc.expiresAt) : null,
        updatedAt: new Date(),
      };

      // Upsert by (collectorId, type) unique constraint
      const savedDoc = await prisma.collectorDocument.upsert({
        where: {
          collectorId_type: {
            collectorId,
            type: doc.type,
          },
        },
        create: {
          collectorId,
          ...documentData,
        },
        update: documentData,
      });

      savedDocuments.push(savedDoc);
      console.info('[documentos] UPSERT: Document', doc.type, 'saved with ID', savedDoc.id);
    } catch (dbError) {
      console.error('[documentos] DB_ERROR:', doc.type, dbError);
      throw new Error(`Erro ao salvar documento ${doc.type}`);
    }
  }

  return savedDocuments;
}
