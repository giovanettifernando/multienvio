"use client";
import { useState, useEffect, useRef } from "react";
import { ELCard, ELSpin, ELAlert, ELButton, ELModal } from '@/shared/ui';
import { LoadingOutlined } from "@ant-design/icons";

const CARD_PROCESSING_TIMEOUT_MS = 15000;

interface CardPaymentFormProps {
  amount: number; // in cents
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  paymentType?: 'wallet_topup' | 'checkout_payment';
}

interface TokenizeCardSDK {
  tokenize: (data: { card: { number: string; holder_name: string; exp_month: string; exp_year: string; cvv: string } }) => Promise<{ token: string }>;
}

declare global {
  interface Window { PagarmeCheckout?: TokenizeCardSDK; }
}

export function CardPaymentForm({ amount, onSuccess, onError, paymentType = 'wallet_topup' }: CardPaymentFormProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState({ number: '', holderName: '', expMonth: '', expYear: '', cvv: '' });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch('/api/payments/pagarme/public-key');
        if (!res.ok) throw new Error('Falha ao carregar configuração de pagamento');
        const json = await res.json();
        const pk = (json.data ?? json).publicKey;
        const existing = document.querySelector('[data-pagarmecheckout-app-id]');
        if (!existing) {
          const script = document.createElement('script');
          script.src = 'https://checkout.pagar.me/v1/tokenizecard.js';
          script.setAttribute('data-pagarmecheckout-app-id', pk);
          document.body.appendChild(script);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar formulário de pagamento');
      } finally {
        setLoading(false);
      }
    }
    init();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = async () => {
    if (!window.PagarmeCheckout) { onError(new Error('SDK de pagamento não carregado')); return; }
    setProcessing(true);
    abortRef.current = new AbortController();
    timeoutRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setProcessing(false);
      onError(new Error('Tempo esgotado, tente novamente'));
    }, CARD_PROCESSING_TIMEOUT_MS);

    try {
      const { token } = await window.PagarmeCheckout.tokenize({
        card: {
          number: form.number.replace(/\D/g, ''),
          holder_name: form.holderName,
          exp_month: form.expMonth,
          exp_year: form.expYear,
          cvv: form.cvv,
        },
      });

      const res = await fetch('/api/payments/pagarme/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({
          amountCents: amount,
          description: paymentType === 'wallet_topup' ? 'Recarga de carteira' : 'Pagamento de envio',
          paymentMethod: 'credit_card',
          cardToken: token,
          metadata: { type: paymentType },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Pagamento recusado');

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      onSuccess((data.data ?? data).transactionId);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setProcessing(false);
        onError(err instanceof Error ? err : new Error('Erro no pagamento'));
      }
    }
  };

  if (loading) return <ELSpin indicator={<LoadingOutlined spin />} />;
  if (error) return <ELAlert type="error" message={error} />;

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
        <ELButton type="primary" onClick={handleSubmit} loading={processing} block>
          Pagar R$ {(amount / 100).toFixed(2).replace('.', ',')}
        </ELButton>
      </div>
    </ELCard>
  );
}

export default CardPaymentForm;
