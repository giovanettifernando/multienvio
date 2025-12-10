"use client";

import { useQuery } from "@tanstack/react-query";
import { Typography } from "antd";
import { ELSkeleton } from "@/components/ui/ELSkeleton";
import type { CompanyWizardData } from "@/lib/validation/company";
import type { Shipment } from "@/types/shipment";
import { PickupWizard } from "@/components/pickups/PickupWizard";
import { PageShell } from "@/components/shared/PageShell";

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
