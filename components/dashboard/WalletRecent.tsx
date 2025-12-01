'use client';

import { Card, List, Typography, Skeleton, Empty, Button, Flex } from 'antd';
import { SwapOutlined, RightOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/utils/api-fetch';
import type { WalletTx } from '@/types/wallet';

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
    <Flex align="center" gap={8}>
      <SwapOutlined />
      <Text strong>Transações Recentes</Text>
    </Flex>
  );

  if (isLoading) {
    return (
      <Card title={cardTitle} variant="outlined">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card title={cardTitle} variant="outlined">
        <Empty description="Nenhuma transação encontrada" />
      </Card>
    );
  }

  return (
    <Card
      title={cardTitle}
      variant="outlined"
      extra={
        <Button
          type="link"
          size="small"
          icon={<RightOutlined />}
          onClick={() => router.push('/carteira/historico')}
        >
          Ver todas
        </Button>
      }
    >
      <List
        size="small"
        dataSource={transactions}
        renderItem={(tx) => {
          const credit = isCredit(tx.type);
          return (
            <List.Item>
              <Flex justify="space-between" align="center" style={{ width: '100%' }} gap={12}>
                <Flex vertical style={{ flex: 1, minWidth: 0 }}>
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
                </Flex>

                <Text
                  strong
                  style={{
                    color: credit ? '#52c41a' : '#ff4d4f',
                    fontSize: '14px',
                  }}
                >
                  {credit ? '+' : '-'}R$ {Math.abs(tx.amountReais).toFixed(2)}
                </Text>
              </Flex>
            </List.Item>
          );
        }}
      />
    </Card>
  );
}
