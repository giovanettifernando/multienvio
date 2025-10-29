import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/collectors/mock-db';
import { collectorSchema } from '@/lib/collectors/schemas';
import type { Collector, CollectorFormData } from '@/lib/collectors/types';
import { unmaskDigits } from '@/lib/collectors/masks';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const collector = db.collectors.find((item) => item.id === id);

  if (!collector) {
    return NextResponse.json({ message: 'Coletor não encontrado' }, { status: 404 });
  }

  return NextResponse.json(collector, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const index = db.collectors.findIndex((item) => item.id === id);

    if (index === -1) {
      return NextResponse.json({ message: 'Coletor não encontrado' }, { status: 404 });
    }

    const raw = (await request.json()) as CollectorFormData;
    const parsed = collectorSchema.parse(raw);

    const digits = unmaskDigits(parsed.pj.cnpj);
    const currentDigits = unmaskDigits(db.collectors[index].pj.cnpj);

    if (digits !== currentDigits) {
      const duplicated = db.collectors.find(
        (item) => item.id !== id && unmaskDigits(item.pj.cnpj) === digits
      );

      if (duplicated) {
        return NextResponse.json({ message: 'CNPJ já cadastrado' }, { status: 409 });
      }
    }

    const updated: Collector = {
      ...db.collectors[index],
      ...parsed,
      updatedAt: new Date().toISOString(),
    };

    db.collectors[index] = updated;

    return NextResponse.json(updated, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Dados inválidos' },
      { status: 400 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status: 'active' | 'blocked' };
    const index = db.collectors.findIndex((item) => item.id === id);

    if (index === -1) {
      return NextResponse.json({ message: 'Coletor não encontrado' }, { status: 404 });
    }

    const updated: Collector = {
      ...db.collectors[index],
      status: body.status,
      updatedAt: new Date().toISOString(),
    };

    db.collectors[index] = updated;

    return NextResponse.json(updated, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Dados inválidos' },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = db.collectors.findIndex((item) => item.id === id);

  if (index === -1) {
    return NextResponse.json({ message: 'Coletor não encontrado' }, { status: 404 });
  }

  db.collectors.splice(index, 1);

  return NextResponse.json(
    { message: 'Coletor removido com sucesso' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
