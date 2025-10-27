"use client";

import { useMemo } from "react";
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

async function fetchCompany(): Promise<CompanyWizardData | null> {
  const res = await fetch("/api/account/company");
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const company = (data?.company ?? data) as CompanyWizardData | null;
  return company ?? null;
}

export default function CotacoesPage() {
  const router = useRouter();
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["account", "company"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });

  const addresses = useAddressStore((s) => s.items);

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
      <ELCard
        header={{
          title: "Detalhes da cotação",
          description:
            "Informe origem e destino para receber as melhores opções de envio.",
        }}
      >
        <QuoteForm defaultOrigin={defaultOrigin} />
      </ELCard>
    </PageShell>
  );
}
