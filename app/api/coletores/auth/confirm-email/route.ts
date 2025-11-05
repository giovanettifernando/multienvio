/**
 * API Route para confirmação de e-mail de coletores via GET
 * GET /api/coletores/auth/confirm-email?token=... - Confirma o e-mail e redireciona
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/coletores/auth/confirm-email?token=...
 * Confirma o token de email e atualiza o coletor
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token || typeof token !== 'string') {
      console.warn('[confirm-email] TOKEN_INVALID: Token missing or invalid type');
      return NextResponse.redirect(
        new URL('/coletores/verificar-email?error=token_invalid', request.url)
      );
    }

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
        console.warn('[confirm-email] TOKEN_NOT_FOUND: No collector found with token:', token.substring(0, 8) + '...');
        return { status: 'TOKEN_NOT_FOUND' };
      }

      // Check if already verified (token consumed)
      if (collector.pfEmailVerified) {
        console.info('[confirm-email] TOKEN_USED: Collector', collector.id, 'already verified at', collector.pfEmailVerifiedAt);
        return { status: 'TOKEN_USED', collectorId: collector.id };
      }

      // Check token expiration (7 days from collector creation)
      const tokenAge = Date.now() - collector.createdAt.getTime();
      const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

      if (tokenAge > sevenDaysInMs) {
        console.warn('[confirm-email] TOKEN_EXPIRED: Token created', Math.floor(tokenAge / (24 * 60 * 60 * 1000)), 'days ago for collector', collector.id);
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

      console.info('[confirm-email] PF_EMAIL_VERIFIED_OK: Collector', collector.id, '(', collector.pfNome, ') verified successfully. Status: BLOCKED → INACTIVE');

      return { status: 'SUCCESS', collectorId: collector.id, name: collector.pfNome };
    });

    // Handle different statuses
    switch (result.status) {
      case 'TOKEN_NOT_FOUND':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?error=token_not_found', request.url)
        );

      case 'TOKEN_USED':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?success=already_verified', request.url)
        );

      case 'TOKEN_EXPIRED':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?error=token_expired', request.url)
        );

      case 'SUCCESS':
        return NextResponse.redirect(
          new URL('/coletores/verificar-email?success=verified', request.url)
        );

      default:
        throw new Error('Unknown status');
    }

  } catch (error) {
    console.error('[confirm-email] Error:', error);

    return NextResponse.redirect(
      new URL('/coletores/verificar-email?error=server_error', request.url)
    );
  }
}
