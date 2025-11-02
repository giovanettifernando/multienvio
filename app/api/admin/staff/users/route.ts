import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSessionFromRequest } from '@/lib/auth/admin-session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
  }

  try {
    const users = await prisma.staffUser.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[ADMIN_STAFF_USERS_GET]', error);
    return NextResponse.json({ message: 'Erro ao carregar equipe de suporte' }, { status: 500 });
  }
}
