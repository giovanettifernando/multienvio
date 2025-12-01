"use client";

import React, { useState } from "react";
import { Alert, Card, Typography, Row, Col, Button } from "antd";
import { useRouter } from "next/navigation";
import BalanceCard from "@/components/wallet/BalanceCard";
import MonthlySummaryCard from "@/components/wallet/MonthlySummaryCard";
import AddFundsModal from "@/components/wallet/AddFundsModal";
import ResolveDebtModal from "@/components/wallet/ResolveDebtModal";
import TransactionsTable from "@/components/wallet/TransactionsTable";
import { useWallet } from "@/hooks/useWallet";
import { useCards } from "@/hooks/useAccount";
import { PageShell } from "@/components/shared/PageShell";

export default function CarteiraPage() {
  const [open, setOpen] = useState(false);
  const [resolveDebtOpen, setResolveDebtOpen] = useState(false);
  const { data, isLoading } = useWallet();
  const router = useRouter();
  const { data: cards } = useCards();

  return (
    <PageShell title="Carteira" gap="md">
      {(cards?.length ?? 0) === 0 ? (
        <Alert
          type="info"
          showIcon
          message="Sem cartões cadastrados"
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

      <Row gutter={[24, 16]}>
        <Col xs={24} lg={12}>
          <BalanceCard
            onAddFunds={() => setOpen(true)}
            onResolveDebt={() => setResolveDebtOpen(true)}
          />
        </Col>
        <Col xs={24} lg={12}>
          {data?.monthlySummary && (
            <MonthlySummaryCard summary={data.monthlySummary} loading={isLoading} />
          )}
        </Col>
      </Row>

      <Card
        title="Últimas transações"
        extra={
          <Button onClick={() => router.push("/carteira/extrato")}>
            Ver extrato completo
          </Button>
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
