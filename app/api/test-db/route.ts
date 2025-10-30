import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Testar conexão com o banco
    const userCount = await prisma.user.count();
    const roleCount = await prisma.role.count();
    const addressCount = await prisma.address.count();

    // Buscar todos os usuários com seus roles
    const users = await prisma.user.findMany({
      include: {
        role: true,
        addresses: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Conexão com PostgreSQL estabelecida com sucesso!',
      stats: {
        users: userCount,
        roles: roleCount,
        addresses: addressCount,
      },
      data: users,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro ao conectar com o banco:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Erro ao conectar com o banco de dados',
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
