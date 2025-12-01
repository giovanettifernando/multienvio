
import { NextResponse } from 'next/server';
import { getCollectorSessionFromRequest } from '@/lib/auth/collector-session';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const session = await getCollectorSessionFromRequest(request);

    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    // Buscar dados atualizados do ponto de coleta
    const point = await prisma.pickupPoint.findUnique({
      where: { id: session.pointId },
      select: {
        id: true,
        status: true,
        cnpj: true,
        nomeFantasia: true,
        razaoSocial: true,
        email: true,
        telefone: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        uf: true,
        commissionPerItem: true,
        monthlyReceived: true,
      },
    });

    if (!point) {
      return NextResponse.json({ message: 'Ponto não encontrado' }, { status: 404 });
    }

    if (point.status !== 'ACTIVE') {
      return NextResponse.json(
        { message: 'Ponto de coleta inativo ou bloqueado' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      collector: {
        pointId: point.id,
        cnpj: point.cnpj,
        nomeFantasia: point.nomeFantasia,
        razaoSocial: point.razaoSocial,
        email: point.email,
        telefone: point.telefone,
        address: {
          cep: point.cep,
          logradouro: point.logradouro,
          numero: point.numero,
          complemento: point.complemento,
          bairro: point.bairro,
          cidade: point.cidade,
          uf: point.uf,
        },
        commissionPerItem: point.commissionPerItem
          ? parseFloat(point.commissionPerItem.toString())
          : null,
        monthlyReceived: point.monthlyReceived,
      },
    });
  } catch (error) {
    console.error('[COLLECTOR_ME]', error);
    return NextResponse.json({ message: 'Erro ao buscar sessão' }, { status: 500 });
  }
}
