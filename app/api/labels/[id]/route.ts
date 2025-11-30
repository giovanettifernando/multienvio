import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSessionFromRequest } from "@/lib/auth/user-session";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/labels/[id]
 * Busca detalhes completos de uma etiqueta para impressão
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;

    // Buscar etiqueta com dados completos do shipment e sender
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        shipment: {
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                razaoSocial: true,
                addresses: {
                  where: {
                    OR: [
                      { role: 'sender' },
                      { isDefault: true },
                    ],
                  },
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    if (!label) {
      return NextResponse.json({ message: 'Etiqueta não encontrada' }, { status: 404 });
    }

    // Verificar permissão
    if (label.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Extrair dados do endereço do remetente
    const senderAddress = label.shipment.sender.addresses[0];

    // Montar resposta com dados estruturados para impressão
    const response = {
      id: label.id,
      shipmentId: label.shipmentId,
      carrier: label.carrier,
      service: label.service,
      status: label.status,
      isPrinted: label.isPrinted,
      printedAt: label.printedAt?.toISOString(),
      createdAt: label.createdAt.toISOString(),

      // Códigos de rastreio
      platformTrackingCode: label.shipment.platformTrackingCode,
      carrierTrackingCode: label.shipment.carrierTrackingCode,

      // Destinatário
      recipient: {
        name: label.recipientName || label.shipment.recipientName || 'Não informado',
        document: label.shipment.recipientDocument,
        phone: label.shipment.recipientPhone,
        email: label.shipment.recipientEmail,
        address: label.shipment.destinationAddress,
        neighborhood: label.shipment.destinationNeighborhood,
        city: label.shipment.destinationCity,
        state: label.shipment.destinationState,
        cep: label.shipment.destinationCep,
      },

      // Remetente
      sender: {
        name: label.shipment.sender.razaoSocial || label.shipment.sender.name || 'Não informado',
        address: senderAddress
          ? `${senderAddress.logradouro}${senderAddress.numero ? `, ${senderAddress.numero}` : ''}`
          : null,
        neighborhood: senderAddress?.bairro,
        city: senderAddress?.cidade,
        state: senderAddress?.uf,
        cep: label.shipment.originCep,
      },

      // Arquivo PDF (se existir)
      file: label.fileUrl || label.fileBase64
        ? {
            url: label.fileUrl,
            base64: label.fileBase64,
            contentType: label.contentType,
          }
        : null,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[LABEL_GET]', error);
    const message = error instanceof Error ? error.message : 'Erro ao buscar etiqueta';
    return NextResponse.json({ message }, { status: 500 });
  }
}

/**
 * PATCH /api/labels/[id]
 * Atualiza status de impressão da etiqueta
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await getUserSessionFromRequest(request);
    if (!session) {
      return NextResponse.json({ message: 'Não autenticado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isPrinted } = body;

    // Verificar se a etiqueta pertence ao usuário
    const label = await prisma.label.findUnique({
      where: { id },
      include: {
        shipment: {
          select: { senderId: true },
        },
      },
    });

    if (!label) {
      return NextResponse.json({ message: 'Etiqueta não encontrada' }, { status: 404 });
    }

    if (label.shipment.senderId !== session.userId) {
      return NextResponse.json({ message: 'Acesso negado' }, { status: 403 });
    }

    // Atualizar status de impressão
    const updated = await prisma.label.update({
      where: { id },
      data: {
        isPrinted: isPrinted ?? true,
        printedAt: isPrinted ? new Date() : null,
      },
    });

    return NextResponse.json({
      message: isPrinted ? 'Etiqueta marcada como impressa' : 'Status de impressão atualizado',
      label: {
        id: updated.id,
        isPrinted: updated.isPrinted,
        printedAt: updated.printedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('[LABEL_PATCH]', error);
    const message = error instanceof Error ? error.message : 'Erro ao atualizar etiqueta';
    return NextResponse.json({ message }, { status: 500 });
  }
}
