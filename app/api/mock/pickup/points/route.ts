import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/pickup/mock-db';
import type { PickupPoint, PickupPointFormData } from '@/lib/pickup/types';
import { unmaskDigits } from '@/lib/pickup/masks';

// GET - Lista paginada com filtros
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const q = searchParams.get('q') || '';
  const status = searchParams.get('status') as 'active' | 'blocked' | 'all' | null;
  const uf = searchParams.get('uf') || '';
  const cidade = searchParams.get('cidade') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
  const sort = (searchParams.get('sort') || 'updated_desc') as 'name_asc' | 'name_desc' | 'updated_desc' | 'updated_asc';

  let filtered = [...db.pickupPoints];

  // Filtro de busca (nome fantasia, razão social, CNPJ)
  if (q) {
    const searchTerm = q.toLowerCase();
    filtered = filtered.filter(
      (point) =>
        point.nomeFantasia.toLowerCase().includes(searchTerm) ||
        point.razaoSocial.toLowerCase().includes(searchTerm) ||
        unmaskDigits(point.cnpj).includes(unmaskDigits(q))
    );
  }

  // Filtro de status
  if (status && status !== 'all') {
    filtered = filtered.filter((point) => point.status === status);
  }

  // Filtro de UF
  if (uf) {
    filtered = filtered.filter((point) => point.uf === uf.toUpperCase());
  }

  // Filtro de cidade
  if (cidade) {
    const cidadeTerm = cidade.toLowerCase();
    filtered = filtered.filter((point) => point.cidade?.toLowerCase().includes(cidadeTerm));
  }

  // Ordenação
  filtered.sort((a, b) => {
    switch (sort) {
      case 'name_asc':
        return a.nomeFantasia.localeCompare(b.nomeFantasia);
      case 'name_desc':
        return b.nomeFantasia.localeCompare(a.nomeFantasia);
      case 'updated_asc':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'updated_desc':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  // Paginação
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const items = filtered.slice(start, end);

  return NextResponse.json(
    {
      items,
      total,
      page,
      pageSize,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

// POST - Criar novo ponto de coleta
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PickupPointFormData;

    // Validar CNPJ único
    const cnpjDigits = unmaskDigits(body.cnpj);
    const existing = db.pickupPoints.find((p) => unmaskDigits(p.cnpj) === cnpjDigits);

    if (existing) {
      return NextResponse.json(
        { message: 'CNPJ já cadastrado' },
        { status: 409 }
      );
    }

    // Criar novo ponto
    const newPoint: PickupPoint = {
      id: Date.now().toString(),
      status: 'active',
      ...body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.pickupPoints.push(newPoint);

    return NextResponse.json(newPoint, {
      status: 201,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: 'Dados inválidos' },
      { status: 400 }
    );
  }
}
