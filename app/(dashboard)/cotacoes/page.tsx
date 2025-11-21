"use client";

import { useMemo, useEffect } from "react";
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

async function fetchCompany(): Promise<CompanyWizardData | null> {
  const res = await fetch("/api/account/company");
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const company = (data?.company ?? data) as CompanyWizardData | null;
  return company ?? null;
}

export default function CotacoesPage() {
  console.log('[COTACOES_PAGE] ========== COMPONENT RENDER ==========');

  const router = useRouter();
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["account", "company"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });

  const addresses = useAddressStore((s) => s.items);
  const reset = useQuoteStore((s) => s.reset);
  const clearDraft = useQuoteDraft((s) => s.clear);

  // Usar updatedAt do form como key para forçar remontagem quando o store for resetado
  const formKey = useQuoteStore((s) => s.form?.updatedAt || 'empty');

  console.log('[COTACOES_PAGE] Estado dos stores ANTES do useEffect:', JSON.stringify({
    quoteStore: useQuoteStore.getState().form ? {
      destinoCep: useQuoteStore.getState().form?.destinoCep,
      coleta: useQuoteStore.getState().form?.coleta,
      volumesCount: useQuoteStore.getState().form?.volumes?.length,
    } : null,
    quoteDraft: {
      destination: useQuoteDraft.getState().destination,
      pickupAtOrigin: useQuoteDraft.getState().pickupAtOrigin,
    },
    formKey,
  }, null, 2));

  // Limpar estado da cotação quando a página é montada
  // Isso garante que ao navegar para /cotacoes, sempre começamos com estado limpo
  useEffect(() => {
    console.log('[COTACOES_PAGE] EFFECT: ========== EXECUTANDO RESET ==========');

    // Verificar localStorage
    if (typeof window !== 'undefined') {
      console.log('[COTACOES_PAGE] EFFECT: localStorage ANTES do reset:', JSON.stringify({
        'quote-flow': localStorage.getItem('quote-flow'),
        'envio.quoteDraft.v1': localStorage.getItem('envio.quoteDraft.v1'),
      }, null, 2));
    }

    console.log('[COTACOES_PAGE] EFFECT: Estado ANTES do reset:', JSON.stringify({
      quoteStore: useQuoteStore.getState().form ? {
        destinoCep: useQuoteStore.getState().form?.destinoCep,
        coleta: useQuoteStore.getState().form?.coleta,
        volumesCount: useQuoteStore.getState().form?.volumes?.length,
      } : null,
      quoteDraft: {
        destination: useQuoteDraft.getState().destination,
        pickupAtOrigin: useQuoteDraft.getState().pickupAtOrigin,
      },
    }, null, 2));

    console.log('[COTACOES_PAGE] EFFECT: Chamando reset({ keepForm: false })...');
    reset({ keepForm: false });

    console.log('[COTACOES_PAGE] EFFECT: Estado APÓS reset (antes de clear draft):', JSON.stringify({
      quoteStore: useQuoteStore.getState().form ? {
        destinoCep: useQuoteStore.getState().form?.destinoCep,
        coleta: useQuoteStore.getState().form?.coleta,
        volumesCount: useQuoteStore.getState().form?.volumes?.length,
      } : null,
    }, null, 2));

    console.log('[COTACOES_PAGE] EFFECT: Chamando clearDraft()...');
    clearDraft();

    console.log('[COTACOES_PAGE] EFFECT: Estado FINAL após todos os resets:', JSON.stringify({
      quoteStore: useQuoteStore.getState().form ? {
        destinoCep: useQuoteStore.getState().form?.destinoCep,
        coleta: useQuoteStore.getState().form?.coleta,
        volumesCount: useQuoteStore.getState().form?.volumes?.length,
      } : null,
      quoteDraft: {
        destination: useQuoteDraft.getState().destination,
        pickupAtOrigin: useQuoteDraft.getState().pickupAtOrigin,
      },
    }, null, 2));

    // Verificar localStorage APÓS reset
    if (typeof window !== 'undefined') {
      console.log('[COTACOES_PAGE] EFFECT: localStorage APÓS reset:', JSON.stringify({
        'quote-flow': localStorage.getItem('quote-flow'),
        'envio.quoteDraft.v1': localStorage.getItem('envio.quoteDraft.v1'),
      }, null, 2));
    }

    console.log('[COTACOES_PAGE] EFFECT: ========== RESET CONCLUÍDO ==========');
  }, [reset, clearDraft]); // Executar na montagem (refs são estáveis)

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

  if (companyLoading) {
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
