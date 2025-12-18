"use client";

import { useMemo, useState } from "react";
import { Skeleton, Typography, Statistic } from "antd";
import { WalletOutlined, PlusOutlined, ArrowDownOutlined } from "@ant-design/icons";
import AddFundsModal from '@/modules/wallet/ui/components/AddFundsModal';
import { useWallet } from "@/hooks/useWallet";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";
import { ELButton } from '@/shared/ui/ELButton';
import { ELCard } from '@/shared/ui/ELCard';
import { ELFlex } from '@/shared/ui/ELGrid';

const { Text } = Typography;

export function WalletCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: wallet, isLoading } = useWallet();
  const { data: txData } = useWalletTransactions({ limit: 30 });

  const last30DaysSpend = useMemo(() => {
    if (!txData?.transactions?.length) return 0;
    const thirtyDaysAgo = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
    return txData.transactions
      .filter((entry) => {
        const occurred = entry.confirmedAt ? new Date(entry.confirmedAt).getTime() : 0;
        return occurred >= thirtyDaysAgo && entry.direction === 'debit';
      })
      .reduce((acc, entry) => acc + Math.abs(entry.amountReais), 0);
  }, [txData]);

  const balance = wallet?.balance?.availableReais ?? 0;
  const isLowBalance = balance < 50;

  return (
    <>
      <AddFundsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <ELCard
        header={{
          title: (
            <ELFlex align="center" gap="sm">
              <WalletOutlined />
              <Text strong>Carteira</Text>
            </ELFlex>
          ),
        }}
        size="small"
        padding="md"
      >
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : wallet ? (
          <ELFlex direction="col" gap="md">
            <ELFlex justify="between" align="center" gap="md" wrap>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 11 }}>Saldo disponível</Text>}
                value={balance}
                precision={2}
                prefix="R$"
                styles={{ content: {
                  fontSize: 22,
                  fontWeight: 600,
                  color: isLowBalance ? 'var(--el-color-error, #D64545)' : 'var(--el-color-primary, #0B4EA3)',
                } }}
              />
              <ELFlex direction="col" align="end" gap="sm" style={{ minWidth: 0 }}>
                <ELFlex align="center" gap="sm">
                  <ArrowDownOutlined style={{ fontSize: 11, color: 'var(--el-color-error, #D64545)' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>30 dias</Text>
                </ELFlex>
                <Text strong style={{ fontSize: 13 }}>
                  R$ {last30DaysSpend.toFixed(2)}
                </Text>
                {isLowBalance && (
                  <Text type="danger" style={{ fontSize: 10 }}>
                    Saldo baixo
                  </Text>
                )}
              </ELFlex>
            </ELFlex>
            <ELButton
              variant="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              block
            >
              Adicionar créditos
            </ELButton>
          </ELFlex>
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Não foi possível carregar o saldo.
          </Text>
        )}
      </ELCard>
    </>
  );
}
