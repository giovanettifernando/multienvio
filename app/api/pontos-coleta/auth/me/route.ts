import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { requirePickupPointSession } from '@/platform/auth/require-session';
import { prisma } from '@/platform/db/db';

type CollectorMeResponse = {
  collector: {
    pointId: string;
    cnpj: string;
    nomeFantasia: string;
    razaoSocial: string | null;
    email: string | null;
    telefone: string | null;
    address: {
      cep: string | null;
      logradouro: string | null;
      numero: string | null;
      complemento: string | null;
      bairro: string | null;
      cidade: string | null;
      uf: string | null;
    };
    commissionPerItem: number | null;
    monthlyReceived: number;
  };
};

export const GET = withApiHandler<CollectorMeResponse>(async (context) => {
  const { req, logger } = context;

  const session = await requirePickupPointSession(req);

  // Buscar dados atualizados do ponto de coleta
  const point = await prisma.pickupPoint.findUnique({
    where: { id: session.pointId },
    select: {
      id: true,
      status: true,
      cnpj: true,
      nomeFantasia: true,
      razaoSocial: true,
      email: true,
      telefone: true,
      cep: true,
      logradouro: true,
      numero: true,
      complemento: true,
      bairro: true,
      cidade: true,
      uf: true,
      commissionPerItem: true,
      monthlyReceived: true,
    },
  });

  if (!point) {
    throw new ApiError({
      code: 'not_found',
      message: 'Ponto não encontrado',
      status: 404,
    });
  }

  if (point.status !== 'ACTIVE') {
    throw new ApiError({
      code: 'forbidden',
      message: 'Ponto de coleta inativo ou bloqueado',
      status: 403,
    });
  }

  logger.info('collector_me_success', { pointId: point.id });

  return {
    data: {
      collector: {
        pointId: point.id,
        cnpj: point.cnpj,
        nomeFantasia: point.nomeFantasia,
        razaoSocial: point.razaoSocial,
        email: point.email,
        telefone: point.telefone,
        address: {
          cep: point.cep,
          logradouro: point.logradouro,
          numero: point.numero,
          complemento: point.complemento,
          bairro: point.bairro,
          cidade: point.cidade,
          uf: point.uf,
        },
        commissionPerItem: point.commissionPerItem
          ? parseFloat(point.commissionPerItem.toString())
          : null,
        monthlyReceived: point.monthlyReceived,
      },
    },
  };
});
