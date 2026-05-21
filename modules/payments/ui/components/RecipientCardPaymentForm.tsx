"use client";

import { useState, useRef } from "react";
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { LoadingOutlined } from "@ant-design/icons";
import { tokenizeCard } from '@/modules/payments/ui/utils/tokenizeCard';

// Timeout para aguardar confirmacao da operadora (15 segundos)
const CARD_PROCESSING_TIMEOUT_MS = 15000;

interface RecipientCardPaymentFormProps {
  paymentToken: string;
  amount: number;
  email: string;
  onSuccess: (paymentId: number) => void;
  onError: (error: Error) => void;
}


export function RecipientCardPaymentForm({
  paymentToken,
  amount,
  email,
  onSuccess,
  onError,
}: RecipientCardPaymentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({
    number: "",
    holderName: "",
    expMonth: "",
    expYear: "",
    cvv: "",
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);


  const handleSubmit = async () => {
    setProcessing(true);
    abortControllerRef.current = new AbortController();

    timeoutRef.current = setTimeout(() => {
      abortControllerRef.current?.abort();
      setProcessing(false);
      onError(new Error("Erro ao processar pagamento, tente novamente mais tarde"));
    }, CARD_PROCESSING_TIMEOUT_MS);

    try {
      const token = await tokenizeCard({
        number: form.number,
        holderName: form.holderName,
        expMonth: form.expMonth,
        expYear: form.expYear,
        cvv: form.cvv,
      });

      const response = await fetch("/api/recipient-payment/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentToken,
          transactionAmount: amount,
          paymentMethod: "credit_card",
          cardToken: token,
          payer: {
            email,
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
        const errorMessage =
          errorData.error?.message || errorData.message || "Cartao nao autorizado";
        throw new Error(errorMessage);
      }

      const resultJson = await response.json();
      const result = resultJson.data ?? resultJson;
      setProcessing(false);
      onSuccess(result.payment.id);
    } catch (err) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setProcessing(false);
      if (err instanceof Error && err.name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Cartao nao autorizado";
      setError(msg);
      onError(err instanceof Error ? err : new Error("Cartao nao autorizado"));
    }
  };

  if (error) {
    return (
      <ELAlert
        title="Erro ao carregar formulario"
        description={error}
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

      <div style={{ maxWidth: 600, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          placeholder="Numero do cartao"
          value={form.number}
          onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
          style={{ padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
        />
        <input
          placeholder="Nome no cartao"
          value={form.holderName}
          onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
          style={{ padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="MM"
            value={form.expMonth}
            onChange={(e) => setForm((f) => ({ ...f, expMonth: e.target.value }))}
            style={{ flex: 1, padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
          />
          <input
            placeholder="AA"
            value={form.expYear}
            onChange={(e) => setForm((f) => ({ ...f, expYear: e.target.value }))}
            style={{ flex: 1, padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
          />
          <input
            placeholder="CVV"
            value={form.cvv}
            onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value }))}
            style={{ flex: 1, padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
          />
        </div>
        <ELButton type="primary" onClick={handleSubmit} loading={processing} block>
          Pagar R$ {(amount).toFixed(2).replace(".", ",")}
        </ELButton>
      </div>
    </>
  );
}

export default RecipientCardPaymentForm;
