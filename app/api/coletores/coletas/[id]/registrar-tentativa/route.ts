export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAutonomousCollectorSession } from '@/lib/auth/autonomous-collector-session';

interface RegisterAttemptBody {
  notes?: string;
}

/**
 * POST /api/coletores/coletas/[id]/registrar-tentativa
 * Registra uma tentativa de coleta sem sucesso
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validar autenticação
    const session = await getAutonomousCollectorSession();
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    // Validar dados do body
    const body: RegisterAttemptBody = await request.json();
    const { notes } = body;

    // Buscar pickup request
    const pickupRequest = await prisma.pickupRequest.findUnique({
      where: { id },
      select: {
        id: true,
        collectorId: true,
        status: true,
        attemptCount: true,
        attemptNotes: true,
      },
    });

    if (!pickupRequest) {
      return NextResponse.json({ message: 'Coleta não encontrada' }, { status: 404 });
    }

    // Validar que a coleta pertence ao coletor logado
    if (pickupRequest.collectorId !== session.coletorId) {
      return NextResponse.json(
        { message: 'Esta coleta não está atribuída a você' },
        { status: 403 }
      );
    }

    // Validar que a coleta está pendente
    if (pickupRequest.status !== 'PENDING') {
      return NextResponse.json(
        { message: `Coleta já foi processada (status: ${pickupRequest.status})` },
        { status: 400 }
      );
    }

    const now = new Date();

    // Preparar histórico de tentativas
    const currentAttempts = Array.isArray(pickupRequest.attemptNotes)
      ? pickupRequest.attemptNotes
      : [];

    const newAttempt = {
      attemptNumber: pickupRequest.attemptCount + 1,
      attemptedAt: now.toISOString(),
      notes: notes?.trim() || null,
      collectorId: session.coletorId,
      collectorName: session.pfNome,
    };

    const updatedAttempts = [...currentAttempts, newAttempt];

    // Atualizar pickup request
    const updatedPickupRequest = await prisma.pickupRequest.update({
      where: { id },
      data: {
        attemptCount: { increment: 1 },
        attemptNotes: updatedAttempts,
        updatedAt: now,
      },
      select: {
        id: true,
        status: true,
        attemptCount: true,
        attemptNotes: true,
      },
    });

    console.log('[REGISTRAR_TENTATIVA] Tentativa de coleta registrada:', {
      pickupId: id,
      collectorId: session.coletorId,
      attemptNumber: updatedPickupRequest.attemptCount,
      notes: notes || '(sem observação)',
      attemptedAt: now.toISOString(),
    });

    return NextResponse.json({
      message: 'Tentativa de coleta registrada com sucesso',
      pickup: {
        id: updatedPickupRequest.id,
        status: updatedPickupRequest.status,
        attemptCount: updatedPickupRequest.attemptCount,
        attemptNotes: updatedPickupRequest.attemptNotes,
      },
    }, { status: 200 });
  } catch (error) {
    console.error('[REGISTRAR_TENTATIVA_ERROR]', error);
    const message = error instanceof Error ? error.message : 'Erro ao registrar tentativa';
    return NextResponse.json({ message }, { status: 500 });
  }
}
