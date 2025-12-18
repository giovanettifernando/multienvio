'use client';

import { Typography, Skeleton, Divider } from 'antd';
import { SwapOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';
import type { WalletTx } from '@/types/wallet';
import { ELButton } from '@/components/ui/ELButton';
import { ELCard } from '@/components/ui/ELCard';
import { ELFlex } from '@/components/ui/ELGrid';
import { ELEmpty } from '@/components/ui/ELEmpty';

const { Text } = Typography;

async function fetchWalletTransactions(): Promise<WalletTx[]> {
  const data = await apiFetch<{ transactions: WalletTx[] }>('/api/wallet/transactions?limit=5');
  return data.transactions || [];
}

function getTxLabel(type: WalletTx['type']): string {
  switch (type) {
    case 'TOPUP':
      return 'Recarga';
    case 'PURCHASE':
      return 'Compra';
    case 'REFUND':
      return 'Estorno';
    case 'WITHDRAW':
      return 'Saque';
    case 'ADJUSTMENT':
      return 'Ajuste';
    default:
      return type;
  }
}

// Crédito: TOPUP, REFUND, ADJUSTMENT
// Débito: PURCHASE, WITHDRAW
function isCredit(type: WalletTx['type']): boolean {
  return type === 'TOPUP' || type === 'REFUND' || type === 'ADJUSTMENT';
}

export function WalletRecent() {
  const router = useRouter();
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['wallet-transactions-recent'],
    queryFn: fetchWalletTransactions,
    staleTime: 90_000,
  });

  const cardTitle = (
    <ELFlex align="center" gap="sm">
      <SwapOutlined />
      <Text strong>Transações</Text>
    </ELFlex>
  );

  if (isLoading) {
    return (
      <ELCard header={{ title: cardTitle }} style={{ height: '100%' }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </ELCard>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <ELCard header={{ title: cardTitle }} style={{ height: '100%' }}>
        <ELEmpty description="Nenhuma transação encontrada" />
      </ELCard>
    );
  }

  return (
    <ELCard
      style={{ height: '100%' }}
      header={{
        title: cardTitle,
        extra: (
          <ELButton
            variant="link"
            size="small"
            icon={<RightOutlined />}
            onClick={() => router.push('/carteira/extrato')}
          >
            Todas
          </ELButton>
        ),
      }}
    >
      <ELFlex direction="col" gap="sm">
        {transactions.map((tx, index) => {
          const credit = isCredit(tx.type);
          return (
            <div key={tx.id || index}>
              {index > 0 && <Divider style={{ margin: '8px 0' }} />}
              <ELFlex justify="between" align="center" style={{ width: '100%' }} gap="md">
                <ELFlex direction="col" style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ fontSize: '13px' }}>
                    {getTxLabel(tx.type)}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '11px' }} ellipsis>
                    {tx.title || 'Sem descrição'}
                  </Text>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {new Date(tx.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </ELFlex>

                <Text
                  strong
                  style={{
                    color: credit ? 'var(--el-color-success, #11693F)' : 'var(--el-color-error, #D64545)',
                    fontSize: '14px',
                  }}
                >
                  {credit ? '+' : '-'}R$ {Math.abs(tx.amountReais).toFixed(2)}
                </Text>
              </ELFlex>
            </div>
          );
        })}
      </ELFlex>
    </ELCard>
  );
}
