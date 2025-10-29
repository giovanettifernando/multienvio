import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/collectors/mock-db';
import { collectorSchema } from '@/lib/collectors/schemas';
import type { Collector, CollectorFilters, CollectorFormData, CollectorListResponse } from '@/lib/collectors/types';
import { unmaskDigits } from '@/lib/collectors/masks';

function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number } {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return { items: items.slice(start, end), total };
}

function matchesSearch(value: string, search: string) {
  return value.toLowerCase().includes(search.toLowerCase());
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const q = searchParams.get('q') || '';
  const status = (searchParams.get('status') as 'active' | 'blocked' | 'all' | null) || 'all';
  const uf = searchParams.get('uf') || '';
  const cidade = searchParams.get('cidade') || '';
  const page = Number.parseInt(searchParams.get('page') || '1', 10);
  const pageSize = Number.parseInt(searchParams.get('pageSize') || '10', 10);
  const sort = (searchParams.get('sort') || 'updated_desc') as CollectorFilters['sort'];

  let filtered = [...db.collectors];

  if (q) {
    const searchTerm = q.toLowerCase();
    const digits = unmaskDigits(q);
    filtered = filtered.filter((collector) => {
      const matchesName =
        matchesSearch(collector.pf.nome, searchTerm) || matchesSearch(collector.pj.razaoSocial, searchTerm);
      const matchesCnpj = digits && unmaskDigits(collector.pj.cnpj).includes(digits);
      const matchesPlate = matchesSearch(collector.vehicle.plate, searchTerm);
      return matchesName || matchesCnpj || matchesPlate;
    });
  }

  if (status && status !== 'all') {
    filtered = filtered.filter((collector) => collector.status === status);
  }

  if (uf) {
    filtered = filtered.filter((collector) => collector.pj.endereco.uf?.toUpperCase() === uf.toUpperCase());
  }

  if (cidade) {
    const cidadeTerm = cidade.toLowerCase();
    filtered = filtered.filter((collector) => collector.pj.endereco.cidade?.toLowerCase().includes(cidadeTerm));
  }

  filtered.sort((a, b) => {
    switch (sort) {
      case 'name_asc':
        return a.pf.nome.localeCompare(b.pf.nome);
      case 'name_desc':
        return b.pf.nome.localeCompare(a.pf.nome);
      case 'updated_asc':
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      case 'updated_desc':
      default:
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }
  });

  const { items, total } = paginate(filtered, page, pageSize);

  const response: CollectorListResponse = {
    items,
    total,
    page,
    pageSize,
  };

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  try {
    const raw = (await request.json()) as CollectorFormData;
    const parsed = collectorSchema.parse(raw);

    const digits = unmaskDigits(parsed.pj.cnpj);
    const existing = db.collectors.find((collector) => unmaskDigits(collector.pj.cnpj) === digits);

    if (existing) {
      return NextResponse.json({ message: 'CNPJ já cadastrado' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const newCollector: Collector = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Date.now().toString(),
      status: 'active',
      ...parsed,
      createdAt: now,
      updatedAt: now,
    };

    db.collectors.push(newCollector);

    return NextResponse.json(newCollector, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Dados inválidos' },
      { status: 400 }
    );
  }
}
