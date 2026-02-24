'use client';

import { useState } from 'react';
import { Typography, Skeleton, Divider, Statistic, Flex } from 'antd';
import { ELCard } from '@/shared/ui/ELCard';
import {
  WalletOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/shared/utils/api-fetch';
import type { WalletTx } from '@/shared/types/wallet';
import { useWallet } from '@/modules/wallet/ui/hooks';
import AddFundsModal from '@/modules/wallet/ui/components/AddFundsModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELFlex } from '@/shared/ui/ELGrid';
import { ELEmpty } from '@/shared/ui/ELEmpty';
import { formatBRL } from '@/shared/utils/format';

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

function isCredit(type: WalletTx['type']): boolean {
  return type === 'TOPUP' || type === 'REFUND' || type === 'ADJUSTMENT';
}

export function WalletUnified() {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const { data: wallet, isLoading: walletLoading } = useWallet();

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['wallet-transactions-recent'],
    queryFn: fetchWalletTransactions,
    staleTime: 90_000,
  });

  const balance = wallet?.balance?.availableReais ?? 0;
  const isLowBalance = balance < 50;
  const isLoading = walletLoading || txLoading;

  const cardTitle = (
    <Flex align="center" gap={8}>
      <WalletOutlined />
      <Text strong>Carteira</Text>
    </Flex>
  );

  if (isLoading) {
    return (
      <ELCard header={{ title: cardTitle }} size="small" padding="md">
        <Skeleton active paragraph={{ rows: 4 }} />
      </ELCard>
    );
  }

  return (
    <>
      <AddFundsModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ELCard header={{ title: cardTitle }} size="small" padding="md">
        <ELFlex direction="col" gap="sm">
          {/* Saldo */}
          {wallet ? (
            <Flex justify="space-between" align="center">
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 11 }}>Saldo disponível</Text>}
                value={balance}
                formatter={(value) => formatBRL(Number(value))}
                styles={{
                  content: {
                    fontSize: 20,
                    fontWeight: 600,
                    color: isLowBalance ? 'var(--el-color-error, #D64545)' : 'var(--el-color-primary, #0B4EA3)',
                  },
                }}
              />
              <ELButton
                variant="primary"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => setModalOpen(true)}
              >
                Adicionar créditos
              </ELButton>
            </Flex>
          ) : (
            <Text type="secondary" style={{ fontSize: 13 }}>
              Não foi possível carregar o saldo.
            </Text>
          )}

          <Divider style={{ margin: '4px 0' }} />

          {/* Transações recentes */}
          <ELFlex justify="between" align="center">
            <Text type="secondary" style={{ fontSize: 12 }}>Últimas transações</Text>
            <ELButton
              variant="link"
              size="small"
              icon={<RightOutlined />}
              onClick={() => router.push('/carteira/extrato')}
            >
              Todas
            </ELButton>
          </ELFlex>

          {!transactions || transactions.length === 0 ? (
            <ELEmpty description="Nenhuma transação encontrada" />
          ) : (
            <ELFlex direction="col" style={{ gap: 4 }}>
              {transactions.map((tx, index) => {
                const credit = isCredit(tx.type);
                return (
                  <div key={tx.id || index}>
                    {index > 0 && <Divider style={{ margin: '2px 0' }} />}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong style={{ fontSize: '12px', width: 55, flexShrink: 0 }}>
                          {getTxLabel(tx.type)}
                        </Text>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          {new Date(tx.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                          })}
                        </Text>
                      </div>
                      <Text
                        strong
                        style={{
                          color: credit ? 'var(--el-color-success, #11693F)' : 'var(--el-color-error, #D64545)',
                          fontSize: '13px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {credit ? '+' : '-'}{formatBRL(Math.abs(tx.amountReais))}
                      </Text>
                    </div>
                  </div>
                );
              })}
            </ELFlex>
          )}
        </ELFlex>
      </ELCard>
    </>
  );
}
