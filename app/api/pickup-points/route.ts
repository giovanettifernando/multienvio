export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/pickup-points
 * Retorna pontos de coleta ativos filtrados por localização
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cidade = searchParams.get('cidade');
    const uf = searchParams.get('uf');
    const q = searchParams.get('q'); // Busca por nome/bairro/cidade

    // Filtros base
    const where: any = {
      status: 'ACTIVE',
    };

    // Filtrar por cidade/UF se fornecidos
    if (cidade) {
      where.cidade = {
        equals: cidade,
        mode: 'insensitive',
      };
    }

    if (uf) {
      where.uf = uf.toUpperCase();
    }

    // Busca textual opcional
    if (q) {
      where.OR = [
        { nomeFantasia: { contains: q, mode: 'insensitive' } },
        { razaoSocial: { contains: q, mode: 'insensitive' } },
        { bairro: { contains: q, mode: 'insensitive' } },
        { cidade: { contains: q, mode: 'insensitive' } },
      ];
    }

    const pickupPoints = await prisma.pickupPoint.findMany({
      where,
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cep: true,
        logradouro: true,
        numero: true,
        complemento: true,
        bairro: true,
        cidade: true,
        uf: true,
        geo: true,
      },
      orderBy: [
        { cidade: 'asc' },
        { nomeFantasia: 'asc' },
      ],
    });

    // Mapear para formato simplificado
    const result = pickupPoints.map((point) => {
      const geo = point.geo as { lat?: number; lng?: number } | null;
      return {
        id: point.id,
        name: point.nomeFantasia,
        alias: point.razaoSocial,
        address: point.logradouro || '',
        number: point.numero || '',
        neighborhood: point.bairro || '',
        city: point.cidade || '',
        uf: point.uf || '',
        cep: point.cep || '',
        lat: geo?.lat || null,
        lng: geo?.lng || null,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PICKUP_POINTS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar pontos de coleta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
