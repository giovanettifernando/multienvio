"use client";

import { useState, useEffect, useRef } from "react";
import { Card as AntCard, Spin, Alert } from "antd";
import { ELModal } from "@/components/ui/ELModal";
import { LoadingOutlined } from "@ant-design/icons";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";

// Timeout para aguardar confirmação da operadora (15 segundos)
const CARD_PROCESSING_TIMEOUT_MS = 15000;

interface CardPaymentFormProps {
  amount: number;
  onSuccess: (paymentId: number) => void;
  onError: (error: Error) => void;
  paymentType?: 'wallet_topup' | 'checkout_payment'; // Tipo de pagamento (default: wallet_topup)
}

// Tipos do Mercado Pago SDK
interface MercadoPagoFormData {
  token: string;
  payment_method_id: string;
  installments: number;
  payer?: {
    email?: string;
    identification?: {
      type: string;
      number: string;
    };
  };
}

interface MercadoPagoError {
  message?: string;
  cause?: unknown;
}

export function CardPaymentForm({
  amount,
  onSuccess,
  onError,
  paymentType = 'wallet_topup',
}: CardPaymentFormProps) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Buscar Public Key do Mercado Pago
  useEffect(() => {
    async function fetchPublicKey() {
      try {
        const response = await fetch("/api/payments/mercadopago/public-key");
        if (!response.ok) {
          throw new Error("Não foi possível carregar as credenciais do Mercado Pago");
        }
        const json = await response.json();
        // Handle standardized API response format { data: T, error, meta }
        const data = json.data ?? json;
        setPublicKey(data.publicKey);

        // Inicializar SDK do Mercado Pago
        initMercadoPago(data.publicKey, {
          locale: "pt-BR",
        });
      } catch (err) {
        console.error("[CARD_PAYMENT_FORM]", err);
        setError(err instanceof Error ? err.message : "Erro ao carregar Mercado Pago");
      } finally {
        setLoading(false);
      }
    }

    fetchPublicKey();
  }, []);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = async (formData: MercadoPagoFormData) => {
    // Mostrar modal de processamento
    setProcessing(true);

    // Criar AbortController para cancelar requisição no timeout
    abortControllerRef.current = new AbortController();

    // Configurar timeout de 15 segundos
    timeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setProcessing(false);
      onError(new Error("Erro ao processar pagamento, tente novamente mais tarde"));
    }, CARD_PROCESSING_TIMEOUT_MS);

    try {
      // O SDK já tokenizou o cartão automaticamente
      // formData contém o token e outros dados do cartão
      const response = await fetch("/api/payments/mercadopago/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionAmount: amount,
          token: formData.token,
          paymentMethodId: formData.payment_method_id,
          installments: formData.installments,
          payer: {
            email: formData.payer?.email || "test@test.com",
            identification: formData.payer?.identification,
          },
          metadata: {
            type: paymentType,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      // Limpar timeout se a requisição completou
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        // Handle standardized API error format { error: { message } }
        const errorMessage = errorData.error?.message || errorData.message || "Cartão não autorizado";
        throw new Error(errorMessage);
      }

      const resultJson = await response.json();
      // Handle standardized API response format { data: T, error, meta }
      const result = resultJson.data ?? resultJson;
      setProcessing(false);
      onSuccess(result.payment.id);
    } catch (err) {
      // Limpar timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setProcessing(false);

      // Se foi abortado pelo timeout, a mensagem já foi enviada
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("[CARD_PAYMENT_SUBMIT]", err);
      // Usar mensagem do erro (pode ser específica do status_detail)
      onError(err instanceof Error ? err : new Error("Cartão não autorizado"));
    }
  };

  const handleError = async (error: MercadoPagoError) => {
    console.error("[CARD_PAYMENT_ERROR]", error);
    onError(new Error(error?.message || "Erro ao processar cartão"));
  };

  if (loading) {
    return (
      <AntCard>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin tip="Carregando formulário de pagamento...">
            <div style={{ minHeight: 100 }} />
          </Spin>
        </div>
      </AntCard>
    );
  }

  if (error || !publicKey) {
    return (
      <Alert
        message="Erro ao carregar formulário"
        description={error || "Mercado Pago não configurado"}
        type="error"
        showIcon
      />
    );
  }

  return (
    <>
      {/* Modal bloqueante durante processamento */}
      <ELModal
        open={processing}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
        size="sm"
      >
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <LoadingOutlined style={{ fontSize: 48, color: "#1890ff", marginBottom: 24 }} spin />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            Aguardando confirmação da operadora de cartão de crédito
          </div>
          <div style={{ fontSize: 14, color: "#666" }}>
            Por favor, aguarde...
          </div>
        </div>
      </ELModal>

      <div style={{ maxWidth: 600, margin: "0 auto" }}>
        <CardPayment
          initialization={{
            amount,
          }}
          onSubmit={handleSubmit}
          onError={handleError}
        />
      </div>
    </>
  );
}

export default CardPaymentForm;
