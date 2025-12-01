/**
 * API Route para verificação de e-mail de coletores
 * POST /api/coletores/auth/verify-email - Verifica o token de confirmação
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/coletores/auth/verify-email
 * Verifica o token de email e ativa o coletor
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      console.warn('[verify-email] TOKEN_INVALID: Token missing or invalid type');
      return NextResponse.json(
        { message: 'Token inválido' },
        { status: 400 }
      );
    }

    // Find collector with this token
    const collector = await prisma.collector.findUnique({
      where: { pfEmailVerificationToken: token },
    });

    if (!collector) {
      console.warn('[verify-email] TOKEN_NOT_FOUND: No collector found with token:', token.substring(0, 8) + '...');
      return NextResponse.json(
        { message: 'Token inválido ou expirado' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (collector.pfEmailVerified) {
      console.info('[verify-email] TOKEN_ALREADY_USED: Collector', collector.id, 'already verified at', collector.pfEmailVerifiedAt);
      return NextResponse.json(
        { message: 'E-mail já verificado' },
        { status: 200 }
      );
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

    console.info('[verify-email] PF_EMAIL_VERIFIED_OK: Collector', collector.id, 'verified successfully. Status: BLOCKED → INACTIVE');

    return NextResponse.json(
      {
        message: 'E-mail verificado com sucesso! Seu cadastro será analisado pela equipe.',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[verify-email] Error:', error);
    // 🛡️ SECURITY FIX: Não expor mensagens de erro internas
    return NextResponse.json(
      { message: 'Erro ao verificar e-mail' },
      { status: 500 }
    );
  }
}
