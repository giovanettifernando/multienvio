"use client";

import { useState, useRef } from "react";
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { LoadingOutlined } from "@ant-design/icons";
import { maskCEP, isValidCep, normalizeCep } from '@/shared/utils/masks';

// Timeout para aguardar confirmacao da operadora (15 segundos)
const CARD_PROCESSING_TIMEOUT_MS = 15000;

interface RecipientCardPaymentFormProps {
  paymentToken: string;
  amount: number;
  email: string;
  /** Id da PaymentTransaction (Asaas) — é o que `/api/recipient-payment/pay` exige como `transactionId`. */
  onSuccess: (transactionId: string) => void;
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
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({
    number: "",
    holderName: "",
    expMonth: "",
    expYear: "",
    cvv: "",
    postalCode: "",
    addressNumber: "",
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);


  const handleSubmit = async () => {
    // O Asaas exige CEP e número do endereço do titular para tokenizar o cartão
    // (mesma exigência de modules/wallet/ui/components/CardPaymentForm.tsx, Task 14).
    if (!isValidCep(form.postalCode)) {
      setFieldError('Informe um CEP válido (8 dígitos)');
      return;
    }
    if (!form.addressNumber.trim()) {
      setFieldError('Informe o número do endereço do titular');
      return;
    }
    setFieldError(null);

    setProcessing(true);
    abortControllerRef.current = new AbortController();

    timeoutRef.current = setTimeout(() => {
      abortControllerRef.current?.abort();
      setProcessing(false);
      onError(new Error("Erro ao processar pagamento, tente novamente mais tarde"));
    }, CARD_PROCESSING_TIMEOUT_MS);

    try {
      // NOTA (Task 15): `/api/payments/asaas/tokenize` (Task 9) exige sessão
      // autenticada — ele tokeniza contra o `asaasCustomerId` do usuário
      // logado. Este formulário roda numa página pública (`/pagar/[token]`,
      // sem login: quem paga é o destinatário do frete, não um usuário
      // cadastrado). Não existe hoje uma rota Asaas pública equivalente (só
      // `/api/recipient-payment/create-payment`, que já espera um
      // `cardToken` pronto, não tokeniza raw card data) — criar uma exigiria
      // alterar backend, fora do escopo desta task. Esta chamada troca a
      // rota morta do Pagar.me (503 desde a Task 6) pela rota real do Asaas,
      // mas para um visitante anônimo ela responde 401 "Não autenticado" —
      // documentado no relatório da Task 15 como gap de backend pendente.
      const tokenizeRes = await fetch('/api/payments/asaas/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          number: form.number.replace(/\D/g, ''),
          holderName: form.holderName,
          expMonth: parseInt(form.expMonth, 10),
          expYear: parseInt(form.expYear.length === 2 ? `20${form.expYear}` : form.expYear, 10),
          ccv: form.cvv,
          postalCode: normalizeCep(form.postalCode),
          addressNumber: form.addressNumber.trim(),
        }),
      });

      const tokenizeJson = await tokenizeRes.json();

      // Higienizar PAN/CVV do state assim que a resposta do tokenize chega
      // (sucesso OU erro) — não há motivo para manter os dados brutos do
      // cartão em memória depois desse ponto.
      setForm((f) => ({ ...f, number: '', cvv: '' }));

      if (!tokenizeRes.ok) {
        throw new Error(tokenizeJson.error?.message || 'Falha ao tokenizar cartão');
      }
      const token = (tokenizeJson.data ?? tokenizeJson).token as string;

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
      // result.transaction.id é o id real da PaymentTransaction — o que
      // /api/recipient-payment/pay exige como `transactionId` (Task 12b).
      // result.payment.id é o chargeId do Asaas (string), não serve para
      // esse contrato; usar payment.id aqui era exatamente o bug que
      // deixava este fluxo quebrado (mesmo padrão que a Task 14 já havia
      // corrigido no checkout de carteira/carrinho).
      onSuccess(result.transaction.id);
    } catch (err) {
      // Rede fora, abort etc. podem interromper antes da resposta do
      // tokenize chegar — higieniza de novo aqui como rede de segurança.
      setForm((f) => ({ ...f, number: '', cvv: '' }));
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
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="CEP do titular"
            value={form.postalCode}
            onChange={(e) => setForm((f) => ({ ...f, postalCode: maskCEP(e.target.value) }))}
            maxLength={9}
            style={{ flex: 2, padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
          />
          <input
            placeholder="Número"
            value={form.addressNumber}
            onChange={(e) => setForm((f) => ({ ...f, addressNumber: e.target.value }))}
            style={{ flex: 1, padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
          />
        </div>
        {fieldError && (
          <ELAlert variant="danger" description={fieldError} showIcon />
        )}
        <ELButton type="primary" onClick={handleSubmit} loading={processing} block>
          Pagar R$ {(amount).toFixed(2).replace(".", ",")}
        </ELButton>
      </div>
    </>
  );
}

export default RecipientCardPaymentForm;
