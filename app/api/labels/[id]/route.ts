import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requireUserSession } from '@/platform/auth/require-session';
import { prisma } from "@/platform/db/db";
import { z } from 'zod';

interface LabelVolume {
  packageNumber: number;
  pesoKg: number;
  dimensoes: {
    comprimento: number;
    largura: number;
    altura: number;
  };
}

interface LabelDetailResponse {
  id: string;
  shipmentId: string;
  carrier: string;
  service: string;
  serviceCode: string | null;
  status: string;
  isPrinted: boolean;
  printedAt?: string;
  createdAt: string;
  platformTrackingCode: string | null;
  carrierTrackingCode: string | null;
  recipient: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    logradouro: string;
    numero: string;
    complemento: null;
    bairro: string;
    cidade: string | null;
    uf: string | null;
    cep: string;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  };
  sender: {
    name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    address: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  };
  volumes: LabelVolume[];
  totalVolumes: number;
  additionalServices: {
    ar: boolean;
    mp: boolean;
    vd?: number;
    dd: boolean;
  };
  file: {
    url: string | null;
    base64: string | null;
    contentType: string | null;
  } | null;
}

/**
 * GET /api/labels/[id]
 * Busca detalhes completos de uma etiqueta para impressão
 */
export const GET = withApiHandler<LabelDetailResponse, { id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const { id } = await context.params;

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
    throw new ApiError({ code: 'not_found', message: 'Etiqueta não encontrada', status: 404 });
  }

  if (label.shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  const senderAddress = label.shipment.sender.addresses[0];
  const destinationAddressParts = label.shipment.destinationAddress?.split(',') || [];
  const destinationLogradouro = destinationAddressParts[0]?.trim() || '';
  const destinationNumero = destinationAddressParts[1]?.trim() || 'S/N';

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

  const response = {
    id: label.id,
    shipmentId: label.shipmentId,
    carrier: label.carrier,
    service: label.service,
    serviceCode: label.shipment.service,
    status: label.status,
    isPrinted: label.isPrinted,
    printedAt: label.printedAt?.toISOString(),
    createdAt: label.createdAt.toISOString(),
    platformTrackingCode: label.shipment.platformTrackingCode,
    carrierTrackingCode: label.shipment.carrierTrackingCode,
    recipient: {
      name: label.recipientName || label.shipment.recipientName || 'Não informado',
      document: label.shipment.recipientDocument,
      phone: label.shipment.recipientPhone,
      email: label.shipment.recipientEmail,
      logradouro: destinationLogradouro,
      numero: destinationNumero,
      complemento: null,
      bairro: label.shipment.destinationNeighborhood || '',
      cidade: label.shipment.destinationCity,
      uf: label.shipment.destinationState,
      cep: label.shipment.destinationCep,
      address: label.shipment.destinationAddress,
      neighborhood: label.shipment.destinationNeighborhood,
      city: label.shipment.destinationCity,
      state: label.shipment.destinationState,
    },
    sender: {
      name: label.shipment.sender.razaoSocial || label.shipment.sender.name || 'Não informado',
      document: label.shipment.sender.cnpj || label.shipment.sender.cpf || null,
      phone: label.shipment.sender.phone,
      email: label.shipment.sender.email,
      logradouro: senderAddress?.logradouro || '',
      numero: senderAddress?.numero || 'S/N',
      complemento: senderAddress?.complemento,
      bairro: senderAddress?.bairro || '',
      cidade: senderAddress?.cidade || '',
      uf: senderAddress?.uf || '',
      cep: label.shipment.originCep,
      address: senderAddress
        ? `${senderAddress.logradouro}${senderAddress.numero ? `, ${senderAddress.numero}` : ''}`
        : null,
      neighborhood: senderAddress?.bairro,
      city: senderAddress?.cidade,
      state: senderAddress?.uf,
    },
    volumes,
    totalVolumes: volumes.length,
    additionalServices: {
      ar: false,
      mp: false,
      vd: label.shipment.declaredValue > 0 ? Math.round(label.shipment.declaredValue * 100) : undefined,
      dd: false,
    },
    file: label.fileUrl || label.fileBase64
      ? {
          url: label.fileUrl,
          base64: label.fileBase64,
          contentType: label.contentType,
        }
      : null,
  };

  return { data: response };
});

interface LabelPrintUpdateResponse {
  message: string;
  label: {
    id: string;
    isPrinted: boolean;
    printedAt?: string;
  };
}

const LabelPrintUpdateSchema = z.object({
  isPrinted: z.boolean().optional(),
});

/**
 * PATCH /api/labels/[id]
 * Atualiza status de impressão da etiqueta
 */
export const PATCH = withApiHandler<LabelPrintUpdateResponse, { id: string }>(async (context) => {
  const session = await requireUserSession(context.req);

  const { id } = await context.params;
  const body = await context.req.json();

  const parsed = LabelPrintUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      status: 400,
      details: parsed.error.flatten(),
    });
  }

  const { isPrinted } = parsed.data;

  const label = await prisma.label.findUnique({
    where: { id },
    include: {
      shipment: {
        select: { senderId: true },
      },
    },
  });

  if (!label) {
    throw new ApiError({ code: 'not_found', message: 'Etiqueta não encontrada', status: 404 });
  }

  if (label.shipment.senderId !== session.userId) {
    throw new ApiError({ code: 'forbidden', message: 'Acesso negado', status: 403 });
  }

  // SECURITY: isPrinted é monotônico - uma vez impressa, não pode ser desmarcada
  if (isPrinted === false && label.isPrinted === true) {
    throw new ApiError({
      code: 'invalid_operation',
      message: 'Não é possível desmarcar uma etiqueta já impressa',
      status: 400,
    });
  }

  // Se já está impressa, retorna sem modificar (idempotente)
  if (label.isPrinted === true) {
    return {
      data: {
        message: 'Etiqueta já estava marcada como impressa',
        label: {
          id: label.id,
          isPrinted: label.isPrinted,
          printedAt: label.printedAt?.toISOString(),
        },
      },
    };
  }

  const updated = await prisma.label.update({
    where: { id },
    data: {
      isPrinted: true,
      printedAt: new Date(),
    },
  });

  return {
    data: {
      message: 'Etiqueta marcada como impressa',
      label: {
        id: updated.id,
        isPrinted: updated.isPrinted,
        printedAt: updated.printedAt?.toISOString(),
      },
    },
  };
});
