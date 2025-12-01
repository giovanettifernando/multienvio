/**
 * API Route para registrar entrada de envio no hub
 * POST /api/pontos-coleta/receptions/[id]/register-entry
 */


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const RegisterEntrySchema = z.object({
  trackingCode: z.string().min(1, 'Código de rastreio é obrigatório'),
});

/**
 * POST /api/pontos-coleta/receptions/[id]/register-entry
 * Registra entrada do envio no hub
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = RegisterEntrySchema.parse(body);

    // Buscar o envio
    const shipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!shipment) {
      return NextResponse.json({ message: 'Envio não encontrado' }, { status: 404 });
    }

    // Validar se já foi recebido
    if (shipment.receivedAt) {
      return NextResponse.json(
        { message: 'Este envio já foi registrado como recebido' },
        { status: 400 }
      );
    }

    // Validar código de rastreio
    if (shipment.platformTrackingCode !== validatedData.trackingCode) {
      return NextResponse.json(
        { message: 'Código de rastreio não corresponde ao envio selecionado' },
        { status: 400 }
      );
    }

    // Registrar recebimento
    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: {
        receivedAt: new Date(),
        receivedBy: 'collector-user', // TODO: Pegar ID do usuário autenticado
        status: 'recebido', // Atualizar status para "recebido"
      },
    });

    // Criar evento de rastreamento
    await prisma.trackingEvent.create({
      data: {
        shipmentId: id,
        type: 'recebido',
        description: 'Envio recebido no hub de distribuição',
        city: 'Hub de Distribuição',
        occurredAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Entrada registrada com sucesso',
      shipment: {
        id: updatedShipment.id,
        trackingCode: updatedShipment.platformTrackingCode,
        receivedAt: updatedShipment.receivedAt,
        status: updatedShipment.status,
      },
    });
  } catch (error) {
    console.error('[REGISTER_ENTRY_POST]', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: 'Dados inválidos', details: error.message },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Erro ao registrar entrada';
    return NextResponse.json({ message }, { status: 500 });
  }
}
