"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ELSpace, ELTypography, useELApp, ELInputNumber, ELRadio, ELSpin, ELForm } from "@/shared/ui";
const InputNumber = ELInputNumber;
const Radio = ELRadio;
const Spin = ELSpin;
const Form = ELForm;
const Space = ELSpace;
const Typography = ELTypography;
const App = { useApp: useELApp };
import {
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  WalletOutlined,
  BarcodeOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from "@ant-design/icons";
import { CardPaymentForm } from "@/modules/wallet/ui/components/CardPaymentForm";
import { SavedCardPaymentForm } from "@/modules/wallet/ui/components/SavedCardPaymentForm";
import { useCards } from "@/modules/account/ui/hooks";
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { ELAlert } from '@/shared/ui/ELAlert';
import { inputNumberFormatterBRL, inputNumberParserBRL, formatBRL } from "@/shared/utils/format";
import { BoletoPaymentView } from "./BoletoPaymentView";
import { formatBoletoDueDate, type BoletoPaymentData } from "./checkoutTypes";

const { Text } = Typography;

type PaymentMethod = "pix" | "card" | "wallet" | "boleto";

interface PaymentResult {
  success: boolean;
  transaction: {
    id: string;
    referenceId: string;
    status: string;
    amountCents: number;
    method: string;
  };
  payment: {
    status: string;
    statusDetail: string;
    pixQrCode?: string;
    /** Imagem do QR Code já em data URI (data:image/png;base64,...), retornada pelo Asaas. */
    pixQrCodeImage?: string;
    /**
     * Página de pagamento hospedada pelo gateway. Sempre presente e sempre
     * pagável — é o caminho alternativo quando a geração do QR Code falha
     * (a cobrança em si continua válida nesse caso).
     */
    invoiceUrl?: string;
  };
}

interface WalletData {
  balance: {
    availableReais: number;
    availableCents: number;
  };
}

export type PaymentModalMode = "topup" | "checkout";

export interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  /**
   * Modo do modal:
   * - topup: para recarga de carteira (mostra campo de valor)
   * - checkout: para pagamento de envio (valor fixo)
   */
  mode: PaymentModalMode;
  /**
   * Valor fixo para modo checkout
   */
  amount?: number;
  /**
   * Título customizado do modal
   */
  title?: string;
  /**
   * Descrição para o pagamento (exibida no MP)
   */
  description?: string;
  /**
   * Permitir pagamento via carteira (apenas para checkout)
   */
  allowWallet?: boolean;
  /**
   * Metadata para o pagamento (shipmentId, cartId, etc)
   */
  metadata?: Record<string, unknown>;
  /**
   * Callback chamado quando o pagamento é concluído com sucesso
   */
  onSuccess?: (result: { transactionId?: string; method: PaymentMethod }) => void;
  /**
   * Callback chamado quando o pagamento PIX é cancelado
   */
  onPixCancel?: () => void;
}

