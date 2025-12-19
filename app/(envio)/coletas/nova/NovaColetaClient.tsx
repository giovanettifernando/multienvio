"use client";

import { useQuery } from "@tanstack/react-query";
import { ELTypography } from '@/shared/ui';
const Typography = ELTypography;
import { ELSkeleton } from '@/shared/ui/ELSkeleton';
import type { CompanyWizardData } from '@/shared/validation/company';
import type { Shipment } from '@/shared/types/shipment';
import { PickupWizard } from "@/modules/pickup-points/ui/components/PickupWizard";
import { PageShell } from '@/shared/ui/PageShell';

async function fetchCompany(): Promise<CompanyWizardData | null> {
  const response = await fetch("/api/account/company");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados da empresa");
  }
  const payload = await response.json();
  return payload.company ?? null;
}

async function fetchShipments(): Promise<Shipment[]> {
  const response = await fetch("/api/shipments");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os envios");
  }
  const payload = await response.json();
  return payload.dados ?? [];
}

export default function NovaColetaClient() {
  const companyQuery = useQuery({
    queryKey: ["company"],
    queryFn: fetchCompany,
  });

  const shipmentsQuery = useQuery({
    queryKey: ["shipments", "pickup"],
    queryFn: fetchShipments,
  });

  const company = companyQuery.data;
  const shipments = shipmentsQuery.data ?? [];

  return (
    <PageShell title="Solicitar coleta" gap="md">
      {companyQuery.isLoading || shipmentsQuery.isLoading ? (
        <ELSkeleton lines={6} />
      ) : !company ? (
        <Typography.Text>
          Complete o cadastro de remetente antes de solicitar coletas.
        </Typography.Text>
      ) : (
        <PickupWizard sender={company} shipments={shipments} />
      )}
    </PageShell>
  );
}
