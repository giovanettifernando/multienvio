"use client";

import { PageShell } from "@/components/shared/PageShell";
import { ELCard } from "@/components/ui/ELCard";
import PersonalForm from "@/components/account/PersonalForm";
import AccountTabs from "@/components/account/AccountTabs";
import gridStyles from "@/components/ui/ELGrid.module.css";
import { cn } from "@/lib/utils/cn";

export default function MinhaContaClient() {
  return (
    <PageShell title="Minha Conta" gap="lg">
      <div className={cn(gridStyles.grid, gridStyles.gridSidebar, gridStyles.gapXl)}>
        {/* Coluna Esquerda: Dados Pessoais */}
        <ELCard>
          <PersonalForm />
        </ELCard>

        {/* Coluna Direita: Abas (Endereços, Cartões, Destinatários, Segurança) */}
        <AccountTabs />
      </div>
    </PageShell>
  );
}
