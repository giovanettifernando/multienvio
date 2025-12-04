"use client";

import React, { useState } from "react";
import Card from "antd/es/card";
import Typography from "antd/es/typography";
import { useRouter } from "next/navigation";
import { ELButton } from "@/components/ui/ELButton";
import { ELAlert } from "@/components/ui/ELAlert";
import BalanceCard from "@/components/wallet/BalanceCard";
import MonthlySummaryCard from "@/components/wallet/MonthlySummaryCard";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import ResolveDebtModal from "@/components/wallet/ResolveDebtModal";
import TransactionsTable from "@/components/wallet/TransactionsTable";
import { useWallet } from "@/hooks/useWallet";
import { useCards } from "@/hooks/useAccount";
import { PageShell } from "@/components/shared/PageShell";
import gridStyles from "@/components/ui/ELGrid.module.css";
import { cn } from "@/lib/utils/cn";

export default function CarteiraClient() {
  const [open, setOpen] = useState(false);
  const [resolveDebtOpen, setResolveDebtOpen] = useState(false);
  const { data, isLoading } = useWallet();
  const router = useRouter();
  const { data: cards } = useCards();

  return (
    <PageShell title="Carteira" gap="md">
      {(cards?.length ?? 0) === 0 ? (
        <ELAlert
          variant="info"
          title="Sem cartões cadastrados"
          description={
            <span>
              Cadastre um cartão para facilitar recargas.{" "}
              <Typography.Link onClick={() => router.push("/minha-conta#cards")}>
                Ir para Cartões
              </Typography.Link>
            </span>
          }
        />
      ) : null}

      <div className={cn(gridStyles.grid, gridStyles.grid2, gridStyles.gapXl)}>
        <BalanceCard
          onAddFunds={() => setOpen(true)}
          onResolveDebt={() => setResolveDebtOpen(true)}
        />
        {data?.monthlySummary && (
          <MonthlySummaryCard summary={data.monthlySummary} loading={isLoading} />
        )}
      </div>

      <Card
        title="Últimas transações"
        extra={
          <ELButton onClick={() => router.push("/carteira/extrato")}>
            Ver extrato completo
          </ELButton>
        }
      >
        <TransactionsTable />
      </Card>

      <AddFundsModal
        open={open}
        onClose={() => setOpen(false)}
      />

      <ResolveDebtModal
        open={resolveDebtOpen}
        onClose={() => setResolveDebtOpen(false)}
      />
    </PageShell>
  );
}
