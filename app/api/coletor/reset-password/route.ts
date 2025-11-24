/**
 * POST /api/coletor/reset-password
 *
 * Processa a redefinição de senha do coletor usando o token JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/lib/db';
import bcrypt from 'bcrypt';

export const dynamic = 'force-dynamic';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'envio-legal-secret-key-change-in-production'
);

interface TokenPayload {
  collectorId: string;
  email: string;
  type: string;
}

/**
 * POST /api/coletor/reset-password
 * Redefine a senha do coletor
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, newPassword } = body;

    // Validações básicas
    if (!token || !newPassword) {
      return NextResponse.json(
        { error: 'Token e nova senha são obrigatórios' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      );
    }

    // Verificar e decodificar token JWT
    let payload: TokenPayload;
    try {
      const { payload: jwtPayload } = await jwtVerify(token, JWT_SECRET);
      payload = jwtPayload as unknown as TokenPayload;

      if (payload.type !== 'password-reset') {
        return NextResponse.json(
          { error: 'Token inválido' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error('[RESET_PASSWORD_PROCESS] Token inválido ou expirado:', error);
      return NextResponse.json(
        { error: 'Token inválido ou expirado. Solicite um novo link de redefinição.' },
        { status: 400 }
      );
    }

    // Buscar coletor
    const collector = await prisma.collector.findUnique({
      where: { id: payload.collectorId },
      include: { credential: true },
    });

    if (!collector) {
      return NextResponse.json(
        { error: 'Coletor não encontrado' },
        { status: 404 }
      );
    }

    if (collector.pfEmail !== payload.email) {
      return NextResponse.json(
        { error: 'Token inválido para este coletor' },
        { status: 400 }
      );
    }

    // Gerar hash da nova senha
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Atualizar ou criar credential
    if (collector.credential) {
      await prisma.collectorCredential.update({
        where: { id: collector.credential.id },
        data: { passwordHash },
      });
    } else {
      await prisma.collectorCredential.create({
        data: {
          collectorId: collector.id,
          passwordHash,
        },
      });
    }

    console.log('[RESET_PASSWORD_PROCESS] Senha redefinida para coletor:', collector.id);

    return NextResponse.json(
      { message: 'Senha redefinida com sucesso!' },
      { status: 200 }
    );
  } catch (error) {
    console.error('[RESET_PASSWORD_PROCESS]', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao redefinir senha',
      },
      { status: 500 }
    );
  }
}
