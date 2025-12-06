import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSessionFromRequest } from "@/lib/auth/user-session";


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

    // Buscar etiqueta com dados completos do shipment, sender e packages
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
                cpf: true,
                cnpj: true,
                addresses: {
                  where: { isDefault: true },
                  take: 1,
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
            packages: {
              orderBy: { packageNumber: 'asc' },
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

    // Extrair endereço completo do destinatário
    const destinationAddressParts = label.shipment.destinationAddress?.split(',') || [];
    const destinationLogradouro = destinationAddressParts[0]?.trim() || '';
    const destinationNumero = destinationAddressParts[1]?.trim() || 'S/N';

    // Montar volumes a partir dos packages
    const volumes = label.shipment.packages.length > 0
      ? label.shipment.packages.map((pkg) => ({
          packageNumber: pkg.packageNumber,
          pesoKg: pkg.weight,
          dimensoes: {
            comprimento: pkg.length,
            largura: pkg.width,
            altura: pkg.height,
          },
        }))
      : [
          // Fallback: se não há packages, criar um volume com o peso total
          {
            packageNumber: 1,
            pesoKg: label.shipment.weight,
            dimensoes: {
              comprimento: 20,
              largura: 15,
              altura: 10,
            },
          },
        ];

    // Montar resposta com dados estruturados para impressão
    const response = {
      id: label.id,
      shipmentId: label.shipmentId,
      carrier: label.carrier,
      service: label.service,
      serviceCode: label.shipment.service, // Código do serviço Correios (04014, etc) - pode ser o nome ou código
      status: label.status,
      isPrinted: label.isPrinted,
      printedAt: label.printedAt?.toISOString(),
      createdAt: label.createdAt.toISOString(),

      // Códigos de rastreio
      platformTrackingCode: label.shipment.platformTrackingCode,
      carrierTrackingCode: label.shipment.carrierTrackingCode,

      // Destinatário (formato completo para etiquetas Correios)
      recipient: {
        name: label.recipientName || label.shipment.recipientName || 'Não informado',
        document: label.shipment.recipientDocument,
        phone: label.shipment.recipientPhone,
        email: label.shipment.recipientEmail,
        // Campos estruturados para etiqueta
        logradouro: destinationLogradouro,
        numero: destinationNumero,
        complemento: null, // TODO: adicionar campo no shipment se necessário
        bairro: label.shipment.destinationNeighborhood || '',
        cidade: label.shipment.destinationCity,
        uf: label.shipment.destinationState,
        cep: label.shipment.destinationCep,
        // Campo legado para compatibilidade
        address: label.shipment.destinationAddress,
        neighborhood: label.shipment.destinationNeighborhood,
        city: label.shipment.destinationCity,
        state: label.shipment.destinationState,
      },

      // Remetente (formato completo para etiquetas Correios)
      sender: {
        name: label.shipment.sender.razaoSocial || label.shipment.sender.name || 'Não informado',
        document: label.shipment.sender.cnpj || label.shipment.sender.cpf || null,
        phone: label.shipment.sender.phone,
        email: label.shipment.sender.email,
        // Campos estruturados para etiqueta
        logradouro: senderAddress?.logradouro || '',
        numero: senderAddress?.numero || 'S/N',
        complemento: senderAddress?.complemento,
        bairro: senderAddress?.bairro || '',
        cidade: senderAddress?.cidade || '',
        uf: senderAddress?.uf || '',
        cep: label.shipment.originCep,
        // Campo legado para compatibilidade
        address: senderAddress
          ? `${senderAddress.logradouro}${senderAddress.numero ? `, ${senderAddress.numero}` : ''}`
          : null,
        neighborhood: senderAddress?.bairro,
        city: senderAddress?.cidade,
        state: senderAddress?.uf,
      },

      // Volumes/Packages
      volumes,
      totalVolumes: volumes.length,

      // Serviços adicionais
      additionalServices: {
        ar: false, // TODO: buscar do shipment se implementado
        mp: false,
        vd: label.shipment.declaredValue > 0 ? Math.round(label.shipment.declaredValue * 100) : undefined,
        dd: false,
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
