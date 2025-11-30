/**
 * API Route para verificar sessão de coletor autônomo
 * GET /api/coletores/auth/me - Retorna dados do coletor autenticado
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/db';

// Validar JWT_SECRET em produção
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error(
    '🚨 SECURITY ERROR: JWT_SECRET environment variable is required in production. ' +
    'Please set a secure random secret to prevent token forgery.'
  );
}

// JWT Secret - Nunca usar fallbacks em produção
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/**
 * GET /api/coletores/auth/me
 * Verifica autenticação e retorna dados do coletor
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('coletor-token');

    if (!token) {
      return NextResponse.json(
        { message: 'Não autenticado' },
        { status: 401 }
      );
    }

    // Verify JWT token
    const { payload } = await jwtVerify(token.value, JWT_SECRET);

    // Get fresh data from database
    const collector = await prisma.collector.findUnique({
      where: {
        id: payload.coletorId as string,
      },
    });

    if (!collector) {
      return NextResponse.json(
        { message: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    // Check if still active
    if (collector.status !== 'ACTIVE') {
      return NextResponse.json(
        { message: 'Cadastro não está ativo' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      coletor: {
        id: collector.id,
        status: collector.status.toLowerCase(),
        pfNome: collector.pfNome,
        pfEmail: collector.pfEmail,
        pfCelular: collector.pfCelular,
        pjRazaoSocial: collector.pjRazaoSocial,
        pjCnpj: collector.pjCnpj,
      },
    });
  } catch (error) {
    console.error('[GET /api/coletores/auth/me] Error:', error);
    return NextResponse.json(
      { message: 'Sessão inválida' },
      { status: 401 }
    );
  }
}
