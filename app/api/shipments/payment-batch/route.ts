export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const paymentBatchSchema = z.object({
  shipmentIds: z.array(z.string()).min(1, 'Pelo menos um shipment é necessário'),
  method: z.enum(['wallet', 'pix', 'card']),
  status: z.enum(['approved', 'pending', 'failed']),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/**
 * PATCH /api/shipments/payment-batch
 * Atualiza o status de pagamento de múltiplos shipments em transação
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json({ message: 'Não autorizado' }, { status: 401 });
    }

    const body = await request.json();
    const validation = paymentBatchSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: 'Dados inválidos',
          errors: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { shipmentIds, method, status, meta } = validation.data;

    // Verificar se todos os shipments pertencem ao usuário
    const shipmentsCount = await prisma.shipment.count({
      where: {
        id: { in: shipmentIds },
        senderId: session.userId,
      },
    });

    if (shipmentsCount !== shipmentIds.length) {
      return NextResponse.json(
        { message: 'Um ou mais shipments não encontrados ou não pertencem ao usuário' },
        { status: 404 }
      );
    }

    // Buscar os shipments para atualizar com documento
    const shipments = await prisma.shipment.findMany({
      where: {
        id: { in: shipmentIds },
        senderId: session.userId,
      },
      select: {
        id: true,
        document: true,
      },
    });

    // Atualizar todos os shipments em transação
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar cada shipment individualmente para mesclar o meta no document JSON
      const updates = shipments.map((shipment) => {
        const currentDoc = (shipment.document as Record<string, unknown>) || {};
        return tx.shipment.update({
          where: { id: shipment.id },
          data: {
            paymentMethod: method,
            document: {
              ...currentDoc,
              payment: {
                status,
                method,
                ...meta,
              },
            },
            updatedAt: new Date(),
          },
        });
      });

      await Promise.all(updates);

      return { count: updates.length };
    });

    return NextResponse.json({
      message: 'Pagamento atualizado com sucesso',
      count: result.count,
      shipmentIds,
    });
  } catch (error) {
    console.error('[SHIPMENTS_PAYMENT_BATCH]', error);
    return NextResponse.json(
      { message: 'Erro ao processar pagamento em lote' },
      { status: 500 }
    );
  }
}
