"use client";

import { PageShell } from "@/components/shared/PageShell";
import { Card, Space } from "antd";
import PersonalForm from "@/components/account/PersonalForm";
import AccountTabs from "@/components/account/AccountTabs";

export default function MinhaContaPage() {
  return (
    <PageShell title="Minha Conta" gap="lg">
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {/* Dados Pessoais - sempre visível */}
        <Card>
          <PersonalForm />
        </Card>

        {/* Abas: Endereços, Cartões, Destinatários, Segurança */}
        <AccountTabs />
      </Space>
    </PageShell>
  );
}
