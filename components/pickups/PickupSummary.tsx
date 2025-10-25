"use client";

import { Card, Descriptions } from "antd";
import type { CompanyWizardData } from "@/lib/validation/company";

type SummaryProps = {
  sender: CompanyWizardData;
  schedule?: {
    date?: string;
    windowStart?: string;
    windowEnd?: string;
    notes?: string;
  };
  totals: {
    count: number;
    weightKg: number;
    volumeCm3: number;
  };
};

export function PickupSummary({ sender, schedule, totals }: SummaryProps) {
  const address = sender.endereco;

  return (
    <Card title="Resumo" variant="borderless">
      <Descriptions column={1} size="small">
        <Descriptions.Item label="Origem">
          {`${address.logradouro}, ${address.numero}`}
          <br />
          {`${address.bairro} · ${address.cidade}/${address.uf}`}
        </Descriptions.Item>
        <Descriptions.Item label="Data">
          {schedule?.date ?? "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Janela">
          {schedule?.windowStart && schedule?.windowEnd
            ? `${schedule.windowStart} - ${schedule.windowEnd}`
            : "—"}
        </Descriptions.Item>
        <Descriptions.Item label="Envios">
          {totals.count}
        </Descriptions.Item>
        <Descriptions.Item label="Peso total">
          {`${totals.weightKg.toFixed(2)} kg`}
        </Descriptions.Item>
        <Descriptions.Item label="Volume total">
          {`${totals.volumeCm3.toFixed(0)} cm³`}
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}
