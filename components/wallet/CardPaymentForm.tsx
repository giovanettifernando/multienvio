"use client";

import { useState, useEffect } from "react";
import { Card as AntCard, Spin, Alert } from "antd";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";

interface CardPaymentFormProps {
  amount: number;
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

export function CardPaymentForm({
  amount,
  onSuccess,
  onError,
}: CardPaymentFormProps) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar Public Key do Mercado Pago
  useEffect(() => {
    async function fetchPublicKey() {
      try {
        const response = await fetch("/api/payments/mercadopago/public-key");
        if (!response.ok) {
          throw new Error("Não foi possível carregar as credenciais do Mercado Pago");
        }
        const data = await response.json();
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

  const handleSubmit = async (formData: MercadoPagoFormData) => {
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
            type: "wallet_topup",
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao processar pagamento");
      }

      const result = await response.json();
      onSuccess(result.payment.id);
    } catch (err) {
      console.error("[CARD_PAYMENT_SUBMIT]", err);
      onError(err instanceof Error ? err : new Error("Erro desconhecido"));
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
          <Spin tip="Carregando formulário de pagamento..." />
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
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <CardPayment
        initialization={{
          amount,
        }}
        onSubmit={handleSubmit}
        onError={handleError}
      />
    </div>
  );
}

export default CardPaymentForm;
