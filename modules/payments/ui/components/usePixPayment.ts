'use client';

import { useState, useRef, useCallback, useEffect, startTransition } from 'react';
import { useELApp } from '@/shared/ui';
const App = { useApp: useELApp };
import type { PaymentResult, PixPaymentStatus, BoletoPaymentData } from './checkoutTypes';
import { formatBoletoDueDate } from './checkoutTypes';

interface UsePixPaymentOptions {
  onPaymentConfirmed: () => Promise<void>;
}

// PIX confirma em segundos — checar a cada 5s faz sentido. Boleto compensa em
// até 3 dias úteis; manter o mesmo intervalo agressivo seria desperdício de
// chamadas (backend + Asaas) para um status que não muda por horas a fio.
// 5 minutos é um meio-termo sensato: rápido o bastante para o usuário ver a
// confirmação ainda dentro de uma sessão aberta, sem martelar a API por dias.
const PIX_POLL_INTERVAL_MS = 5 * 1000;
const BOLETO_POLL_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Hook de acompanhamento de pagamento pendente (Task 15).
 *
 * Nome do arquivo/hook mantido como `usePixPayment` por compatibilidade — é
 * consumido por vários componentes (`CheckoutCartModal`, `PaidCheckoutModal`)
 * e renomear espalharia a mudança sem necessidade. Por baixo, o hook hoje
 * cobre dois meios de pagamento pendente (PIX e boleto): ambos consultam
 * `/api/payments/[id]/refresh` até o status sair de `PENDING`, e essa parte
 * (`fetchPendingPaymentStatus`) é genérica desde esta task. O que continua
 * exclusivo do PIX é o QR Code e o contador de expiração de 30 minutos — não
 * existe equivalente para boleto (o "vencimento" é dias à frente, não um
 * timer de sessão).
 */
