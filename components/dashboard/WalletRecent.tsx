'use client';

import { Card, List, Typography, Tag, Skeleton, Empty, Button, Flex } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  DollarOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { WalletTx } from '@/types/wallet';

const { Text } = Typography;

async function fetchWalletTransactions(): Promise<WalletTx[]> {
  const response = await fetch('/api/wallet/transactions?limit=5');
  if (!response.ok) {
    throw new Error('Failed to fetch transactions');
  }
  const data = await response.json();
  return data.transactions || [];
}

function getTxIcon(type: WalletTx['type']) {
  switch (type) {
    case 'TOPUP':
      return <ArrowDownOutlined style={{ color: '#52c41a' }} />;
    case 'PURCHASE':
      return <ArrowUpOutlined style={{ color: '#ff4d4f' }} />;
    case 'REFUND':
      return <ArrowDownOutlined style={{ color: '#1890ff' }} />;
    case 'WITHDRAW':
      return <ArrowUpOutlined style={{ color: '#faad14' }} />;
    default:
      return <DollarOutlined />;
  }
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

function getStatusColor(status: WalletTx['status']): string {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'PENDING':
      return 'processing';
    case 'FAILED':
      return 'error';
    case 'CANCELED':
      return 'default';
    default:
      return 'default';
  }
}

export function WalletRecent() {
  const router = useRouter();
  const { data: transactions, isLoading } = useQuery({
    queryKey: ['wallet-transactions-recent'],
    queryFn: fetchWalletTransactions,
    staleTime: 90_000,
  });

  if (isLoading) {
    return (
      <Card title="Transações Recentes" variant="outlined">
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card title="Transações Recentes" variant="outlined">
        <Empty description="Nenhuma transação encontrada" />
      </Card>
    );
  }

  return (
    <Card
      title="Transações Recentes"
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
        renderItem={(tx) => (
          <List.Item>
            <Flex justify="space-between" align="center" style={{ width: '100%' }} gap={12}>
              <Flex align="center" gap={12} style={{ flex: 1, minWidth: 0 }}>
                {getTxIcon(tx.type)}
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
              </Flex>

              <Flex vertical align="end" gap={4}>
                <Text
                  strong
                  style={{
                    color: tx.type === 'TOPUP' || tx.type === 'REFUND' ? '#52c41a' : '#ff4d4f',
                    fontSize: '14px',
                  }}
                >
                  {tx.type === 'TOPUP' || tx.type === 'REFUND' ? '+' : '-'}R${' '}
                  {Math.abs(tx.amountReais).toFixed(2)}
                </Text>
                <Tag color={getStatusColor(tx.status)} style={{ margin: 0, fontSize: '10px' }}>
                  {tx.status}
                </Tag>
              </Flex>
            </Flex>
          </List.Item>
        )}
      />
    </Card>
  );
}
