"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { CompanyWizardData } from "@/lib/validation/company";
import { QuoteForm } from "@/components/quote/QuoteForm";
import { useAddressStore, getCompanyDefaultAddress } from "@/lib/state/addresses";
import { maskCEP } from "@/lib/masks";
import { ELCard } from "@/components/ui/ELCard";
import { ELSkeleton } from "@/components/ui/ELSkeleton";
import { ELEmpty } from "@/components/ui/ELEmpty";
import { PageShell } from "@/components/shared/PageShell";
import { useQuoteStore } from "@/store/useQuoteStore";
import { useQuoteDraft } from "@/lib/state/quoteDraft";
import { useCanQuote } from "@/hooks/useWalletStatus";
import ResolveDebtModal from "@/components/wallet/ResolveDebtModal";
import { formatNumberBR } from "@/lib/format";

async function fetchCompany(): Promise<CompanyWizardData | null> {
  const res = await fetch("/api/account/company");
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const company = (data?.company ?? data) as CompanyWizardData | null;
  return company ?? null;
}

export default function CotacoesClient() {
  const router = useRouter();
  const [resolveDebtOpen, setResolveDebtOpen] = useState(false);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["account", "company"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });

  // Verificar se o usuário pode cotar (não tem saldo negativo)
  const { canQuote, isLoading: walletLoading, negativeAmountReais } = useCanQuote();

  const addresses = useAddressStore((s) => s.items);
  const reset = useQuoteStore((s) => s.reset);
  const clearDraft = useQuoteDraft((s) => s.clear);
  const hasHydrated = useQuoteStore((s) => s._hasHydrated);

  // Usar updatedAt do form como key para forçar remontagem quando o store for resetado
  const formKey = useQuoteStore((s) => s.form?.updatedAt || 'empty');

  // Ref para garantir que a lógica de reset/preserve execute apenas uma vez
  // (React Strict Mode executa useEffect duas vezes em desenvolvimento)
  const hasInitialized = useRef(false);

  // Limpar estado da cotação quando a página é montada E o store já hidratou
  // EXCETO se o usuário está voltando de /cotacoes/finalizar (preserveQuoteState em sessionStorage)
  useEffect(() => {
    // Aguardar hidratação do store antes de decidir se reseta
    if (!hasHydrated) {
      return;
    }

    // Evitar execução dupla (React Strict Mode)
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    // Verificar se devemos preservar o estado (usuário voltando de /cotacoes/finalizar)
    const shouldPreserve = sessionStorage.getItem("preserveQuoteState") === "1";

    if (shouldPreserve) {
      // Limpar a flag para próximas navegações
      sessionStorage.removeItem("preserveQuoteState");
      return; // Não resetar o estado
    }

    reset({ keepForm: false });
    clearDraft();
  }, [reset, clearDraft, hasHydrated]);

  const defaultOrigin = useMemo(() => {
    const companyAddress = getCompanyDefaultAddress();
    if (companyAddress?.cep) {
      return {
        cep: maskCEP(companyAddress.cep),
        cidade: companyAddress.cidade,
        uf: companyAddress.uf,
        label: companyAddress.nome,
        isDefault: true,
      };
    }

    if (!addresses?.length) return null;
    const candidate = addresses.find((addr) => addr.isDefault) ?? addresses[0];
    if (!candidate) return null;
    return {
      cep: maskCEP(candidate.cep),
      cidade: candidate.cidade,
      uf: candidate.uf,
      label: candidate.apelido,
      isDefault: Boolean(candidate.isDefault),
    };
  }, [addresses]);

  if (companyLoading || walletLoading || !hasHydrated) {
    return (
      <PageShell
        title="Cotar envio"
        description="Compare serviços e crie etiquetas de forma rápida com os dados da sua empresa."
      >
        <ELCard>
          <ELSkeleton active paragraph={{ rows: 4 }} />
        </ELCard>
      </PageShell>
    );
  }

  // Bloqueio por saldo negativo
  if (!canQuote) {
    return (
      <PageShell
        title="Cotar envio"
        description="Compare serviços e crie etiquetas de forma rápida com os dados da sua empresa."
      >
        <ELCard>
          <ELEmpty
            title="Pendências financeiras"
            description={`Você possui um saldo negativo de R$ ${formatNumberBR(negativeAmountReais)} que precisa ser regularizado para continuar cotando envios.`}
            primaryAction={{
              label: "Resolver pendências",
              onClick: () => setResolveDebtOpen(true),
            }}
            secondaryAction={{
              label: "Ir para Carteira",
              onClick: () => router.push("/carteira"),
            }}
          />
        </ELCard>
        <ResolveDebtModal
          open={resolveDebtOpen}
          onClose={() => setResolveDebtOpen(false)}
        />
      </PageShell>
    );
  }

  if (!company) {
    return (
      <PageShell
        title="Cotar envio"
        description="Compare serviços e crie etiquetas de forma rápida com os dados da sua empresa."
      >
        <ELCard>
          <ELEmpty
            title="Complete o cadastro"
            description="Para cotar frete, finalize as informações da sua empresa na sua conta."
            primaryAction={{
              label: "Ir para Minha Conta",
              onClick: () => router.push("/minha-conta"),
            }}
          />
        </ELCard>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Cotar envio"
      description="Compare serviços e crie etiquetas de forma rápida com os dados da sua empresa."
    >
      <ELCard>
        <QuoteForm key={formKey} defaultOrigin={defaultOrigin} />
      </ELCard>
    </PageShell>
  );
}
