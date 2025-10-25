"use client";

import React, { useState } from "react";
import { Alert, Card, Typography } from "antd";
import { useRouter } from "next/navigation";
import BalanceCard from "@/components/wallet/BalanceCard";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import TransactionsTable from "@/components/wallet/TransactionsTable";
import { useWalletInvalidate } from "@/hooks/useWallet";
import { useCards } from "@/hooks/useAccount";

export default function CarteiraPage() {
  const [open, setOpen] = useState(false);
  const invalidate = useWalletInvalidate();
  const router = useRouter();
  const { data: cards } = useCards();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {(cards?.length ?? 0) === 0 ? (
        <Alert
          type="info"
          showIcon
          message="Sem cartões cadastrados"
          description={
            <span>
              Cadastre um cartão para facilitar recargas. {" "}
              <Typography.Link onClick={() => router.push("/minha-conta#cards")}>
                Ir para Cartões
              </Typography.Link>
            </span>
          }
        />
      ) : null}

      <BalanceCard onAddFunds={() => setOpen(true)} />

      <Card
        title="Últimas transações"
        extra={<Typography.Link onClick={() => router.push("/carteira/extrato")}>Ver extrato</Typography.Link>}
      >
        <TransactionsTable />
      </Card>

      <AddFundsModal
        open={open}
        onClose={() => setOpen(false)}
        onCardTopupSuccess={invalidate}
      />
    </div>
  );
}
