/**
 * API Route para confirmação de e-mail de coletores via GET
 * GET /api/coletores/auth/confirm-email?token=... - Confirma o e-mail e redireciona
 */

import { NextResponse } from 'next/server';
import { withApiHandlerResponse } from '@/platform/api/handler';
import { prisma } from '@/platform/db/db';

/**
 * GET /api/coletores/auth/confirm-email?token=...
 * Confirma o token de email e atualiza o coletor
 */
export const GET = withApiHandlerResponse(async (context) => {
  const { req, logger } = context;

  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token || typeof token !== 'string') {
    logger.warn('collector_confirm_email_invalid_token');
    return NextResponse.redirect(
      new URL('/coletores/verificar-email?error=token_invalid', req.url)
    );
  }

  try {
    // Find collector with this token in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Lookup token
      const collector = await tx.collector.findUnique({
        where: { pfEmailVerificationToken: token },
        select: {
          id: true,
          pfNome: true,
          pfEmail: true,
          pfEmailVerified: true,
          pfEmailVerifiedAt: true,
          pfEmailVerificationToken: true,
          status: true,
          createdAt: true,
        },
      });

      if (!collector) {
        logger.warn('collector_confirm_email_not_found');
        return { status: 'TOKEN_NOT_FOUND' };
      }

      // Check if already verified (token consumed)
      if (collector.pfEmailVerified) {
        logger.info('collector_confirm_email_already_verified', { collectorId: collector.id });
        return { status: 'TOKEN_USED', collectorId: collector.id };
      }

      // Check token expiration (7 days from collector creation)
      const tokenAge = Date.now() - collector.createdAt.getTime();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

      if (tokenAge > sevenDaysInMs) {
        logger.warn('collector_confirm_email_expired', { collectorId: collector.id, tokenAgeDays: Math.floor(tokenAge / (24 * 60 * 60 * 1000)) });
        return { status: 'TOKEN_EXPIRED', collectorId: collector.id };
      }

      // Update collector: mark email as verified and change status to INACTIVE
      await tx.collector.update({
        where: { id: collector.id },
        data: {
          pfEmailVerified: true,
          pfEmailVerifiedAt: new Date(),
          pfEmailVerificationToken: null, // Single-use: consume token
          status: 'INACTIVE', // Change from BLOCKED to INACTIVE
        },
      });

      logger.info('collector_confirm_email_success', { collectorId: collector.id, pfNome: collector.pfNome });

      return { status: 'SUCCESS', collectorId: collector.id, name: collector.pfNome };
    });

    // Handle different statuses
    switch (result.status) {
      case 'TOKEN_NOT_FOUND':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?error=token_not_found', req.url)
        );

      case 'TOKEN_USED':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?success=already_verified', req.url)
        );

      case 'TOKEN_EXPIRED':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?error=token_expired', req.url)
        );

      case 'SUCCESS':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?success=verified', req.url)
        );

      default:
        throw new Error('Unknown status');
    }
  } catch (error) {
    logger.error('collector_confirm_email_error', { err: error });

    return NextResponse.redirect(
      new URL('/coletores/verificar-email?error=server_error', req.url)
    );
  }
});
