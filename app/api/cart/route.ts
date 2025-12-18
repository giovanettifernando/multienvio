import { withApiHandler } from '@/platform/api/handler';
import { ApiError } from '@/platform/api/errors';
import { getUserFromRequest } from '@/modules/auth/application/session';
import { prisma } from '@/platform/db/db';
import type { Prisma } from '@prisma/client';

// Tipo para endereço de origem
type OriginAddress = {
  cep: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  nome?: string;
  [key: string]: unknown;
};

// Tipo para destinatário
type Destination = {
  nome?: string;
  apelido?: string;
  telefone?: string;
  email?: string;
  documento?: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  [key: string]: unknown;
};

// Tipo para volume
type Volume = {
  pesoKg?: number;
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
  [key: string]: unknown;
};

// Tipo para cotação selecionada
type SelectedQuote = {
  carrier: string;
  serviceName?: string;
  serviceCode?: string;
  deadlineDays: number;
  price: number;
  [key: string]: unknown;
};

// Tipo para totais do item
type ItemTotals = {
  total?: number;
  [key: string]: unknown;
};

// Tipo para totais do carrinho
type CartTotals = {
  total: number;
  moeda: string;
  subtotal?: number;
  [key: string]: unknown;
};

// Tipo para item do carrinho
type CartItemResponse = {
  id: string;
  originAddress: Prisma.JsonValue;
  destination: Prisma.JsonValue;
  volumes: Prisma.JsonValue;
  preferences: Prisma.JsonValue;
  insuranceValue?: number;
  pickupPoint: Prisma.JsonValue;
  selectedQuote: Prisma.JsonValue;
  totals: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
};

// Tipo para resposta do carrinho
type CartResponse = {
  id: string;
  status: string;
  totals: Prisma.JsonValue;
  meta: Prisma.JsonValue;
  createdAt: string;
  updatedAt: string;
  items: CartItemResponse[];
};

// Tipo para resposta GET /api/cart
type GetCartResponse = {
  cart: CartResponse;
};

/**
 * GET /api/cart
 * Retorna o carrinho OPEN do usuário logado com seus itens
 */
export const GET = withApiHandler<GetCartResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  // Buscar ou criar carrinho OPEN do usuário
  // REGRA: Cada usuário pode ter apenas 1 carrinho OPEN (enforced by unique index)
  let cart = await prisma.cart.findFirst({
    where: {
      userId: session.userId,
      status: 'OPEN',
    },
    include: {
      items: {
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  // Se não existir, criar um novo carrinho vazio
  // Usa try-catch para lidar com race condition (unique constraint violation)
  if (!cart) {
    try {
      cart = await prisma.cart.create({
        data: {
          userId: session.userId,
          status: 'OPEN',
          totals: { total: 0, moeda: 'BRL' },
        },
        include: {
          items: true,
        },
      });
    } catch (error: unknown) {
      // Se falhar por unique constraint, outro request criou o carrinho - buscar novamente
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        cart = await prisma.cart.findFirst({
          where: {
            userId: session.userId,
            status: 'OPEN',
          },
          include: {
            items: {
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        });
        if (!cart) {
          throw new ApiError({ code: 'cart_error', message: 'Falha ao criar/buscar carrinho', status: 500 });
        }
      } else {
        throw error;
      }
    }
  }

  return {
    data: {
      cart: {
        id: cart.id,
        status: cart.status,
        totals: cart.totals,
        meta: cart.meta,
        createdAt: cart.createdAt.toISOString(),
        updatedAt: cart.updatedAt.toISOString(),
        items: cart.items.map((item) => ({
          id: item.id,
          originAddress: item.originAddress,
          destination: item.destination,
          volumes: item.volumes,
          preferences: item.preferences,
          insuranceValue: item.insuranceValue ? Number(item.insuranceValue) : undefined,
          pickupPoint: item.pickupPoint,
          selectedQuote: item.selectedQuote,
          totals: item.totals,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      },
    },
  };
});

// Tipo para resposta DELETE /api/cart
type DeleteCartResponse = {
  message: string;
  ok: boolean;
};

/**
 * DELETE /api/cart
 * Limpa o carrinho do usuário (remove todos os itens)
 * Aceita carrinho OPEN ou LOCKED e reseta para OPEN
 */
export const DELETE = withApiHandler<DeleteCartResponse>(async (context) => {
  const session = await getUserFromRequest(context.req);
  if (!session?.userId) {
    throw new ApiError({ code: 'unauthorized', message: 'Não autorizado', status: 401 });
  }

  // Buscar carrinho OPEN ou LOCKED do usuário
  const cart = await prisma.cart.findFirst({
    where: {
      userId: session.userId,
      status: { in: ['OPEN', 'LOCKED'] },
    },
  });

  if (!cart) {
    throw new ApiError({ code: 'not_found', message: 'Carrinho não encontrado', status: 404 });
  }

  // Remover todos os itens
  await prisma.cartItem.deleteMany({
    where: {
      cartId: cart.id,
    },
  });

  // Resetar carrinho: limpar totals, voltar para OPEN, limpar meta de checkout
  await prisma.cart.update({
    where: { id: cart.id },
    data: {
      status: 'OPEN',
      totals: { total: 0, moeda: 'BRL' },
      meta: {}, // Limpar fingerprint e histórico de checkout
      updatedAt: new Date(),
    },
  });

  return {
    data: {
      message: 'Carrinho limpo com sucesso',
      ok: true,
    },
  };
});
