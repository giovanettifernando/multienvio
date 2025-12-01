/**
 * GET /api/admin/clients/[id]/details
 *
 * Retorna todos os detalhes de um usuário da plataforma para administração
 */


import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdminUser } from '@/lib/auth/admin-helpers';
import { AdminPermission } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const authResult = await requireAdminUser(request, AdminPermission.CONTAS);
    if (authResult instanceof NextResponse) return authResult;

    const { id } = await context.params;

    // Buscar usuário com todos os relacionamentos
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        cpf: true,
        cnpj: true,
        hasCompany: true,
        razaoSocial: true,
        status: true,
        avatarUrl: true,
        emailVerified: true,
        emailVerifiedAt: true,
        authProvider: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        termsAcceptedAt: true,
        // Endereços
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            label: true,
            cep: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            uf: true,
            isDefault: true,
            createdAt: true,
          },
        },
        // Cartões (sem dados sensíveis)
        cards: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            brand: true,
            holderName: true,
            last4: true,
            expMonth: true,
            expYear: true,
            isDefault: true,
            createdAt: true,
          },
        },
        // Destinatários recorrentes
        recipients: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            name: true,
            email: true,
            document: true,
            phone: true,
            notes: true,
            isDefault: true,
            cep: true,
            logradouro: true,
            numero: true,
            complemento: true,
            bairro: true,
            cidade: true,
            uf: true,
            createdAt: true,
          },
        },
        // Itens recorrentes
        recurringItems: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            descricao: true,
            valorUnitario: true,
            createdAt: true,
          },
        },
        // Carteira
        wallet: {
          select: {
            id: true,
            availableCents: true,
            pendingCents: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 404 });
    }

    // Buscar estatísticas da carteira (se existir)
    let walletStats = null;
    if (user.wallet) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const monthlyTransactions = await prisma.walletTransaction.groupBy({
        by: ['type'],
        where: {
          walletId: user.wallet.id,
          status: 'CONFIRMED',
          createdAt: { gte: startOfMonth },
        },
        _sum: { amountCents: true },
        _count: true,
      });

      const credits = monthlyTransactions
        .filter((t) => (t._sum.amountCents ?? 0) > 0)
        .reduce((acc, t) => acc + (t._sum.amountCents ?? 0), 0);

      const debits = Math.abs(
        monthlyTransactions
          .filter((t) => (t._sum.amountCents ?? 0) < 0)
          .reduce((acc, t) => acc + (t._sum.amountCents ?? 0), 0)
      );

      // Últimas transações
      const latestTransactions = await prisma.walletTransaction.findMany({
        where: { walletId: user.wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          type: true,
          status: true,
          amountCents: true,
          title: true,
          createdAt: true,
          confirmedAt: true,
        },
      });

      walletStats = {
        monthlyCredits: credits,
        monthlyDebits: debits,
        monthlyBalance: credits - debits,
        latestTransactions,
      };
    }

    // Buscar estatísticas de envios
    const shipmentStats = await prisma.shipment.aggregate({
      where: { senderId: id },
      _count: true,
    });

    // Formatar resposta
    const response = {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        cpf: user.cpf,
        cnpj: user.cnpj,
        hasCompany: user.hasCompany,
        razaoSocial: user.razaoSocial,
        status: user.status,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        authProvider: user.authProvider,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        lastLoginAt: user.lastLoginAt,
        termsAcceptedAt: user.termsAcceptedAt,
        type: user.hasCompany ? 'PJ' : 'PF',
        document: user.hasCompany ? user.cnpj : user.cpf,
      },
      addresses: user.addresses,
      cards: user.cards,
      recipients: user.recipients,
      recurringItems: user.recurringItems,
      wallet: user.wallet
        ? {
            id: user.wallet.id,
            availableCents: user.wallet.availableCents,
            pendingCents: user.wallet.pendingCents,
            availableReais: user.wallet.availableCents / 100,
            pendingReais: user.wallet.pendingCents / 100,
            hasNegativeBalance: user.wallet.availableCents < 0,
            ...walletStats,
          }
        : null,
      stats: {
        totalShipments: shipmentStats._count,
        totalAddresses: user.addresses.length,
        totalCards: user.cards.length,
        totalRecipients: user.recipients.length,
        totalRecurringItems: user.recurringItems.length,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[ADMIN_CLIENT_DETAILS]', error);
    return NextResponse.json({ message: 'Erro ao buscar detalhes do usuário' }, { status: 500 });
  }
}
