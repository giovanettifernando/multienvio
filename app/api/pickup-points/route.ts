import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getCoordinatesForCep } from '@/lib/services/postgis';

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
    const where: {
      status: 'ACTIVE' | 'BLOCKED' | 'PENDING';
      cidade?: { equals: string; mode: 'insensitive' };
      uf?: string;
      OR?: Array<{ [key: string]: { contains: string; mode: 'insensitive' } }>;
    } = {
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
        // geo removido - obter coordenadas do CEP via cep_locations
      },
      orderBy: [
        { cidade: 'asc' },
        { nomeFantasia: 'asc' },
      ],
    });

    // Mapear para formato simplificado
    // Obter coordenadas dos CEPs em paralelo
    const result = await Promise.all(
      pickupPoints.map(async (point) => {
        let lat: number | null = null;
        let lng: number | null = null;

        // Obter coordenadas do CEP se disponível
        if (point.cep) {
          try {
            const coords = await getCoordinatesForCep(point.cep);
            lat = coords.lat;
            lng = coords.lng;
          } catch (error) {
            console.warn(`[PICKUP_POINTS] Failed to get coords for CEP ${point.cep}:`, error);
            // lat/lng permanecem null
          }
        }

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
          lat,
          lng,
        };
      })
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('[PICKUP_POINTS_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar pontos de coleta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
