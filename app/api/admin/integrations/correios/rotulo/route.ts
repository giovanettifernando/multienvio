/**
 * POST /api/admin/integrations/correios/rotulo
 *
 * Baixa o rótulo (etiqueta) PDF de uma pré-postagem
 * Aceita tanto o ID da pré-postagem quanto o código de rastreio
 *
 * NOTE: This route returns binary PDF data, so it uses withApiHandlerResponse
 * which allows returning NextResponse directly instead of JSON format.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
import { withApiHandlerResponse } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import {
  baixarRotuloPdf,
  buscarPrePostagemPorRastreio,
  getCorreiosConfigAsync,
  validateCorreiosConfig,
} from '@/lib/integrations/correios';

const rotuloSchema = z.object({
  // Aceita código de rastreio (ex: AN312817735BR) ou ID da pré-postagem (ex: PRNnhoiSb6SSKvvVJA13MiOA)
  codigo: z.string().min(1, 'Código de rastreio ou ID da pré-postagem é obrigatório'),
});

// Regex para identificar código de rastreio dos Correios (ex: AN312817735BR)
const TRACKING_CODE_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

/**
 * Verifica se é um código de rastreio (vs ID de pré-postagem)
 */
function isTrackingCode(codigo: string): boolean {
  return TRACKING_CODE_REGEX.test(codigo.toUpperCase());
}

/**
 * POST - Baixa o rótulo PDF de uma pré-postagem
 * Aceita código de rastreio ou ID da pré-postagem
 */
export const POST = withApiHandlerResponse(async ({ req, logger }) => {
  const authResult = await requireAdminUser(req, AdminPermission.INTEGRACOES);
  if (authResult instanceof NextResponse) {
    throw new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Não autorizado',
      status: 401,
    });
  }

  // Validar payload
  const body = await req.json();
  const parsed = rotuloSchema.safeParse(body);

  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  let { codigo } = parsed.data;
  codigo = codigo.trim().toUpperCase();

  // Verificar se integração está configurada
  const config = await getCorreiosConfigAsync();
  const validation = validateCorreiosConfig(config);

  if (!validation.valid) {
    throw new ApiError({
      code: 'NOT_CONFIGURED',
      message: 'Integração dos Correios não está configurada',
      status: 400,
    });
  }

  let idPrePostagem = codigo;

  // Se for código de rastreio, buscar o ID da pré-postagem
  if (isTrackingCode(codigo)) {
    logger.info('correios_rotulo_search_by_tracking', { codigo });

    const searchResult = await buscarPrePostagemPorRastreio(codigo);

    if (!searchResult.success || !searchResult.idPrePostagem) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: searchResult.erro || `Pré-postagem não encontrada para o código ${codigo}`,
        status: 404,
        details: {
          type: 'search_failed',
          codigoRastreio: codigo,
          searchResult,
        },
      });
    }

    idPrePostagem = searchResult.idPrePostagem;
    logger.info('correios_rotulo_found_prepostagem', {
      codigoRastreio: codigo,
      idPrePostagem,
    });
  }

  logger.info('correios_rotulo_downloading', { idPrePostagem });

  // Baixar o PDF
  const result = await baixarRotuloPdf(idPrePostagem);

  if (!result.success || !result.content) {
    throw new ApiError({
      code: 'DOWNLOAD_FAILED',
      message: result.erro || 'Falha ao baixar rótulo',
      status: 500,
      details: {
        type: 'download_failed',
        idPrePostagem,
        result,
      },
    });
  }

  logger.info('correios_rotulo_downloaded', {
    idPrePostagem,
    fileName: result.fileName,
    contentLength: result.content.length,
  });

  // Retornar o PDF como download
  // Converter Buffer para Uint8Array para compatibilidade com NextResponse
  const pdfData = new Uint8Array(result.content);

  return new NextResponse(pdfData, {
    status: 200,
    headers: {
      'Content-Type': result.contentType || 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.fileName || 'rotulo.pdf'}"`,
      'Content-Length': String(result.content.length),
    },
  });
});
