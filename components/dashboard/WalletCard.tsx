"use client";

import { useMemo, useState } from "react";
import { Button, Card, Skeleton, Space, Typography } from "antd";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import { useWallet, useWalletInvalidate } from "@/hooks/useWallet";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";
import { formatCurrencyBRL } from "@/lib/format";

export function WalletCard() {
  const [modalOpen, setModalOpen] = useState(false);
  const invalidateWallet = useWalletInvalidate();
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

  const lastUpdate = txData?.transactions[0]?.confirmedAt;

  return (
    <>
      <AddFundsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCardTopupSuccess={invalidateWallet}
      />
      <Card
        title="Carteira e créditos"
        variant="outlined"
        styles={{ body: { paddingTop: 0 } }}
        extra={
          <Button type="primary" variant="solid" onClick={() => setModalOpen(true)}>
            Adicionar créditos
          </Button>
        }
      >
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : wallet ? (
          <Space direction="vertical" size={8}>
            <Typography.Text type="secondary">Saldo disponível</Typography.Text>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {formatCurrencyBRL(wallet.balance.availableReais)}
            </Typography.Title>
            <Typography.Text type={wallet.balance.availableReais < 50 ? "danger" : "secondary"}>
              {wallet.balance.availableReais < 50
                ? "Saldo baixo — recarregue para continuar emitindo etiquetas."
                : lastUpdate
                  ? `Atualizado em ${new Date(lastUpdate).toLocaleString("pt-BR")}`
                  : "Sem movimentações recentes"}
            </Typography.Text>
            <Typography.Text type="secondary">
              Gasto nos últimos 30 dias:{" "}
              <Typography.Text strong>
                {formatCurrencyBRL(last30DaysSpend)}
              </Typography.Text>
            </Typography.Text>
          </Space>
        ) : (
          <Typography.Text type="secondary">
            Não foi possível carregar o saldo. Tente novamente mais tarde.
          </Typography.Text>
        )}
      </Card>
    </>
  );
}