export function PaymentModal({
  open,
  onClose,
  mode,
  amount: fixedAmount,
  title,
  description,
  allowWallet = false,
  metadata,
  onSuccess,
  onPixCancel,
}: PaymentModalProps) {
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();

  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PaymentResult | null>(null);
  const [boletoData, setBoletoData] = useState<BoletoPaymentData | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [amountTouched, setAmountTouched] = useState(false);

  // Estado para polling de status PIX
  const [pixPolling, setPixPolling] = useState(false);
  const [pixStatus, setPixStatus] = useState<"pending" | "paid" | "expired" | "error">("pending");
  const [pixExpireSeconds, setPixExpireSeconds] = useState(30 * 60); // 30 minutos
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Valor efetivo (fixo para checkout, variável para topup)
  const amount = mode === "checkout" ? (fixedAmount || 0) : topUpAmount;

  // Buscar cartões salvos
  const { data: savedCards, isLoading: isLoadingCards } = useCards();

  // Buscar saldo da carteira (apenas se permitir wallet)
  const { data: walletData, isLoading: isLoadingWallet } = useQuery<WalletData>({
    queryKey: ["wallet"],
    queryFn: async () => {
      const res = await fetch("/api/wallet");
      if (!res.ok) throw new Error("Erro ao buscar saldo");
      const json = await res.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as WalletData;
    },
    enabled: open && allowWallet,
  });

  const balance = walletData?.balance?.availableReais ?? 0;
  const hasInsufficientBalance = balance < amount;
  const isWalletDisabled = !allowWallet || hasInsufficientBalance;

  const isConfirmDisabled =
    !selectedMethod ||
    !amount ||
    amount <= 0 ||
    (selectedMethod === "wallet" && isWalletDisabled);

  const isLoading = isLoadingCards || (allowWallet && isLoadingWallet);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getModalTitle = () => {
    if (title) return title;
    return mode === "topup" ? "Adicionar saldo" : "Escolha o método de pagamento";
  };

  const getConfirmButtonText = () => {
    return mode === "topup" ? "Confirmar recarga" : "Confirmar pagamento";
  };

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
    setBoletoData(null);
    setPixPolling(false);
    setPixStatus("pending");
    setPixExpireSeconds(30 * 60);
    setTopUpAmount(0);
    setSelectedMethod(null);
    setShowCardForm(false);
    setUseSavedCard(true);
    setAmountTouched(false);
    setLoading(false);
    onClose();
  }, [onClose]);

  // Função para verificar status do pagamento PIX
  const checkPixStatus = useCallback(async () => {
    if (!pixData?.transaction?.id) return;

    try {
      const refreshRes = await fetch(`/api/payments/${pixData.transaction.id}/refresh`, {
        method: "POST",
      });

      if (!refreshRes.ok) {
        console.warn("[PIX_POLL] Erro no refresh:", refreshRes.status);
        return;
      }

      const refreshJson = await refreshRes.json();
      // Handle standardized API response format { data: T, error, meta }
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

        // Sucesso!
        messageApi.success("Pagamento PIX confirmado!");

        if (mode === "topup") {
          queryClient.invalidateQueries({ queryKey: ["wallet"] });
        }

        onSuccess?.({ transactionId: pixData.transaction.id, method: "pix" });
        handleClose();

      } else if (["CANCELED", "FAILED", "EXPIRED"].includes(refreshData.payment?.status)) {
        setPixStatus("expired");
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
      }
    } catch (error) {
      console.error("[PIX_POLL] Erro ao verificar status:", error);
    }
  }, [pixData?.transaction?.id, mode, messageApi, queryClient, onSuccess, handleClose]);

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

    // Countdown do tempo de expiração
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

    // Fazer primeira verificação imediatamente
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
      if (selectedMethod === "wallet") {
        // Debitar da carteira
        // Nota: Opção só fica habilitada se houver saldo suficiente
        await fetch("/api/wallet/debit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            referenceId: metadata?.referenceId || `payment:${Date.now()}`,
            amount,
            reason: metadata?.reason || "payment",
            metadata,
          }),
        });

        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        messageApi.success("Pagamento aprovado via carteira!");

        onSuccess?.({ method: "wallet" });
        handleClose();

      } else if (selectedMethod === "pix" || selectedMethod === "boleto") {
        // Criar cobrança PIX/boleto via Asaas
        const amountCents = Math.round(amount * 100);
        const asaasMetadata = {
          type: mode === "topup" ? "wallet_topup" : "checkout_payment",
          ...(typeof metadata === "object" && metadata !== null
            ? Object.fromEntries(
                Object.entries(metadata).map(([k, v]) => [k, String(v)])
              )
            : {}),
        };

        const chargeRes = await fetch("/api/payments/asaas/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amountCents,
            paymentMethod: selectedMethod,
            description: description || `Pagamento - ${formatBRL(amount)}`,
            metadata: asaasMetadata,
          }),
        });

        if (!chargeRes.ok) {
          const errorJson = await chargeRes.json();
          // Handle standardized API response format { data: T, error, meta }
          const error = errorJson.error ?? errorJson;
          throw new Error(
            error.message || error.error || (selectedMethod === "pix" ? "Erro ao gerar PIX" : "Erro ao gerar boleto")
          );
        }

        const chargeJson = await chargeRes.json();
        // Handle standardized API response format { data: T, error, meta }
        const rawResult = (chargeJson.data ?? chargeJson) as {
          transactionId: string;
          chargeId: string;
          status: string;
          pixQrCode?: string;
          pixQrCodeImage?: string;
          boletoUrl?: string;
          boletoBarcode?: string;
          // Link da fatura no gateway: sempre presente e sempre pagável.
          // É o caminho alternativo quando o QR Code não vem.
          invoiceUrl?: string;
        };

        if (selectedMethod === "pix") {
          const pixResult: PaymentResult = {
            success: true,
            transaction: {
              id: rawResult.transactionId,
              referenceId: rawResult.chargeId,
              status: rawResult.status,
              amountCents,
              method: "pix",
            },
            payment: {
              status: rawResult.status,
              statusDetail: rawResult.status,
              pixQrCode: rawResult.pixQrCode,
              pixQrCodeImage: rawResult.pixQrCodeImage,
              invoiceUrl: rawResult.invoiceUrl,
            },
          };
          setPixData(pixResult);
          setPixStatus("pending");
          setPixExpireSeconds(30 * 60);
          // A cobrança pode nascer válida sem QR Code: a busca do QR é
          // tolerante a falha (se o gateway não devolver, a cobrança continua
          // pagável pela fatura). Não anunciar "QR gerado" quando não veio —
          // a tela oferece o link da fatura nesse caso.
          messageApi.success(
            rawResult.pixQrCode
              ? "QR Code PIX gerado com sucesso!"
              : "Cobrança PIX gerada. Use o link de pagamento abaixo.",
          );
        } else {
          // Boleto: compensação leva até 3 dias úteis. Este modal (topup e
          // checkout genérico) não faz polling client-side do boleto — a
          // carteira é creditada pelo webhook do Asaas independentemente da
          // tela ficar aberta (mesmo padrão do PIX aqui: o polling existe só
          // para fechar a UI, não para efetivar o crédito). O acompanhamento
          // com polling ativo (Task 15) está em CheckoutCartModal/
          // PaidCheckoutModal, onde a confirmação client-side dispara a
          // criação do shipment.
          setBoletoData({
            transactionId: rawResult.transactionId,
            boletoUrl: rawResult.boletoUrl || "",
            boletoBarcode: rawResult.boletoBarcode || "",
            dueDate: formatBoletoDueDate(),
          });
          messageApi.success("Boleto gerado com sucesso!");
        }

      } else if (selectedMethod === "card") {
        // Mostrar formulário de cartão
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

  const handleCardSuccess = (transactionId: string) => {
    messageApi.success("Pagamento processado com sucesso!");
    console.log("[CARD_SUCCESS] Transaction ID:", transactionId);

    onSuccess?.({ transactionId, method: "card" });
    handleClose();

    // Refetch wallet data after modal closes to ensure UI updates
    if (mode === "topup") {
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ["wallet"] });
      }, 300);
    }
  };

  const handleCardError = (error: Error) => {
    messageApi.error(error.message || "Erro ao processar pagamento");
    setShowCardForm(false);
  };

  // Renderizar formulário de cartão
  if (showCardForm) {
    const hasSavedCards = savedCards && savedCards.length > 0;
    const shouldShowSavedCardForm = useSavedCard && hasSavedCards;

    return (
      <ELModal
        title="Pagamento com Cartão"
        open={open}
        onCancel={() => {
          setShowCardForm(false);
          setUseSavedCard(true);
        }}
        footer={null}
        width={700}
      >
        {shouldShowSavedCardForm ? (
          <SavedCardPaymentForm
            amount={amount}
            onSuccess={handleCardSuccess}
            onError={handleCardError}
            onUseNewCard={() => setUseSavedCard(false)}
            paymentType={mode === "topup" ? "wallet_topup" : "checkout_payment"}
            paymentDescription={description}
          />
        ) : (
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Valor a pagar: </Text>
              <Text style={{ fontSize: 20, color: "#52c41a" }}>
                {formatBRL(amount)}
              </Text>
            </div>

            <CardPaymentForm
              amount={amount}
              onSuccess={handleCardSuccess}
              onError={handleCardError}
              paymentType={mode === "topup" ? "wallet_topup" : "checkout_payment"}
            />

            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              {hasSavedCards && (
                <ELButton variant="link" onClick={() => setUseSavedCard(true)} block>
                  Voltar para cartões salvos
                </ELButton>
              )}
              <ELButton onClick={() => setShowCardForm(false)} block>
                Cancelar
              </ELButton>
            </Space>
          </Space>
        )}
      </ELModal>
    );
  }

  // Renderizar boleto gerado. Sem polling client-side neste modal (ver
  // comentário em handleConfirm) — boletoStatus/boletoPolling ficam fixos em
  // "pending"/false, que é exatamente o comportamento anterior a esta task.
  if (boletoData) {
    return (
      <BoletoPaymentView
        open={open}
        boletoData={boletoData}
        boletoStatus="pending"
        boletoPolling={false}
        totalAmount={amount}
        releaseMessage={
          mode === "topup"
            ? "O saldo será creditado após a compensação, em até 3 dias úteis"
            : undefined
        }
        onCancel={handleClose}
        onCopyCode={() => {
          navigator.clipboard.writeText(boletoData.boletoBarcode);
          messageApi.success("Linha digitável copiada!");
        }}
      />
    );
  }

  // Renderizar PIX. A condição aceita cobrança SEM QR Code: a busca do QR é
  // tolerante a falha e a cobrança segue válida e pagável pela fatura. Exigir
  // pixQrCode aqui fazia a tela inteira sumir nesse caso — o usuário via só a
  // mensagem de sucesso e nenhuma forma de pagar.
  if (pixData && (pixData.payment.pixQrCode || pixData.payment.invoiceUrl)) {
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
              {mode === "topup" ? "Creditando saldo na carteira..." : "Processando..."}
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
              O tempo para pagamento expirou. Você pode gerar um novo código ou cancelar.
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
              {pixData.payment.pixQrCodeImage
                ? "Escaneie o QR Code abaixo com o app do seu banco:"
                : "Abra o link abaixo para pagar com PIX:"}
            </Text>

            {pixData.payment.pixQrCodeImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pixData.payment.pixQrCodeImage}
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
            ) : (
              pixData.payment.invoiceUrl && (
                // Sem QR Code, a cobrança continua válida: a página de
                // pagamento do gateway aceita PIX normalmente. Melhor oferecer
                // esse caminho do que deixar o usuário sem nenhuma saída.
                <ELButton
                  type="primary"
                  size="large"
                  onClick={() => window.open(pixData.payment.invoiceUrl, "_blank", "noopener,noreferrer")}
                >
                  Abrir página de pagamento
                </ELButton>
              )
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

          {/* Sem QR Code não há copia-e-cola: o código e a imagem vêm juntos
              do gateway. Sem esta guarda o bloco aparecia vazio, com um botão
              de copiar que copiaria "undefined". */}
          {pixData.payment.pixQrCode && (
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
                      messageApi.success("Código PIX copiado!");
                    }}
                    style={{ paddingLeft: 0 }}
                  >
                    Copiar código
                  </ELButton>
                </div>
              }
            />
          )}

        </Space>
      </ELModal>
    );
  }

  // Renderizar seleção de método de pagamento
  return (
    <>
    <ELModal
      title={getModalTitle()}
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
            {getConfirmButtonText()}
          </ELButton>
        </Space>
      }
      width={600}
    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        {/* Campo de valor (apenas para topup) */}
        {mode === "topup" && (
          <Form.Item
            label="Valor da recarga"
            required
            help={
              amountTouched && (!topUpAmount || topUpAmount <= 0)
                ? "Digite um valor maior que zero"
                : amountTouched && topUpAmount > 10000
                ? "O valor máximo é R$ 10.000,00"
                : undefined
            }
            validateStatus={
              amountTouched && (!topUpAmount || topUpAmount <= 0 || topUpAmount > 10000) ? "error" : undefined
            }
          >
            <InputNumber
              value={topUpAmount}
              onChange={(value) => setTopUpAmount(value || 0)}
              onBlur={() => setAmountTouched(true)}
              min={1}
              max={10000}
              step={10}
              placeholder="0,00"
              style={{ width: "100%" }}
              prefix="R$"
              decimalSeparator=","
              formatter={inputNumberFormatterBRL}
              parser={inputNumberParserBRL}
            />
          </Form.Item>
        )}

        {/* Exibir valor fixo (para checkout) */}
        {mode === "checkout" && fixedAmount && (
          <div>
            <Text strong>Total a pagar: </Text>
            <Text style={{ fontSize: 20, color: "#1890ff" }}>{formatBRL(fixedAmount)}</Text>
          </div>
        )}

        {/* Lista de métodos de pagamento */}
        {isLoading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <Spin tip="Carregando métodos de pagamento...">
              <div style={{ minHeight: 100 }} />
            </Spin>
          </div>
        ) : (
          <div>
            <Text type="secondary" style={{ marginBottom: 12, display: "block" }}>
              Selecione o método de pagamento:
            </Text>
            <Radio.Group
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              style={{ width: "100%" }}
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {/* Carteira (apenas para checkout) */}
                {allowWallet && (
                  <Radio value="wallet" disabled={isWalletDisabled} style={{ width: "100%" }}>
                    <Space>
                      <WalletOutlined style={{ fontSize: 20 }} />
                      <div>
                        <div>Saldo em carteira</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Saldo disponível: {formatBRL(balance)}
                        </Text>
                        {hasInsufficientBalance && (
                          <div>
                            <Text type="danger" style={{ fontSize: 12 }}>
                              Saldo insuficiente
                            </Text>
                          </div>
                        )}
                      </div>
                    </Space>
                  </Radio>
                )}

                {/* PIX */}
                <Radio value="pix" style={{ width: "100%" }}>
                  <Space>
                    <QrcodeOutlined style={{ fontSize: 20 }} />
                    <div>PIX</div>
                  </Space>
                </Radio>

                {/* Cartão de crédito */}
                <Radio value="card" style={{ width: "100%" }}>
                  <Space>
                    <CreditCardOutlined style={{ fontSize: 20 }} />
                    <div>Cartão de crédito</div>
                  </Space>
                </Radio>

                {/* Boleto bancário */}
                <Radio value="boleto" style={{ width: "100%" }}>
                  <Space>
                    <BarcodeOutlined style={{ fontSize: 20 }} />
                    <div>
                      <div>Boleto bancário</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Compensação em até 3 dias úteis — o envio é liberado após o pagamento
                      </Text>
                    </div>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
        )}

        {/* Mensagem informativa */}
        {selectedMethod === "pix" && (
          <div style={{ padding: "12px", background: "#f0f2f5", borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Você receberá um QR Code para realizar o pagamento.
              {mode === "topup" && " Após a confirmação, o saldo será creditado em sua carteira."}
              {mode === "checkout" && " Após a confirmação, seu envio será processado automaticamente."}
            </Text>
          </div>
        )}

        {selectedMethod === "wallet" && (
          <div style={{ padding: "12px", background: "#f0f2f5", borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              O valor será debitado imediatamente da sua carteira.
            </Text>
          </div>
        )}

        {selectedMethod === "card" && (
          <div style={{ padding: "12px", background: "#f0f2f5", borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {savedCards && savedCards.length > 0
                ? `Você tem ${savedCards.length} cartão(ões) salvo(s). Poderá usar um deles ou cadastrar um novo.`
                : "Você será direcionado para cadastrar os dados do cartão."}
            </Text>
          </div>
        )}

        {selectedMethod === "boleto" && (
          <div style={{ padding: "12px", background: "#f0f2f5", borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Será gerado um boleto bancário. A compensação leva até 3 dias úteis
              {mode === "topup" && " e o saldo será creditado em sua carteira assim que o pagamento for confirmado."}
              {mode === "checkout" && " e o envio só é liberado após a confirmação do pagamento."}
            </Text>
          </div>
        )}
      </Space>
    </ELModal>
    </>
  );
}

export default PaymentModal;
