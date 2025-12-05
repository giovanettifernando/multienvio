"use client";

import { useMemo, useState } from "react";
import { Button, Card, Skeleton, Flex, Typography, Statistic } from "antd";
import { WalletOutlined, PlusOutlined, ArrowDownOutlined } from "@ant-design/icons";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import { useWallet } from "@/hooks/useWallet";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";

const { Text } = Typography;

export function WalletCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: wallet, isLoading } = useWallet();
  const { data: txData } = useWalletTransactions({ limit: 30 });

  const last30DaysSpend = useMemo(() => {
    if (!txData?.transactions.length) return 0;
    const thirtyDaysAgo = new Date().getTime() - 30 * 24 * 60 * 60 * 1000;
    return txData.transactions
      .filter((entry) => {
        const occurred = entry.confirmedAt ? new Date(entry.confirmedAt).getTime() : 0;
        return occurred >= thirtyDaysAgo && entry.direction === 'debit';
      })
      .reduce((acc, entry) => acc + Math.abs(entry.amountReais), 0);
  }, [txData]);

  const balance = wallet?.balance.availableReais ?? 0;
  const isLowBalance = balance < 50;

  return (
    <>
      <AddFundsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
      <Card
        title={
          <Flex align="center" gap={8}>
            <WalletOutlined />
            <Text strong>Carteira</Text>
          </Flex>
        }
        variant="outlined"
        size="small"
        styles={{ body: { padding: '12px 16px' } }}
      >
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 1 }} />
        ) : wallet ? (
          <Flex vertical gap={12}>
            <Flex justify="space-between" align="center" gap={12} wrap="wrap">
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 11 }}>Saldo disponível</Text>}
                value={balance}
                precision={2}
                prefix="R$"
                styles={{ content: {
                  fontSize: 22,
                  fontWeight: 600,
                  color: isLowBalance ? '#ff4d4f' : '#003873',
                } }}
              />
              <Flex vertical align="end" gap={2} style={{ minWidth: 0 }}>
                <Flex align="center" gap={4}>
                  <ArrowDownOutlined style={{ fontSize: 11, color: '#ff4d4f' }} />
                  <Text type="secondary" style={{ fontSize: 11 }}>30 dias</Text>
                </Flex>
                <Text strong style={{ fontSize: 13 }}>
                  R$ {last30DaysSpend.toFixed(2)}
                </Text>
                {isLowBalance && (
                  <Text type="danger" style={{ fontSize: 10 }}>
                    Saldo baixo
                  </Text>
                )}
              </Flex>
            </Flex>
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => setModalOpen(true)}
              block
            >
              Adicionar créditos
            </Button>
          </Flex>
        ) : (
          <Text type="secondary" style={{ fontSize: 13 }}>
            Não foi possível carregar o saldo.
          </Text>
        )}
      </Card>
    </>
  );
}
