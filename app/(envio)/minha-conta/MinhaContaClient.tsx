"use client";

import { PageShell } from "@/components/shared/PageShell";
import { Card } from "antd";
import PersonalForm from "@/components/account/PersonalForm";
import AccountTabs from "@/components/account/AccountTabs";
import styles from "./page.module.css";

export default function MinhaContaClient() {
  return (
    <PageShell title="Minha Conta" gap="lg">
      <div className={styles.accountLayout}>
        {/* Coluna Esquerda: Dados Pessoais */}
        <Card>
          <PersonalForm />
        </Card>

        {/* Coluna Direita: Abas (Endereços, Cartões, Destinatários, Segurança) */}
        <AccountTabs />
      </div>
    </PageShell>
  );
}
