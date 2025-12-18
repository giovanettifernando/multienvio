import type { AccountStatus, AdminClient, ClientType } from '@/modules/admin/application/types';
import { formatCNPJ, formatCPF } from '@/shared/utils/masks';
import { AdminClientsPage } from '@/modules/admin/ui/components/clients/AdminClientsPage';


function mapClientStatus(status: string): AccountStatus {
  if (status === 'active') return 'active';
  if (status === 'blocked') return 'blocked';
  if (status === 'suspended') return 'suspended';
  return 'suspended';
}

function resolveClientType(hasCompany: boolean, cnpj?: string | null): ClientType {
  if (hasCompany) return 'PJ';
  if (cnpj) return 'PJ';
  return 'PF';
}

function resolveClientDocument(hasCompany: boolean, cpf?: string | null, cnpj?: string | null): string {
  if (hasCompany) {
    return cnpj ? formatCNPJ(cnpj) : '—';
  }
  if (cnpj) {
    return formatCNPJ(cnpj);
  }
  if (cpf) {
    return formatCPF(cpf);
  }
  return '—';
}

async function fetchAdminClients(): Promise<AdminClient[]> {
  try {
    const { prisma } = await import('@/platform/db/db');

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        hasCompany: true,
        cpf: true,
        cnpj: true,
        wallet: {
          select: {
            availableCents: true,
            pendingCents: true,
            transactions: {
              where: {
                type: 'TOPUP',
                status: 'CONFIRMED',
                createdAt: {
                  gte: startOfMonth,
                  lt: startOfNextMonth,
                },
              },
              select: {
                amountCents: true,
              },
            },
          },
        },
      },
    });

    return users.map((user) => {
      const walletAvailable = user.wallet?.availableCents ?? 0;
      const walletPending = user.wallet?.pendingCents ?? 0;
      const creditsMonth =
        user.wallet?.transactions.reduce((total, tx) => total + tx.amountCents, 0) ?? 0;
      const type = resolveClientType(user.hasCompany, user.cnpj);

      return {
        id: user.id,
        type,
        document: resolveClientDocument(user.hasCompany, user.cpf, user.cnpj),
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt.toISOString(),
        status: mapClientStatus(user.status),
        walletBalance: walletAvailable,
        creditsMonth,
        debitsMonth: null,
        walletPendingCents: walletPending,
      };
    });
  } catch (error) {
    console.error('[admin/contas] Failed to fetch admin clients', error);
    return [];
  }
}

export default async function AdminContasPage() {
  const clients = await fetchAdminClients();
  return <AdminClientsPage clients={clients} />;
}
