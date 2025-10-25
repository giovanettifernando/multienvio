"use client";

import { useMemo } from "react";
import { Card, Flex, Skeleton, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import type { CompanyWizardData } from "@/lib/validation/company";
import { QuoteForm } from "@/components/quote/QuoteForm";
import { useAddressStore } from "@/lib/state/addresses";
import { maskCEP } from "@/lib/masks";

async function fetchCompany(): Promise<CompanyWizardData | null> {
  const res = await fetch("/api/account/company");
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const company = (data?.company ?? data) as CompanyWizardData | null;
  return company ?? null;
}

export default function CotacoesPage() {
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["account", "company"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });

  const addresses = useAddressStore((s) => s.items);

  const defaultOrigin = useMemo(() => {
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
      <Flex vertical gap={24}>
        <Card variant="borderless">
          <Skeleton active />
        </Card>
      </Flex>
    );
  }

  if (!company) {
    return (
      <Flex vertical gap={24}>
        <Card variant="borderless">
          <Typography.Title level={4} style={{ marginTop: 0 }}>
            Complete o cadastro
          </Typography.Title>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
            Para cotar frete, finalize as informações da sua empresa na sua conta.
          </Typography.Paragraph>
          <Typography.Link href="/minha-conta">
            Ir para Minha Conta
          </Typography.Link>
        </Card>
      </Flex>
    );
  }

  return (
    <Flex vertical gap={24}>
      <QuoteForm defaultOrigin={defaultOrigin} />
    </Flex>
  );
}
