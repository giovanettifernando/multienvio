
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

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

    // Atualizar todos os shipments e suas etiquetas em transação
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar cada shipment individualmente para mesclar o meta no document JSON
      const updates = shipments.map(async (shipment) => {
        const currentDoc = (shipment.document as Record<string, unknown>) || {};

        // Atualizar shipment (mantém status atual se aprovado, cancela se falhou)
        const updateData: {
          paymentMethod: string;
          status?: string;
          document: Prisma.InputJsonValue;
          updatedAt: Date;
        } = {
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
        };

        // Só altera status se pagamento falhar
        if (status === 'failed') {
          updateData.status = 'CANCELLED_BEFORE_HANDOFF';
        }
        // Se approved, mantém o status atual do fluxo

        await tx.shipment.update({
          where: { id: shipment.id },
          data: updateData,
        });

        // Atualizar etiqueta associada ao shipment (se existir)
        const label = await tx.label.findUnique({
          where: { shipmentId: shipment.id },
        });

        if (label && status === 'approved') {
          // Gerar PDF mock da etiqueta (base64) - mesmo usado em /api/wallet/debit
          const mockPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvTWVkaWFCb3hbMCAwIDYxMiA3OTJdL1BhcmVudCAyIDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNCAwIFI+Pj4+L0NvbnRlbnRzIDUgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvVGltZXMtUm9tYW4+PgplbmRvYmoKNSAwIG9iago8PC9MZW5ndGggNDQ+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjEwMCA3MDAgVGQKKEV0aXF1ZXRhIFRlc3RlKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAxNSAwMDAwMCBuIAowMDAwMDAwMDY0IDAwMDAwIG4gCjAwMDAwMDAxMTUgMDAwMDAgbiAKMDAwMDAwMDI0NSAwMDAwMCBuIAowMDAwMDAwMzI4IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNDIwCiUlRU9GCg==';

          await tx.label.update({
            where: { id: label.id },
            data: {
              status: 'issued',
              fileBase64: mockPdfBase64,
              contentType: 'application/pdf',
              sizeBytes: 420,
            },
          });
        }
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
