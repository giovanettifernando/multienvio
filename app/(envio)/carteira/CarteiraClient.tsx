"use client";

import React, { useState } from "react";
import { ELCard } from '@/shared/ui/ELCard';
import { Typography } from 'antd';
import { useRouter } from "next/navigation";
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import BalanceCard from '@/modules/wallet/ui/components/BalanceCard';
import MonthlySummaryCard from '@/modules/wallet/ui/components/MonthlySummaryCard';
import AddFundsModal from '@/modules/wallet/ui/components/AddFundsModal';
import ResolveDebtModal from '@/modules/wallet/ui/components/ResolveDebtModal';
import TransactionsTable from '@/modules/wallet/ui/components/TransactionsTable';
import { useWallet } from "@/hooks/useWallet";
import { useCards } from "@/hooks/useAccount";
import { PageShell } from '@/shared/ui/PageShell';
import gridStyles from "@/shared/ui/ELGrid.module.css";
import { cn } from "@/shared/utils/cn";

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

      <ELCard
        header={{
          title: "Últimas transações",
          extra: (
            <ELButton onClick={() => router.push("/carteira/extrato")}>
              Ver extrato completo
            </ELButton>
          ),
        }}
      >
        <TransactionsTable />
      </ELCard>

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
