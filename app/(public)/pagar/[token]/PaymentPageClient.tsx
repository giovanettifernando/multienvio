"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ELApp,
  ELDivider,
  ELResult,
  ELSpace,
  ELTypography,
  ELAlert,
  ELButton,
  ELCard,
  ELSkeleton,
} from "@/shared/ui";
const App = ELApp;
const Divider = ELDivider;
const Result = ELResult;
const Space = ELSpace;
const Typography = ELTypography;
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  SendOutlined,
} from "@ant-design/icons";
import type { PublicPaymentData } from "@/modules/recipients/application/types";
import { RecipientPaymentModal } from "@/modules/payments/ui/components/RecipientPaymentModal";
import { formatCentsAsBRL } from "@/shared/utils/format";

const { Title, Text, Paragraph } = Typography;

type PaymentPageClientProps = {
  token: string;
};

export default function PaymentPageClient({ token }: PaymentPageClientProps) {
  const router = useRouter();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState<PublicPaymentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    trackingCode: string;
  } | null>(null);

  // Carregar dados do pagamento
  useEffect(() => {
    const fetchPaymentData = async () => {
      try {
        const response = await fetch(`/api/recipient-payment/${token}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.message || "Erro ao buscar dados do pagamento");
        }

        setPaymentData(result.data);
      } catch (err) {
        console.error("[PAYMENT_PAGE] Erro:", err);
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentData();
  }, [token]);

  // Calcular tempo restante
  const getTimeRemaining = () => {
    if (!paymentData?.expiresAt) return null;

    const now = new Date();
    const expires = new Date(paymentData.expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return "Expirado";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} dia${days > 1 ? "s" : ""} restante${days > 1 ? "s" : ""}`;
    }

    return `${hours}h ${minutes}min restantes`;
  };

  // Abrir modal de pagamento
  const handlePayment = () => {
    setPaymentModalOpen(true);
  };

  // Callback quando pagamento e concluido com sucesso
  const handlePaymentSuccess = (result: { transactionId: string; method: string; trackingCode?: string }) => {
    setPaymentSuccess({
      trackingCode: result.trackingCode || "",
    });
    setPaymentModalOpen(false);
  };

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "40px 20px",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <ELCard>
            <ELSkeleton lines={8} />
          </ELCard>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !paymentData) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "40px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Result
          status="error"
          title="Link nao encontrado"
          subTitle={error || "Este link de pagamento nao existe ou ja expirou."}
          extra={
            <ELButton variant="primary" onClick={() => router.push("/")}>
              Ir para pagina inicial
            </ELButton>
          }
        />
      </div>
    );
  }

  // Expired state
  if (paymentData.status === "EXPIRED") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "40px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Result
          status="warning"
          title="Link expirado"
          subTitle="Este link de pagamento expirou. Entre em contato com o remetente para solicitar um novo link."
          icon={<ClockCircleOutlined style={{ color: "#faad14" }} />}
        />
      </div>
    );
  }

  // Cancelled state
  if (paymentData.status === "CANCELLED") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "40px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Result
          status="error"
          title="Solicitacao cancelada"
          subTitle="Esta solicitacao de pagamento foi cancelada pelo remetente."
          icon={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
        />
      </div>
    );
  }

  // Already paid state
  if (paymentData.status === "PAID" && !paymentSuccess) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "40px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Result
          status="success"
          title="Pagamento ja realizado"
          subTitle="Este frete ja foi pago. Voce recebera um e-mail com o codigo de rastreio."
          icon={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
        />
      </div>
    );
  }

  // Payment success state
  if (paymentSuccess) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f5f5f5",
          padding: "40px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Result
          status="success"
          title="Pagamento confirmado!"
          subTitle="Seu pagamento foi processado com sucesso."
          extra={
            <Space orientation="vertical" size={16} style={{ width: "100%" }}>
              {paymentSuccess.trackingCode && (
                <ELCard>
                  <div style={{ textAlign: "center" }}>
                    <Text type="secondary">Codigo de Rastreamento</Text>
                    <Title
                      level={3}
                      copyable
                      style={{ margin: "8px 0", color: "#1890ff" }}
                    >
                      {paymentSuccess.trackingCode}
                    </Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Use este codigo para acompanhar seu envio
                    </Text>
                  </div>
                </ELCard>
              )}
              <Text type="secondary" style={{ display: "block", textAlign: "center" }}>
                Voce recebera um e-mail com os detalhes do envio.
              </Text>
            </Space>
          }
        />
      </div>
    );
  }

  // Payment form
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            Envio Legal
          </Title>
          <Text type="secondary">Pagamento de Frete</Text>
        </div>

        {/* Main Card */}
        <ELCard>
          {/* Greeting */}
          <div style={{ marginBottom: 24 }}>
            <Title level={4} style={{ marginBottom: 8 }}>
              Ola, {paymentData.recipientName}!
            </Title>
            <Paragraph type="secondary">
              <strong>{paymentData.senderName}</strong> deseja enviar uma encomenda
              para voce e solicita que voce pague o frete.
            </Paragraph>
          </div>

          {/* Shipping Info */}
          <ELCard
            padding="sm"
            style={{ background: "#fafafa", marginBottom: 20 }}
          >
            <Space orientation="vertical" size={12} style={{ width: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <SendOutlined style={{ color: "#1890ff" }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Origem
                  </Text>
                  <div>
                    <Text strong>
                      {paymentData.originCity}/{paymentData.originState}
                    </Text>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <EnvironmentOutlined style={{ color: "#52c41a" }} />
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Destino
                  </Text>
                  <div>
                    <Text strong>
                      {paymentData.destinationCity}/{paymentData.destinationState}
                    </Text>
                  </div>
                </div>
              </div>

              <Divider style={{ margin: "8px 0" }} />

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text type="secondary">Transportadora</Text>
                <Text strong>
                  {paymentData.carrier} - {paymentData.service}
                </Text>
              </div>

              {paymentData.estimatedDays && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text type="secondary">Prazo estimado</Text>
                  <Text strong>
                    {paymentData.estimatedDays} dia
                    {paymentData.estimatedDays > 1 ? "s" : ""} uteis
                  </Text>
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text type="secondary">Volumes</Text>
                <Text strong>
                  {paymentData.packagesCount} volume
                  {paymentData.packagesCount > 1 ? "s" : ""}
                </Text>
              </div>
            </Space>
          </ELCard>

          {/* Price */}
          <ELCard
            padding="sm"
            style={{
              background: "#e6f7ff",
              border: "2px solid #1890ff",
              marginBottom: 20,
              textAlign: "center",
            }}
          >
            <Text type="secondary">Valor do Frete</Text>
            <Title level={2} style={{ margin: "8px 0", color: "#1890ff" }}>
              {formatCentsAsBRL(paymentData.totalCents)}
            </Title>
            {paymentData.pickupFeeCents && paymentData.pickupFeeCents > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                (inclui taxa de coleta de{" "}
                {formatCentsAsBRL(paymentData.pickupFeeCents)})
              </Text>
            )}
          </ELCard>

          {/* Expiration Warning */}
          <ELAlert
            variant="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            title={`Prazo para pagamento: ${getTimeRemaining()}`}
            description="Apos este prazo, o link sera invalidado automaticamente."
            style={{ marginBottom: 24 }}
          />

          {/* Payment Button */}
          <ELButton
            variant="primary"
            size="large"
            block
            onClick={handlePayment}
            style={{ height: 50, fontSize: 16 }}
          >
            Pagar {formatCentsAsBRL(paymentData.totalCents)}
          </ELButton>

          <Paragraph
            type="secondary"
            style={{ fontSize: 12, marginTop: 16, textAlign: "center" }}
          >
            Ao clicar em &quot;Pagar&quot;, voce sera direcionado para a pagina de pagamento
            seguro. Aceitamos PIX e cartao de credito.
          </Paragraph>
        </ELCard>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Envio Legal - Plataforma de envios{" "}
            {new Date().getFullYear()}
          </Text>
        </div>
      </div>

      {/* Modal de Pagamento (Asaas) */}
      {paymentData && (
        <RecipientPaymentModal
          open={paymentModalOpen}
          onClose={() => setPaymentModalOpen(false)}
          paymentToken={token}
          amount={paymentData.totalCents / 100}
          email={paymentData.recipientEmail}
          description={`Frete ${paymentData.carrier} - ${paymentData.service}`}
          onSuccess={handlePaymentSuccess}
          onPixCancel={() => setPaymentModalOpen(false)}
        />
      )}
    </div>
  );
}