export function usePixPayment({ onPaymentConfirmed }: UsePixPaymentOptions) {
  const { message } = App.useApp();

  const [pixData, setPixData] = useState<PaymentResult | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const [pixStatus, setPixStatus] = useState<PixPaymentStatus>('pending');
  const [pixExpireSeconds, setPixExpireSeconds] = useState(30 * 60); // 30 minutes

  const [boletoData, setBoletoData] = useState<BoletoPaymentData | null>(null);
  const [boletoPolling, setBoletoPolling] = useState(false);
  const [boletoStatus, setBoletoStatus] = useState<PixPaymentStatus>('pending');

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const boletoPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Clear intervals helper (defined before checkPixStatus to avoid TDZ)
  const clearIntervals = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (boletoPollingIntervalRef.current) {
      clearInterval(boletoPollingIntervalRef.current);
      boletoPollingIntervalRef.current = null;
    }
  }, []);

  // Consulta genérica de status de um pagamento pendente (PIX ou boleto) —
  // ambos leem a mesma rota de refresh e o mesmo campo de status; só quem
  // chama muda (checkPixStatus / checkBoletoStatus).
  const fetchPendingPaymentStatus = useCallback(
    async (transactionId: string): Promise<'paid' | 'expired' | null> => {
      const refreshRes = await fetch(`/api/payments/${transactionId}/refresh`, {
        method: 'POST',
      });

      if (!refreshRes.ok) {
        console.warn('[PENDING_PAYMENT_POLL] Erro no refresh:', refreshRes.status);
        return null;
      }

      const refreshJson = await refreshRes.json();
      // Handle standardized API response format { data: T, error, meta }
      const refreshData = refreshJson.data ?? refreshJson;
      console.log('[PENDING_PAYMENT_POLL] Status atualizado:', refreshData.payment?.status);

      if (refreshData.payment?.status === 'PAID' || refreshData.payment?.status === 'CAPTURED') {
        return 'paid';
      }
      if (['CANCELED', 'FAILED', 'EXPIRED'].includes(refreshData.payment?.status)) {
        return 'expired';
      }
      return null;
    },
    [],
  );

  // Check PIX payment status
  const checkPixStatus = useCallback(async () => {
    if (!pixData?.transaction?.id) return;

    try {
      const result = await fetchPendingPaymentStatus(pixData.transaction.id);

      if (result === 'paid') {
        setPixStatus('paid');
        setPixPolling(false);
        clearIntervals();
        await onPaymentConfirmed();
      } else if (result === 'expired') {
        setPixStatus('expired');
        setPixPolling(false);
        clearIntervals();
      }
    } catch (error) {
      console.error('[PIX_POLL] Erro ao verificar status:', error);
    }
  }, [pixData, onPaymentConfirmed, clearIntervals, fetchPendingPaymentStatus]);

  // Check boleto payment status
  const checkBoletoStatus = useCallback(async () => {
    if (!boletoData?.transactionId) return;

    try {
      const result = await fetchPendingPaymentStatus(boletoData.transactionId);

      if (result === 'paid') {
        setBoletoStatus('paid');
        setBoletoPolling(false);
        if (boletoPollingIntervalRef.current) {
          clearInterval(boletoPollingIntervalRef.current);
          boletoPollingIntervalRef.current = null;
        }
        await onPaymentConfirmed();
      } else if (result === 'expired') {
        setBoletoStatus('expired');
        setBoletoPolling(false);
        if (boletoPollingIntervalRef.current) {
          clearInterval(boletoPollingIntervalRef.current);
          boletoPollingIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('[BOLETO_POLL] Erro ao verificar status:', error);
    }
  }, [boletoData, onPaymentConfirmed, fetchPendingPaymentStatus]);

  // Generate PIX QR Code
  const generatePix = async (totalAmount: number, itemCount: number, email: string) => {
    console.log('[CHECKOUT_CART] Gerando PIX...');
    void email; // mantido na assinatura por compatibilidade com os chamadores existentes

    const amountCents = Math.round(totalAmount * 100);
    const pixRes = await fetch('/api/payments/asaas/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountCents,
        paymentMethod: 'pix',
        description: `Pagamento de ${itemCount} envio(s) - Envio Legal`,
        metadata: { type: 'checkout_payment' },
      }),
    });

    if (!pixRes.ok) {
      const error = await pixRes.json();
      throw new Error(error.error?.message || error.message || 'Erro ao gerar PIX');
    }

    const json = await pixRes.json();
    // Handle standardized API response format { data: T, error, meta }
    const rawResult = (json.data ?? json) as {
      transactionId: string;
      chargeId: string;
      status: string;
      pixQrCode?: string;
      pixQrCodeImage?: string;
    };

    // Normalise to PaymentResult shape used by the rest of the component.
    // rawResult.transactionId é o ID real da PaymentTransaction (usado como
    // pagarmePaymentId pelos chamadores) — não existe mais um "payment.id"
    // numérico do gateway; quem precisar do identificador usa transaction.id.
    const pixResult: PaymentResult = {
      success: true,
      transaction: {
        id: rawResult.transactionId,
        referenceId: rawResult.chargeId,
        status: rawResult.status,
        amountCents,
        method: 'pix',
      },
      payment: {
        status: rawResult.status,
        statusDetail: rawResult.status,
        pixQrCode: rawResult.pixQrCode,
        pixQrCodeImage: rawResult.pixQrCodeImage,
      },
    };
    setPixData(pixResult);
    message.success('QR Code PIX gerado com sucesso!');
    return pixResult;
  };

  // Generate boleto (Task 15) — mesma rota de criação do PIX/cartão, só muda
  // paymentMethod. Compensação leva dias, então diferente do PIX não há
  // countdown de expiração de sessão aqui.
  const generateBoleto = useCallback(
    async (totalAmount: number, itemCount: number, description?: string) => {
      console.log('[CHECKOUT_CART] Gerando boleto...');

      const amountCents = Math.round(totalAmount * 100);
      const boletoRes = await fetch('/api/payments/asaas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents,
          paymentMethod: 'boleto',
          description: description || `Pagamento de ${itemCount} envio(s) - Envio Legal`,
          metadata: { type: 'checkout_payment' },
        }),
      });

      if (!boletoRes.ok) {
        const errorJson = await boletoRes.json();
        const error = errorJson.error ?? errorJson;
        throw new Error(error.message || error.error || 'Erro ao gerar boleto');
      }

      const boletoJson = await boletoRes.json();
      // Handle standardized API response format { data: T, error, meta }
      const rawResult = (boletoJson.data ?? boletoJson) as {
        transactionId: string;
        boletoUrl?: string;
        boletoBarcode?: string;
      };

      const result: BoletoPaymentData = {
        transactionId: rawResult.transactionId,
        boletoUrl: rawResult.boletoUrl || '',
        boletoBarcode: rawResult.boletoBarcode || '',
        // Vencimento não vem na resposta da API (não é persistido nem
        // retornado hoje — ver comentário de formatBoletoDueDate); usamos o
        // mesmo default (hoje + 3 dias) que o backend aplica quando nenhum
        // boletoDueDays é enviado, que é sempre o caso destes chamadores.
        dueDate: formatBoletoDueDate(),
      };
      setBoletoData(result);
      setBoletoStatus('pending');
      message.success('Boleto gerado com sucesso!');
      return result;
    },
    [message],
  );

  // Start polling for PIX payment status
  useEffect(() => {
    if (!pixData || pixStatus !== 'pending') {
      return;
    }

    console.log('[PIX_POLL] Iniciando polling...');
    startTransition(() => {
      setPixPolling(true);
    });

    // Check status every 5 seconds
    pollingIntervalRef.current = setInterval(() => {
      checkPixStatus();
    }, PIX_POLL_INTERVAL_MS);

    // Countdown timer
    countdownIntervalRef.current = setInterval(() => {
      setPixExpireSeconds((prev) => {
        if (prev <= 0) {
          setPixStatus('expired');
          setPixPolling(false);
          clearIntervals();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Initial check
    startTransition(() => {
      checkPixStatus();
    });

    return () => clearIntervals();
  }, [pixData, pixStatus, checkPixStatus, clearIntervals]);

  // Start polling for boleto payment status (intervalo bem mais longo — ver
  // BOLETO_POLL_INTERVAL_MS). Sem countdown: o boleto não "expira" numa
  // sessão, só vence dias depois.
  useEffect(() => {
    if (!boletoData || boletoStatus !== 'pending') {
      return;
    }

    console.log('[BOLETO_POLL] Iniciando acompanhamento...');
    startTransition(() => {
      setBoletoPolling(true);
    });

    boletoPollingIntervalRef.current = setInterval(() => {
      checkBoletoStatus();
    }, BOLETO_POLL_INTERVAL_MS);

    // Verificação inicial imediata
    startTransition(() => {
      checkBoletoStatus();
    });

    return () => {
      if (boletoPollingIntervalRef.current) {
        clearInterval(boletoPollingIntervalRef.current);
        boletoPollingIntervalRef.current = null;
      }
    };
  }, [boletoData, boletoStatus, checkBoletoStatus]);

  // Reset pending-payment state. Cobre PIX e boleto: dentro de uma mesma
  // sessão de checkout os dois são mutuamente exclusivos (usuário escolhe um
  // método por vez), então limpar os dois juntos é seguro e evita que os
  // chamadores precisem lembrar de zerar boletoData por conta própria.
  const resetPix = useCallback(() => {
    clearIntervals();
    setPixData(null);
    setPixPolling(false);
    setPixStatus('pending');
    setPixExpireSeconds(30 * 60);
    setBoletoData(null);
    setBoletoPolling(false);
    setBoletoStatus('pending');
  }, [clearIntervals]);

  // Retry PIX generation
  const retryPix = useCallback(() => {
    setPixData(null);
    setPixStatus('pending');
    setPixExpireSeconds(30 * 60);
  }, []);

  // Copy PIX code to clipboard
  const copyPixCode = useCallback(() => {
    if (pixData?.payment?.pixQrCode) {
      navigator.clipboard.writeText(pixData.payment.pixQrCode);
      message.success('Código PIX copiado!');
    }
  }, [pixData, message]);

  // Copy boleto's linha digitável to clipboard
  const copyBoletoCode = useCallback(() => {
    if (boletoData?.boletoBarcode) {
      navigator.clipboard.writeText(boletoData.boletoBarcode);
      message.success('Linha digitável copiada!');
    }
  }, [boletoData, message]);

  return {
    pixData,
    pixPolling,
    pixStatus,
    pixExpireSeconds,
    generatePix,
    resetPix,
    retryPix,
    copyPixCode,
    clearIntervals,
    boletoData,
    boletoPolling,
    boletoStatus,
    generateBoleto,
    copyBoletoCode,
  };
}
