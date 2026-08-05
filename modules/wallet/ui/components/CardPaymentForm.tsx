"use client";
import { useState, useRef } from "react";
import { ELCard, ELSpin, ELAlert, ELButton, ELModal } from '@/shared/ui';
import { LoadingOutlined } from "@ant-design/icons";
import { maskCEP, isValidCep, normalizeCep } from '@/shared/utils/masks';

const CARD_PROCESSING_TIMEOUT_MS = 15000;

interface CardPaymentFormProps {
  /**
   * Valor em REAIS (ex.: 5 = R$ 5,00).
   *
   * Todos os chamadores (PaymentModal, CardPaymentView) trabalham em reais, e
   * o mesmo vale para o fluxo de PIX/boleto em usePixPayment. A conversão para
   * centavos acontece aqui, no envio — nunca no chamador.
   */
  amount: number;
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  paymentType?: 'wallet_topup' | 'checkout_payment';
}

export function CardPaymentForm({ amount, onSuccess, onError, paymentType = 'wallet_topup' }: CardPaymentFormProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({
    number: '',
    holderName: '',
    expMonth: '',
    expYear: '',
    cvv: '',
    postalCode: '',
    addressNumber: '',
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async () => {
    // O Asaas exige CEP e número do endereço do titular para tokenizar o cartão.
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
    abortRef.current = new AbortController();
    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setProcessing(false);
      onError(new Error('Tempo esgotado, tente novamente'));
    }, CARD_PROCESSING_TIMEOUT_MS);

    try {
      const tokenizeRes = await fetch('/api/payments/asaas/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current?.signal,
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
      // (sucesso OU erro) — o token já basta para o resto do fluxo, não há
      // motivo para manter os dados brutos do cartão em memória depois disso.
      setForm((f) => ({ ...f, number: '', cvv: '' }));

      if (!tokenizeRes.ok) {
        throw new Error(tokenizeJson.error?.message || 'Falha ao tokenizar cartão');
      }
      const token = (tokenizeJson.data ?? tokenizeJson).token as string;

      const res = await fetch('/api/payments/asaas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current?.signal,
        body: JSON.stringify({
          // amount chega em reais; a API cobra em centavos.
          amountCents: Math.round(amount * 100),
          description: paymentType === 'wallet_topup' ? 'Recarga de carteira' : 'Pagamento de envio',
          paymentMethod: 'credit_card',
          cardToken: token,
          metadata: { type: paymentType },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Pagamento recusado');

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Encerrar o estado de "processando" ANTES de avisar o pai: sem isso o
      // overlay de carregamento ficava para sempre na tela, mesmo com o
      // pagamento já aprovado no gateway. (SavedCardPaymentForm já fazia assim.)
      setProcessing(false);
      onSuccess((data.data ?? data).transactionId);
    } catch (err) {
      // Rede fora, abort etc. podem interromper antes da resposta do
      // tokenize chegar — higieniza de novo aqui como rede de segurança
      // (idempotente, sem custo se já estiver limpo).
      setForm((f) => ({ ...f, number: '', cvv: '' }));
      if ((err as Error).name !== 'AbortError') {
        setProcessing(false);
        onError(err instanceof Error ? err : new Error('Erro no pagamento'));
      }
    }
  };

  return (
    <ELCard>
      <ELModal open={processing} footer={null} closable={false} centered>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <ELSpin indicator={<LoadingOutlined spin style={{ fontSize: 32 }} />} />
          <p style={{ marginTop: 16 }}>Processando pagamento...</p>
        </div>
      </ELModal>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          placeholder="Número do cartão"
          value={form.number}
          onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
          style={{ padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
        <input
          placeholder="Nome no cartão"
          value={form.holderName}
          onChange={e => setForm(f => ({ ...f, holderName: e.target.value }))}
          style={{ padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="MM"
            value={form.expMonth}
            onChange={e => setForm(f => ({ ...f, expMonth: e.target.value }))}
            style={{ flex: 1, padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
          <input
            placeholder="AA"
            value={form.expYear}
            onChange={e => setForm(f => ({ ...f, expYear: e.target.value }))}
            style={{ flex: 1, padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
          <input
            placeholder="CVV"
            value={form.cvv}
            onChange={e => setForm(f => ({ ...f, cvv: e.target.value }))}
            style={{ flex: 1, padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            placeholder="CEP do titular"
            value={form.postalCode}
            onChange={e => setForm(f => ({ ...f, postalCode: maskCEP(e.target.value) }))}
            maxLength={9}
            style={{ flex: 2, padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
          <input
            placeholder="Número"
            value={form.addressNumber}
            onChange={e => setForm(f => ({ ...f, addressNumber: e.target.value }))}
            style={{ flex: 1, padding: 8, border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
        </div>
        {fieldError && (
          <ELAlert type="error" message={fieldError} />
        )}
        <ELButton type="primary" onClick={handleSubmit} loading={processing} block>
          Pagar R$ {amount.toFixed(2).replace('.', ',')}
        </ELButton>
      </div>
    </ELCard>
  );
}

export default CardPaymentForm;
