"use client";

import {
  CarOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { ELCard, ELSpace, ELSpin, ELSwitch, ELTypography } from '@/shared/ui';
const Card = ELCard;
const Space = ELSpace;
const Spin = ELSpin;
const Switch = ELSwitch;
const Typography = ELTypography;

type PickupFeeInfo = {
  collectorName: string;
  distanceKm: number;
  feeAmount: number;
};

type LabelPreviewProps = {
  carrier: string;
  modalidade: string;
  prazoDias: number;
  preco: number;
  pickupFee?: PickupFeeInfo | null;
  isLoadingPickupFee?: boolean;
  /** Se true, mostra o toggle de pagamento pelo destinatario */
  showRecipientPaysToggle?: boolean;
  /** Valor do toggle */
  recipientPays?: boolean;
  /** Handler para mudanca do toggle */
  onRecipientPaysChange?: (checked: boolean) => void;
  /** Conteúdo extra no rodapé do card (ex.: campo de seguro, que altera o preço). */
  footer?: React.ReactNode;
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function LabelPreview({
  carrier,
  modalidade,
  prazoDias,
  preco,
  pickupFee,
  isLoadingPickupFee = false,
  showRecipientPaysToggle = false,
  recipientPays = false,
  onRecipientPaysChange,
  footer,
}: LabelPreviewProps) {
  const hasPickupFee = pickupFee && pickupFee.feeAmount > 0;
  const total = hasPickupFee ? preco + pickupFee.feeAmount : preco;

  const cardTitle = showRecipientPaysToggle ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <span>Resumo do servico</span>
      <Space size={8}>
        <Switch
          size="small"
          checked={recipientPays}
          onChange={onRecipientPaysChange}
        />
        <Typography.Text style={{ fontSize: 12, fontWeight: 400 }}>
          Destinatario paga o frete
        </Typography.Text>
      </Space>
    </div>
  ) : "Resumo do servico";

  return (
    <Card
      size="small"
      // ELCard ignora a prop `title` do Ant Design (faz title={undefined} e
      // monta o cabeçalho a partir de `header`). Enquanto isto passava por
      // `title`, o cabeçalho inteiro — incluindo o interruptor "Destinatário
      // paga o frete" — era silenciosamente descartado e nunca chegava à tela.
      header={{ title: cardTitle }}
      style={{
        background: "#f6ffed",
        borderColor: "#b7eb8f",
      }}
      styles={{ body: { padding: "12px 16px" } }}
    >
      <Space orientation="vertical" size={8} style={{ width: "100%" }}>
        {/* Transportadora e Modalidade */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Space size={6}>
            <TruckOutlined style={{ fontSize: 16, color: "#52c41a" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>{carrier}</strong>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                {" "}• {modalidade}
              </Typography.Text>
            </Typography.Text>
          </Space>

          <Space size={6}>
            <ClockCircleOutlined style={{ fontSize: 16, color: "#1890ff" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>Prazo:</strong>{" "}
              {prazoDias === 1 ? "1 dia útil" : `${prazoDias} dias úteis`}
            </Typography.Text>
          </Space>
        </div>

        {/* Preço e Total */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
          <Space size={6}>
            <DollarOutlined style={{ fontSize: 16, color: "#52c41a" }} />
            <Typography.Text style={{ fontSize: 14 }}>
              <strong>Frete:</strong> {currency.format(preco)}
            </Typography.Text>
          </Space>

          {isLoadingPickupFee && (
            <Space size={6}>
              <Spin size="small" />
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Calculando coleta...
              </Typography.Text>
            </Space>
          )}

          {!isLoadingPickupFee && hasPickupFee && (
            <Space size={6}>
              <CarOutlined style={{ fontSize: 16, color: "#fa8c16" }} />
              <Typography.Text style={{ fontSize: 14 }}>
                <strong>Coleta:</strong> {currency.format(pickupFee.feeAmount)}
              </Typography.Text>
            </Space>
          )}

          {!isLoadingPickupFee && hasPickupFee && (
            <Typography.Text strong style={{ fontSize: 15, color: "#1890ff", marginLeft: "auto" }}>
              Total: {currency.format(total)}
            </Typography.Text>
          )}
        </div>

        {/* Espaço para conteúdo que altera o preço acima — hoje o campo de
            seguro. Fica dentro deste card, e não como card próprio, porque a
            grade da tela de finalizar tem colunas fixas: um quarto card
            espremia o de pagamento. */}
        {footer}
      </Space>
    </Card>
  );
}
