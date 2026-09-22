"use client";

import { useState, useRef } from "react";
import { ELAlert } from '@/shared/ui/ELAlert';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';
import { LoadingOutlined } from "@ant-design/icons";
import { maskCEP, isValidCep, normalizeCep, maskCardNumber, maskCardValidity } from '@/shared/utils/masks';

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
    // Validade num campo só, no formato MM/AA — é como vem impresso no cartão
    validity: "",
    cvv: "",
    postalCode: "",
    addressNumber: "",
  });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);


  const handleSubmit = async () => {
    // A validade chega como MM/AA; a API do Asaas recebe mês e ano separados,
    // com o ano em 4 dígitos.
    const [rawMonth = "", rawYear = ""] = form.validity.split("/");
    const expMonth = parseInt(rawMonth, 10);
    const expYear = parseInt(rawYear.length === 2 ? `20${rawYear}` : rawYear, 10);

    if (!Number.isInteger(expMonth) || expMonth < 1 || expMonth > 12) {
      setFieldError('Validade inválida — use o formato MM/AA (ex.: 12/30)');
      return;
    }
    const anoAtual = new Date().getFullYear();
    if (!Number.isInteger(expYear) || expYear < anoAtual || expYear > anoAtual + 30) {
      setFieldError('Validade inválida — verifique o ano');
      return;
    }
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
      // NOTA (Task 15 - fix round 1): `/api/recipient-payment/tokenize` é a
      // rota pública equivalente de tokenização. Resolve a solicitação pelo
      // paymentToken (o único fator de autorização), verifica status/expiração,
      // e tokeniza contra o cliente Asaas do remetente (sender), não de quem
      // está logado. Assim destinatários anônimos conseguem pagar, e não há
      // risco de cartão ser tokenizado contra conta de outro usuário.
      const tokenizeRes = await fetch('/api/recipient-payment/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          paymentToken,
          number: form.number.replace(/\D/g, ''),
          holderName: form.holderName,
          expMonth,
          expYear,
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
          placeholder="0000 0000 0000 0000"
          aria-label="Número do cartão"
          value={form.number}
          maxLength={23}
          inputMode="numeric"
          autoComplete="cc-number"
          onChange={(e) => setForm((f) => ({ ...f, number: maskCardNumber(e.target.value) }))}
          style={{ padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
        />
        <input
          placeholder="Nome no cartão"
          aria-label="Nome no cartão"
          autoComplete="cc-name"
          value={form.holderName}
          onChange={(e) => setForm((f) => ({ ...f, holderName: e.target.value }))}
          style={{ padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            placeholder="MM/AA"
            aria-label="Validade"
            autoComplete="cc-exp"
            value={form.validity}
            maxLength={5}
            inputMode="numeric"
            onChange={(e) => setForm((f) => ({ ...f, validity: maskCardValidity(e.target.value) }))}
            style={{ flex: 1, padding: 8, border: "1px solid #d9d9d9", borderRadius: 6 }}
          />
          <input
            placeholder="CVV"
            aria-label="CVV"
            autoComplete="cc-csc"
            value={form.cvv}
            maxLength={4}
            inputMode="numeric"
            onChange={(e) => setForm((f) => ({ ...f, cvv: e.target.value.replace(/\D/g, "") }))}
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
