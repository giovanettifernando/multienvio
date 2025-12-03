/**
 * POST /api/admin/integrations/correios/rotulo
 *
 * Baixa o rótulo (etiqueta) PDF de uma pré-postagem
 * Aceita tanto o ID da pré-postagem quanto o código de rastreio
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';
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
export async function POST(request: Request) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.INTEGRACOES);
    if (authResult instanceof NextResponse) return authResult;

    // Validar payload
    const body = await request.json();
    const parsed = rotuloSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Dados inválidos',
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    let { codigo } = parsed.data;
    codigo = codigo.trim().toUpperCase();

    // Verificar se integração está configurada
    const config = await getCorreiosConfigAsync();
    const validation = validateCorreiosConfig(config);

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: 'Integração dos Correios não está configurada',
        },
        { status: 400 }
      );
    }

    let idPrePostagem = codigo;

    // Se for código de rastreio, buscar o ID da pré-postagem
    if (isTrackingCode(codigo)) {
      console.log('[ADMIN_CORREIOS_ROTULO] Searching pre-postagem by tracking code:', { codigo });

      const searchResult = await buscarPrePostagemPorRastreio(codigo);

      if (!searchResult.success || !searchResult.idPrePostagem) {
        return NextResponse.json(
          {
            success: false,
            message: searchResult.erro || `Pré-postagem não encontrada para o código ${codigo}`,
            type: 'search_failed',
            details: {
              codigoRastreio: codigo,
              searchResult,
            },
          },
          { status: 404 }
        );
      }

      idPrePostagem = searchResult.idPrePostagem;
      console.log('[ADMIN_CORREIOS_ROTULO] Found pre-postagem ID:', {
        codigoRastreio: codigo,
        idPrePostagem
      });
    }

    console.log('[ADMIN_CORREIOS_ROTULO] Downloading label:', { idPrePostagem });

    // Baixar o PDF
    const result = await baixarRotuloPdf(idPrePostagem);

    if (!result.success || !result.content) {
      return NextResponse.json(
        {
          success: false,
          message: result.erro || 'Falha ao baixar rótulo',
          type: 'download_failed',
          details: {
            idPrePostagem,
            result,
          },
        },
        { status: 500 }
      );
    }

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
  } catch (error) {
    console.error('[ADMIN_CORREIOS_ROTULO]', error);
    const message = error instanceof Error ? error.message : 'Erro ao baixar rótulo';
    return NextResponse.json({
      success: false,
      message,
      type: 'exception',
    }, { status: 500 });
  }
}
