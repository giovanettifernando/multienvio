import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/pickup/mock-db';
import type { PickupPointFormData } from '@/lib/pickup/types';
import { unmaskDigits } from '@/lib/pickup/masks';

// GET - Buscar ponto específico
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const point = db.pickupPoints.find((p) => p.id === id);

  if (!point) {
    return NextResponse.json(
      { message: 'Ponto de coleta não encontrado' },
      { status: 404 }
    );
  }

  return NextResponse.json(point, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

// PUT - Atualizar ponto
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as PickupPointFormData;

    const index = db.pickupPoints.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json(
        { message: 'Ponto de coleta não encontrado' },
        { status: 404 }
      );
    }

    // Validar CNPJ único (se mudou)
    const cnpjDigits = unmaskDigits(body.cnpj);
    const currentCnpj = unmaskDigits(db.pickupPoints[index].cnpj);

    if (cnpjDigits !== currentCnpj) {
      const existing = db.pickupPoints.find(
        (p) => p.id !== id && unmaskDigits(p.cnpj) === cnpjDigits
      );

      if (existing) {
        return NextResponse.json(
          { message: 'CNPJ já cadastrado' },
          { status: 409 }
        );
      }
    }

    // Atualizar
    const updatedPoint = {
      ...db.pickupPoints[index],
      ...body,
      updatedAt: new Date().toISOString(),
    };

    db.pickupPoints[index] = updatedPoint;

    return NextResponse.json(updatedPoint, {
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

// PATCH - Toggle status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { status: 'active' | 'blocked' };

    const index = db.pickupPoints.findIndex((p) => p.id === id);

    if (index === -1) {
      return NextResponse.json(
        { message: 'Ponto de coleta não encontrado' },
        { status: 404 }
      );
    }

    db.pickupPoints[index] = {
      ...db.pickupPoints[index],
      status: body.status,
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(db.pickupPoints[index], {
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

// DELETE - Excluir ponto
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const index = db.pickupPoints.findIndex((p) => p.id === id);

  if (index === -1) {
    return NextResponse.json(
      { message: 'Ponto de coleta não encontrado' },
      { status: 404 }
    );
  }

  db.pickupPoints.splice(index, 1);

  return NextResponse.json(
    { message: 'Ponto de coleta excluído com sucesso' },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
