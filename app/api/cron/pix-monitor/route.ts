/**
 * GET/POST /api/cron/pix-monitor
 *
 * Cron job para monitorar pagamentos PIX pendentes
 *
 * Funcionalidades:
 * - Verifica status de PIX pendentes no Mercado Pago
 * - Marca PIX expirados como cancelados
 * - Registra PIX não realizados na carteira do usuário
 * - Limpa PIX muito antigos
 *
 * Segurança:
 * - Aceita apenas requisições com header X-Cron-Secret válido
 * - Ou requisições do mesmo host (cron interno)
 *
 * Uso:
 * - Configure um cron job para chamar este endpoint a cada 2-5 minutos
 * - Ex: curl -X POST -H "X-Cron-Secret: $SECRET" https://seusite.com/api/cron/pix-monitor
 */

import { NextResponse } from 'next/server';
import {
  monitorPendingPixPayments,
  cleanupOldPendingPix,
  type PixMonitorResult,
} from '@/lib/mercadopago/pix-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 segundos de timeout

/**
 * Valida se a requisição é autorizada
 */
function isAuthorized(request: Request): boolean {
  // 1. Verificar secret do cron
  const cronSecret = process.env.CRON_SECRET;
  const requestSecret = request.headers.get('x-cron-secret');

  if (cronSecret && requestSecret === cronSecret) {
    return true;
  }

  // 2. Verificar se é Vercel Cron (header especial)
  const vercelCron = request.headers.get('x-vercel-cron');
  if (vercelCron === '1') {
    return true;
  }

  // 3. Em desenvolvimento, permitir sem autenticação
  if (process.env.NODE_ENV === 'development') {
    console.warn('[PIX_MONITOR_CRON] Permitindo acesso em desenvolvimento sem autenticação');
    return true;
  }

  return false;
}

interface CronResponse {
  success: boolean;
  message: string;
  timestamp: string;
  result?: PixMonitorResult;
  cleanup?: number;
  error?: string;
  duration?: number;
}

async function handleCronJob(request: Request): Promise<NextResponse<CronResponse>> {
  const startTime = Date.now();

  // Verificar autorização
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        success: false,
        message: 'Não autorizado',
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    );
  }

  console.log('[PIX_MONITOR_CRON] Iniciando execução...');

  try {
    // 1. Monitorar PIX pendentes
    const result = await monitorPendingPixPayments();

    // 2. Limpar PIX muito antigos (uma vez por execução)
    const cleanedUp = await cleanupOldPendingPix();

    const duration = Date.now() - startTime;

    console.log('[PIX_MONITOR_CRON] Execução concluída:', {
      duration: `${duration}ms`,
      processed: result.processed,
      approved: result.approved,
      expired: result.expired,
      cleanedUp,
    });

    return NextResponse.json({
      success: true,
      message: `Processados ${result.processed} pagamentos PIX`,
      timestamp: new Date().toISOString(),
      result,
      cleanup: cleanedUp,
      duration,
    });
  } catch (error) {
    console.error('[PIX_MONITOR_CRON] Erro na execução:', error);

    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao executar monitoramento',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// GET para facilitar testes manuais
export async function GET(request: Request) {
  return handleCronJob(request);
}

// POST para cron jobs
export async function POST(request: Request) {
  return handleCronJob(request);
}
