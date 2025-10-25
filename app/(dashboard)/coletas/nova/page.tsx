"use client";

import { useQuery } from "@tanstack/react-query";
import { Flex, Skeleton, Typography } from "antd";
import type { CompanyWizardData } from "@/lib/validation/company";
import type { Shipment } from "@/types/shipment";
import { PickupWizard } from "@/components/pickups/PickupWizard";

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

export default function NovaColetaPage() {
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
    <Flex vertical gap={24}>
      <Typography.Title level={2} style={{ margin: 0 }}>
        Solicitar coleta
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
        Agende a retirada dos seus envios com poucos passos.
      </Typography.Paragraph>

      {companyQuery.isLoading || shipmentsQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : !company ? (
        <Typography.Text>
          Complete o cadastro de remetente antes de solicitar coletas.
        </Typography.Text>
      ) : (
        <PickupWizard sender={company} shipments={shipments} />
      )}
    </Flex>
  );
}
