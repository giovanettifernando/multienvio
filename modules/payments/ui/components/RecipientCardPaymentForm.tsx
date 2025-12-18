"use client";

import { useState, useEffect, useRef } from "react";
import { Spin } from "antd";
import { ELCard } from '@/shared/ui/ELCard';
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELModal } from '@/shared/ui/ELModal';
import { LoadingOutlined } from "@ant-design/icons";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";

// Timeout para aguardar confirmacao da operadora (15 segundos)
const CARD_PROCESSING_TIMEOUT_MS = 15000;

interface RecipientCardPaymentFormProps {
  paymentToken: string;
  amount: number;
  email: string;
  onSuccess: (paymentId: number) => void;
  onError: (error: Error) => void;
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

export function RecipientCardPaymentForm({
  paymentToken,
  amount,
  email,
  onSuccess,
  onError,
}: RecipientCardPaymentFormProps) {
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
          throw new Error("Nao foi possivel carregar as credenciais do Mercado Pago");
        }
        const json = await response.json();
        const data = json.data ?? json;
        setPublicKey(data.publicKey);

        // Inicializar SDK do Mercado Pago
        initMercadoPago(data.publicKey, {
          locale: "pt-BR",
        });
      } catch (err) {
        console.error("[RECIPIENT_CARD_FORM]", err);
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

    // Criar AbortController para cancelar requisicao no timeout
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
      // Usar endpoint publico para criar pagamento
      const response = await fetch("/api/recipient-payment/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken,
          transactionAmount: amount,
          token: formData.token,
          paymentMethodId: formData.payment_method_id,
          installments: formData.installments,
          payer: {
            email: formData.payer?.email || email,
            identification: formData.payer?.identification,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      // Limpar timeout se a requisicao completou
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error?.message || errorData.message || "Cartao nao autorizado";
        throw new Error(errorMessage);
      }

      const resultJson = await response.json();
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

      // Se foi abortado pelo timeout, a mensagem ja foi enviada
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("[RECIPIENT_CARD_SUBMIT]", err);
      onError(err instanceof Error ? err : new Error("Cartao nao autorizado"));
    }
  };

  const handleError = async (error: MercadoPagoError) => {
    console.error("[RECIPIENT_CARD_ERROR]", error);
    onError(new Error(error?.message || "Erro ao processar cartao"));
  };

  if (loading) {
    return (
      <ELCard>
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin tip="Carregando formulario de pagamento...">
            <div style={{ minHeight: 100 }} />
          </Spin>
        </div>
      </ELCard>
    );
  }

  if (error || !publicKey) {
    return (
      <ELAlert
        title="Erro ao carregar formulario"
        description={error || "Mercado Pago nao configurado"}
        variant="danger"
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
            Aguardando confirmacao da operadora de cartao de credito
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

export default RecipientCardPaymentForm;
