import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';
import { requirePermission } from '@/lib/auth/permissions';
import { AdminPermission } from '@prisma/client';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  const permissionError = requirePermission(session, AdminPermission.OPERACOES);
  if (permissionError) return permissionError;

  try {
    // Fetch only active collectors
    const collectors = await prisma.collector.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        id: true,
        pfNome: true,
        pfCelular: true,
        pfCidade: true,
        pfUf: true,
      },
      orderBy: {
        pfNome: 'asc',
      },
    });

    // Transform to simpler format
    const items = collectors.map((c) => ({
      id: c.id,
      name: c.pfNome,
      phone: c.pfCelular,
      city: c.pfCidade,
      uf: c.pfUf,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error fetching collectors:', error);
    return NextResponse.json(
      { message: 'Erro ao buscar coletores' },
      { status: 500 }
    );
  }
}
