"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ELSpace, ELTypography, useELApp, ELRadio, ELSpin } from "@/shared/ui";
const Radio = ELRadio;
const Spin = ELSpin;
const Space = ELSpace;
const Typography = ELTypography;
const App = { useApp: useELApp };
import { formatBRL } from "@/shared/utils/format";
import {
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from "@ant-design/icons";
import { MercadoPagoSecurity, getDeviceSessionId } from "@/modules/payments/ui/components/MercadoPagoSecurity";
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import { RecipientCardPaymentForm } from "@/modules/payments/ui/components/RecipientCardPaymentForm";

const { Text } = Typography;

type PaymentMethod = "pix" | "card";

interface MercadoPagoPaymentResult {
  success: boolean;
  transaction: {
    id: string;
    referenceId: string;
    status: string;
    amountCents: number;
    method: string;
  };
  payment: {
    id: number;
    status: string;
    statusDetail: string;
    pixQrCode?: string;
    pixQrCodeBase64?: string;
  };
}

export interface RecipientPaymentModalProps {
  open: boolean;
  onClose: () => void;
  /** Token de pagamento do recipient payment request */
  paymentToken: string;
  /** Valor em reais */
  amount: number;
  /** Email do destinatario */
  email: string;
  /** Descricao para o pagamento */
  description?: string;
  /** Callback quando pagamento e concluido */
  onSuccess?: (result: { paymentId: number; method: PaymentMethod; trackingCode?: string }) => void;
  /** Callback quando PIX e cancelado */
  onPixCancel?: () => void;
}

export function RecipientPaymentModal({
  open,
  onClose,
  paymentToken,
  amount,
  email,
  description,
  onSuccess,
  onPixCancel,
}: RecipientPaymentModalProps) {
  const { message: messageApi } = App.useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<MercadoPagoPaymentResult | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);

  // Estado para polling de status PIX
  const [pixPolling, setPixPolling] = useState(false);
  const [pixStatus, setPixStatus] = useState<"pending" | "paid" | "expired" | "error">("pending");
  const [pixExpireSeconds, setPixExpireSeconds] = useState(30 * 60); // 30 minutos
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isConfirmDisabled = !selectedMethod || !amount || amount <= 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // handleClose precisa ser definido antes de processPaymentAndCreateShipment
  const handleClose = useCallback(() => {
    // Limpar intervals de polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setPixData(null);
    setPixPolling(false);
    setPixStatus("pending");
    setPixExpireSeconds(30 * 60);
    setSelectedMethod(null);
    setShowCardForm(false);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Processar pagamento apos confirmacao
  const processPaymentAndCreateShipment = useCallback(async (mercadoPagoPaymentId: number, method: PaymentMethod) => {
    try {
      const response = await fetch("/api/recipient-payment/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken,
          paymentMethod: method === "pix" ? "PIX" : "CREDIT_CARD",
          mercadoPagoPaymentId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || "Erro ao processar pagamento");
      }

      messageApi.success("Pagamento confirmado!");
      onSuccess?.({
        paymentId: mercadoPagoPaymentId,
        method,
        trackingCode: result.data?.trackingCode,
      });
      handleClose();
    } catch (error) {
      console.error("[PAYMENT_PROCESS] Erro:", error);
      messageApi.error(error instanceof Error ? error.message : "Erro ao processar pagamento");
    }
  }, [paymentToken, messageApi, onSuccess, handleClose]);

  // Funcao para verificar status do pagamento PIX
  const checkPixStatus = useCallback(async () => {
    if (!pixData?.transaction?.id) return;

    try {
      const refreshRes = await fetch("/api/recipient-payment/refresh-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: pixData.transaction.id,
          paymentToken,
        }),
      });

      if (!refreshRes.ok) {
        console.warn("[PIX_POLL] Erro no refresh:", refreshRes.status);
        return;
      }

      const refreshJson = await refreshRes.json();
      const refreshData = refreshJson.data ?? refreshJson;
      console.log("[PIX_POLL] Status atualizado:", refreshData.payment?.status);

      if (refreshData.payment?.status === "PAID") {
        setPixStatus("paid");
        setPixPolling(false);

        // Limpar intervals
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        // Processar pagamento e criar shipment
        await processPaymentAndCreateShipment(pixData.payment.id, "pix");
      } else if (["CANCELED", "FAILED", "EXPIRED"].includes(refreshData.payment?.status)) {
        setPixStatus("expired");
        setPixPolling(false);

        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error("[PIX_POLL] Erro ao verificar status:", error);
    }
  }, [pixData?.transaction?.id, pixData?.payment?.id, paymentToken, processPaymentAndCreateShipment]);

  // Effect para polling do status PIX
  useEffect(() => {
    if (!pixData || pixStatus !== "pending") {
      return;
    }

    console.log("[PIX_POLL] Iniciando polling...");
    setPixPolling(true);

    // Verificar status a cada 5 segundos
    pollingIntervalRef.current = setInterval(() => {
      checkPixStatus();
    }, 5000);

    // Countdown do tempo de expiracao
    countdownIntervalRef.current = setInterval(() => {
      setPixExpireSeconds((prev) => {
        if (prev <= 0) {
          setPixStatus("expired");
          setPixPolling(false);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Fazer primeira verificacao imediatamente
    checkPixStatus();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [pixData, pixStatus, checkPixStatus]);

  const handleConfirm = async () => {
    if (!selectedMethod || !amount || amount <= 0) return;

    setLoading(true);

    try {
      if (selectedMethod === "pix") {
        // Criar pagamento PIX via endpoint publico
        const deviceSessionId = getDeviceSessionId();
        const pixRes = await fetch("/api/recipient-payment/create-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentToken,
            transactionAmount: amount,
            paymentMethodId: "pix",
            payer: {
              email: email,
            },
            description: description || `Pagamento de frete - ${formatBRL(amount)}`,
            deviceSessionId,
          }),
        });

        if (!pixRes.ok) {
          const errorJson = await pixRes.json();
          const error = errorJson.error ?? errorJson;
          throw new Error(error.message || error.error || "Erro ao gerar PIX");
        }

        const pixJson = await pixRes.json();
        const pixResult = (pixJson.data ?? pixJson) as MercadoPagoPaymentResult;
        setPixData(pixResult);
        setPixStatus("pending");
        setPixExpireSeconds(30 * 60);
        messageApi.success("QR Code PIX gerado com sucesso!");
      } else if (selectedMethod === "card") {
        // Mostrar formulario de cartao
        setShowCardForm(true);
        setLoading(false);
        return;
      }
    } catch (error) {
      console.error("[PAYMENT_MODAL_ERROR]", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao processar pagamento";
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePixCancel = () => {
    onPixCancel?.();
    handleClose();
  };

  const handleCardSuccess = async (paymentId: number) => {
    messageApi.success("Pagamento com cartao aprovado!");
    // Processar pagamento e criar shipment
    await processPaymentAndCreateShipment(paymentId, "card");
  };

  const handleCardError = (error: Error) => {
    messageApi.error(error.message || "Erro ao processar pagamento");
    setShowCardForm(false);
  };

  // Renderizar formulario de cartao
  if (showCardForm) {
    return (
      <ELModal
        title="Pagamento com Cartao"
        open={open}
        onCancel={() => setShowCardForm(false)}
        footer={null}
        width={700}
      >
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Valor a pagar: </Text>
            <Text style={{ fontSize: 20, color: "#52c41a" }}>
              {formatBRL(amount)}
            </Text>
          </div>

          <RecipientCardPaymentForm
            paymentToken={paymentToken}
            amount={amount}
            email={email}
            onSuccess={handleCardSuccess}
            onError={handleCardError}
          />

          <ELButton onClick={() => setShowCardForm(false)} block>
            Cancelar
          </ELButton>
        </Space>
      </ELModal>
    );
  }

  // Renderizar QR Code PIX
  if (pixData && pixData.payment.pixQrCode) {
    // Status: PAGO
    if (pixStatus === "paid") {
      return (
        <ELModal
          title="Pagamento Confirmado"
          open={open}
          footer={null}
          closable={false}
          maskClosable={false}
          keyboard={false}
          width={500}
        >
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <CheckCircleFilled style={{ fontSize: 64, color: "#52c41a", marginBottom: 24 }} />
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              Pagamento PIX Confirmado!
            </Typography.Title>
            <Text type="secondary">
              Processando seu envio...
            </Text>
            <div style={{ marginTop: 24 }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
            </div>
          </div>
        </ELModal>
      );
    }

    // Status: EXPIRADO
    if (pixStatus === "expired") {
      return (
        <ELModal
          title="PIX Expirado"
          open={open}
          closable={false}
          maskClosable={false}
          keyboard={false}
          footer={
            <Space>
              <ELButton
                variant="primary"
                onClick={() => {
                  setPixData(null);
                  setPixStatus("pending");
                  setPixExpireSeconds(30 * 60);
                  handleConfirm();
                }}
              >
                Gerar Novo PIX
              </ELButton>
              <ELButton variant="danger" onClick={handlePixCancel}>
                Cancelar
              </ELButton>
            </Space>
          }
          width={500}
        >
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <CloseCircleFilled style={{ fontSize: 64, color: "#ff4d4f", marginBottom: 24 }} />
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              PIX Expirado
            </Typography.Title>
            <Text type="secondary">
              O tempo para pagamento expirou. Voce pode gerar um novo codigo ou cancelar.
            </Text>
          </div>
        </ELModal>
      );
    }

    // Status: PENDENTE (aguardando pagamento)
    return (
      <ELModal
        title="Pagamento PIX"
        open={open}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={
          <ELButton variant="danger" onClick={handlePixCancel}>
            Cancelar Pagamento
          </ELButton>
        }
        width={600}
      >
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          {/* Status de polling */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              background: "#fffbe6",
              borderRadius: 8,
              border: "1px solid #ffe58f",
            }}
          >
            {pixPolling && <LoadingOutlined spin style={{ color: "#faad14" }} />}
            <Text style={{ color: "#d48806" }}>
              Aguardando pagamento... {formatTime(pixExpireSeconds)}
            </Text>
          </div>

          <div style={{ textAlign: "center" }}>
            <Text type="secondary" style={{ marginBottom: 12, display: "block" }}>
              Escaneie o QR Code abaixo com o app do seu banco:
            </Text>

            {pixData.payment.pixQrCodeBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${pixData.payment.pixQrCodeBase64}`}
                alt="QR Code PIX"
                style={{
                  width: 280,
                  height: 280,
                  border: "2px solid #d9d9d9",
                  borderRadius: 12,
                  padding: 16,
                  background: "#fff",
                }}
              />
            )}

            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 18 }}>
                {formatBRL(amount)}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {pixData.transaction.referenceId}
              </Text>
            </div>
          </div>

          <ELAlert
            variant="warning"
            title="PIX Copia e Cola"
            description={
              <div style={{ wordBreak: "break-all", fontSize: 12 }}>
                {pixData.payment.pixQrCode}
                <br />
                <ELButton
                  variant="link"
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.payment.pixQrCode!);
                    messageApi.success("Codigo PIX copiado!");
                  }}
                  style={{ paddingLeft: 0 }}
                >
                  Copiar codigo
                </ELButton>
              </div>
            }
          />
        </Space>
      </ELModal>
    );
  }

  // Renderizar selecao de metodo de pagamento
  return (
    <>
      {/* Script de seguranca do Mercado Pago para Device Fingerprint */}
      <MercadoPagoSecurity />
      <ELModal
        title="Escolha o metodo de pagamento"
        open={open}
        onCancel={handleClose}
        footer={
          <Space>
            <ELButton onClick={handleClose} disabled={loading}>
              Cancelar
            </ELButton>
            <ELButton
              variant="primary"
              onClick={handleConfirm}
              loading={loading}
              disabled={isConfirmDisabled}
              icon={<CheckCircleOutlined />}
            >
              Confirmar pagamento
            </ELButton>
          </Space>
        }
        width={600}
      >
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          {/* Exibir valor */}
          <div>
            <Text strong>Total a pagar: </Text>
            <Text style={{ fontSize: 20, color: "#1890ff" }}>{formatBRL(amount)}</Text>
          </div>

          {/* Lista de metodos de pagamento */}
          <div>
            <Text type="secondary" style={{ marginBottom: 12, display: "block" }}>
              Selecione o metodo de pagamento:
            </Text>
            <Radio.Group
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              style={{ width: "100%" }}
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {/* PIX */}
                <Radio value="pix" style={{ width: "100%" }}>
                  <Space>
                    <QrcodeOutlined style={{ fontSize: 20 }} />
                    <div>PIX</div>
                  </Space>
                </Radio>

                {/* Cartao de credito */}
                <Radio value="card" style={{ width: "100%" }}>
                  <Space>
                    <CreditCardOutlined style={{ fontSize: 20 }} />
                    <div>Cartao de credito</div>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </div>

          {/* Mensagem informativa */}
          {selectedMethod === "pix" && (
            <div style={{ padding: "12px", background: "#f0f2f5", borderRadius: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Voce recebera um QR Code para realizar o pagamento.
                Apos a confirmacao, seu envio sera processado automaticamente.
              </Text>
            </div>
          )}

          {selectedMethod === "card" && (
            <div style={{ padding: "12px", background: "#f0f2f5", borderRadius: 4 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Voce sera direcionado para cadastrar os dados do cartao.
              </Text>
            </div>
          )}
        </Space>
      </ELModal>
    </>
  );
}

export default RecipientPaymentModal;
