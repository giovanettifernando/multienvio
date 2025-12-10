/**
 * API Route para verificação de e-mail de coletores
 * POST /api/coletores/auth/verify-email - Verifica o token de confirmação
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api/handler';
import { ApiError } from '@/lib/api/errors';
import { prisma } from '@/lib/db';
import { enforceRateLimitByIP, RATE_LIMITS } from '@/lib/rate-limit-redis';

const VerifyEmailSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

type CollectorVerifyEmailResponse = {
  message: string;
};

/**
 * POST /api/coletores/auth/verify-email
 * Verifica o token de email e ativa o coletor
 */
export const POST = withApiHandler<CollectorVerifyEmailResponse>(async (context) => {
  const { req, logger } = context;

  // Rate limiting by IP - 10 attempts per minute (public API preset)
  await enforceRateLimitByIP(req as NextRequest, 'collector_verify_email', RATE_LIMITS.PUBLIC_API);

  const body = await req.json();
  const parsed = VerifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { token } = parsed.data;

  // Find collector with this token
  const collector = await prisma.collector.findUnique({
    where: { pfEmailVerificationToken: token },
  });

  if (!collector) {
    logger.warn('collector_verify_email_not_found');
    throw new ApiError({
      code: 'TOKEN_NOT_FOUND',
      message: 'Token inválido ou expirado',
      status: 400,
    });
  }

  // Check if already verified
  if (collector.pfEmailVerified) {
    logger.info('collector_verify_email_already_verified', { collectorId: collector.id });
    return {
      data: {
        message: 'E-mail já verificado',
      },
    };
  }

  // Update collector: mark email as verified and change status to INACTIVE
  await prisma.collector.update({
    where: { id: collector.id },
    data: {
      pfEmailVerified: true,
      pfEmailVerifiedAt: new Date(),
      pfEmailVerificationToken: null, // Single-use: consume token
      status: 'INACTIVE', // Change from BLOCKED to INACTIVE
    },
  });

  logger.info('collector_verify_email_success', { collectorId: collector.id });

  return {
    data: {
      message: 'E-mail verificado com sucesso! Seu cadastro será analisado pela equipe.',
    },
  };
});
