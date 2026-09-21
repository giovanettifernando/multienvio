/**
 * POST /api/tracking-codes/reserve
 *
 * Reserva um código de rastreamento único para uso futuro.
 * O código é garantidamente único - não existe nem na tabela de reservas
 * nem na tabela de shipments.
 *
 * O código expira em 24 horas se não for usado.
 */

import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import { z } from 'zod';

const MAX_RETRY_ATTEMPTS = 10;
const RESERVATION_EXPIRY_HOURS = 24;

interface ReserveTrackingCodeResponse {
  code: string;
  expiresAt: string;
}

/**
 * Gera um código de rastreamento no formato ME + timestamp + random
 * Formato: ME1734567890123ABCDE (ME de Multienvio + 13 dígitos timestamp + 5 chars random)
 */
function generateTrackingCode(): string {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `ME${timestamp}${random}`;
}

/**
 * Verifica se o código já existe na tabela de reservas ou shipments
 */
async function isCodeUnique(code: string): Promise<boolean> {
  // Verificar na tabela de reservas (códigos ainda não usados)
  const existingReservation = await prisma.trackingCodeReservation.findUnique({
    where: { code },
    select: { id: true },
  });

  if (existingReservation) {
    return false;
  }

  // Verificar na tabela de shipments (códigos já usados)
  const existingShipment = await prisma.shipment.findFirst({
    where: { platformTrackingCode: code },
    select: { id: true },
  });

  if (existingShipment) {
    return false;
  }

  return true;
}

/**
 * Gera um código único com retry em caso de colisão
 */
async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    const code = generateTrackingCode();
    const isUnique = await isCodeUnique(code);

    if (isUnique) {
      return code;
    }

    // Log de colisão (raro, mas queremos monitorar)
    console.warn(`[TRACKING_CODE] Colisão detectada, tentativa ${attempt + 1}:`, code);
  }

  // Se após todas as tentativas ainda houver colisão, algo está muito errado
  throw new Error('Não foi possível gerar um código único após múltiplas tentativas');
}

// Schema de validação para o body (opcional - pode receber quantidade)
const reserveSchema = z.object({
  count: z.number().int().min(1).max(100).optional().default(1),
}).optional();

/**
 * POST /api/tracking-codes/reserve
 *
 * Body opcional:
 * - count: número de códigos a reservar (1-100, default: 1)
 *
 * Response:
 * - code: código reservado (se count=1)
 * - codes: array de códigos reservados (se count>1)
 * - expiresAt: data de expiração
 */
export const POST = withApiHandler<ReserveTrackingCodeResponse | { codes: string[]; expiresAt: string }>(
  async (context) => {
    const { logger } = context;

    // Autenticação obrigatória
    const session = await getUserFromRequest(context.req);
    if (!session?.userId) {
      throw new ApiError({
        code: 'unauthorized',
        message: 'Não autorizado',
        status: 401,
      });
    }

    // Parse body (opcional)
    let count = 1;
    try {
      const body = await context.req.json().catch(() => ({}));
      const parsed = reserveSchema.parse(body);
      count = parsed?.count ?? 1;
    } catch {
      // Se não houver body ou for inválido, usa default
      count = 1;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + RESERVATION_EXPIRY_HOURS);

    logger.info('tracking_code_reserve_start', { count, userId: session.userId });

    // Reservar código(s)
    if (count === 1) {
      // Caso simples: um código
      const code = await generateUniqueCode();

      // Salvar reserva no banco
      await prisma.trackingCodeReservation.create({
        data: {
          code,
          userId: session.userId,
          expiresAt,
        },
      });

      logger.info('tracking_code_reserved', { code, expiresAt: expiresAt.toISOString() });

      return {
        data: {
          code,
          expiresAt: expiresAt.toISOString(),
        },
      };
    } else {
      // Caso múltiplo: vários códigos (para carrinho)
      const codes: string[] = [];

      for (let i = 0; i < count; i++) {
        const code = await generateUniqueCode();
        codes.push(code);
      }

      // Salvar todas as reservas em uma transação
      await prisma.$transaction(
        codes.map((code) =>
          prisma.trackingCodeReservation.create({
            data: {
              code,
              userId: session.userId,
              expiresAt,
            },
          })
        )
      );

      logger.info('tracking_codes_reserved', { count: codes.length, expiresAt: expiresAt.toISOString() });

      return {
        data: {
          codes,
          expiresAt: expiresAt.toISOString(),
        },
      };
    }
  }
);
