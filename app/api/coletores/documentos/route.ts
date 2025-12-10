/**
 * API Route para upload e persistência de documentos de coletores autônomos
 * POST /api/coletores/documentos - Salva documentos (CNH, CRLV, comprovante de endereço PF)
 *
 * Modes:
 * 1. Multipart upload: Client sends files + metadata via FormData
 * 2. JSON mode: Client already uploaded files and sends metadata with URLs
 */

import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getCollectorId } from '@/lib/auth/autonomous-collector-session';
import { persistCollectorDocument } from '@/lib/storage/collector-documents';

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

type DocumentosSavedResponse = {
  message: string;
  documents: Array<{
    id: string;
    collectorId: string;
    type: string;
    filename: string;
    url: string | null;
    storageKey: string | null;
    mimeType: string | null;
    size: number | null;
    issuedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

/**
 * POST /api/coletores/documentos
 * Handles both multipart and JSON modes
 */
export const POST = withApiHandler<DocumentosSavedResponse>(async (context) => {
  const { req, logger } = context;

  // 1. Get collectorId from session (NEVER from client)
  let collectorId: string;
  try {
    collectorId = await getCollectorId();
  } catch {
    logger.warn('collector_documents_unauthorized');
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Sessão expirada. Faça login novamente.',
      status: 401,
    });
  }

  logger.debug('collector_documents_request', { collectorId });

  const contentType = req.headers.get('content-type') || '';

  // MODE 1: Multipart upload
  if (contentType.includes('multipart/form-data')) {
    return await handleMultipartUpload(req, collectorId, logger);
  }

  // MODE 2: JSON with pre-uploaded files
  if (contentType.includes('application/json')) {
    return await handleJsonUpload(req, collectorId, logger);
  }

  throw new ApiError({
    code: 'INVALID_CONTENT_TYPE',
    message: 'Content-Type deve ser multipart/form-data ou application/json',
    status: 400,
  });
});

/**
 * Handle multipart form data upload
 */
async function handleMultipartUpload(
  request: Request,
  collectorId: string,
  logger: { info: (event: string, data?: Record<string, unknown>) => void; debug: (event: string, data?: Record<string, unknown>) => void; error: (event: string, data?: Record<string, unknown>) => void }
) {
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
    throw new ApiError({
      code: 'NO_FILES',
      message: 'Nenhum arquivo foi enviado',
      status: 400,
    });
  }

  logger.info('collector_documents_multipart', { collectorId, fileCount: documentsToUpload.length });

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
      logger.error('collector_documents_upload_error', { type, err: uploadError });
      throw new ApiError({
        code: 'UPLOAD_ERROR',
        message: uploadError instanceof Error ? uploadError.message : 'Erro ao fazer upload do arquivo',
        status: 400,
      });
    }
  }

  // Persist to database with upsert
  const savedDocuments = await upsertDocuments(collectorId, uploadedDocs, logger);

  logger.info('collector_documents_saved', { collectorId, count: savedDocuments.length });

  return {
    data: {
      message: 'Documentos salvos com sucesso',
      documents: savedDocuments,
    },
  };
}

/**
 * Handle JSON payload (files already uploaded)
 */
async function handleJsonUpload(
  request: Request,
  collectorId: string,
  logger: { info: (event: string, data?: Record<string, unknown>) => void; debug: (event: string, data?: Record<string, unknown>) => void; error: (event: string, data?: Record<string, unknown>) => void }
) {
  const body = await request.json();

  // Validate payload
  const validation = documentsPayloadSchema.safeParse(body);
  if (!validation.success) {
    logger.debug('collector_documents_validation_error', { errors: validation.error.flatten() });
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: { errors: validation.error.issues },
    });
  }

  const { documents } = validation.data;

  logger.info('collector_documents_json', { collectorId, count: documents.length });

  // Ensure each document has either url or storageKey
  for (const doc of documents) {
    if (!doc.url && !doc.storageKey) {
      throw new ApiError({
        code: 'MISSING_URL',
        message: `Documento ${doc.type} precisa ter url ou storageKey`,
        status: 400,
      });
    }
  }

  // Persist to database with upsert
  const savedDocuments = await upsertDocuments(collectorId, documents, logger);

  logger.info('collector_documents_json_saved', { collectorId, count: savedDocuments.length });

  return {
    data: {
      message: 'Documentos salvos com sucesso',
      documents: savedDocuments,
    },
  };
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
  }>,
  logger: { debug: (event: string, data?: Record<string, unknown>) => void; error: (event: string, data?: Record<string, unknown>) => void }
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
      logger.debug('collector_document_upserted', { type: doc.type, documentId: savedDoc.id });
    } catch (dbError) {
      logger.error('collector_document_db_error', { type: doc.type, err: dbError });
      throw new Error(`Erro ao salvar documento ${doc.type}`);
    }
  }

  return savedDocuments;
}
