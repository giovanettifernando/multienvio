"use client";

import { Card, Descriptions, Space, Typography, Button } from "antd";
import type { CompanyWizardData } from "@/lib/validation/company";
import { getCompanyDisplayName } from "@/lib/validation/company";
import type {
  DestinatarioData,
  PacoteData,
  ServicoData,
} from "@/lib/validation/shipment";

type LabelPreviewProps = {
  sender?: CompanyWizardData | null;
  recipient?: DestinatarioData;
  packageData?: PacoteData;
  service?: ServicoData & { name?: string; carrier?: string };
  trackingCode?: string;
  pdfUrl?: string | null;
};

export function LabelPreview({
  sender,
  recipient,
  packageData,
  service,
  trackingCode,
  pdfUrl,
}: LabelPreviewProps) {
  const senderEndereco = sender?.endereco;
  const remetenteNome = sender ? getCompanyDisplayName(sender) : "";

  return (
    <Card
      title="Pré-visualização da etiqueta"
      variant="borderless"
      style={{ minWidth: 320 }}
    >
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Descriptions column={1} size="small" labelStyle={{ width: 120 }}>
          <Descriptions.Item label="Remetente">
            <Typography.Text strong>
              {remetenteNome || "Remetente"}
            </Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {senderEndereco
                ? `${senderEndereco.logradouro}, ${senderEndereco.numero}`
                : "Endereço do remetente"}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {senderEndereco
                ? `${senderEndereco.cidade}/${senderEndereco.uf}`
                : "Cidade/UF"}
            </Typography.Paragraph>
          </Descriptions.Item>

          <Descriptions.Item label="Destinatário">
            <Typography.Text strong>
              {recipient?.nome ?? "Nome do destinatário"}
            </Typography.Text>
            <Typography.Paragraph style={{ margin: 0 }}>
              {recipient
                ? `${recipient.logradouro}, ${recipient.numero}`
                : "Endereço"}
            </Typography.Paragraph>
            <Typography.Paragraph style={{ margin: 0 }} type="secondary">
              {recipient
                ? `${recipient.bairro} · ${recipient.cidade}/${recipient.uf}`
                : "Bairro · Cidade/UF"}
            </Typography.Paragraph>
          </Descriptions.Item>

          <Descriptions.Item label="Serviço">
            {service?.name ?? service?.serviceCode ?? "Selecione um serviço"}
            {service?.carrier ? ` · ${service.carrier}` : null}
          </Descriptions.Item>

          <Descriptions.Item label="Dimensões">
            {packageData
              ? `${packageData.comprimentoCm} x ${packageData.larguraCm} x ${packageData.alturaCm} cm · ${packageData.pesoKg} kg`
              : "Informe as dimensões do pacote"}
          </Descriptions.Item>

          <Descriptions.Item label="Código de rastreio">
            {trackingCode ?? "Será gerado após emissão"}
          </Descriptions.Item>
        </Descriptions>

        {pdfUrl ? (
          <Button type="primary" href={pdfUrl} target="_blank" rel="noopener">
            Abrir PDF da etiqueta
          </Button>
        ) : null}
      </Space>
    </Card>
  );
}
