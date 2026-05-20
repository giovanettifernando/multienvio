'use client';

import { useState, useRef, useCallback, useEffect, startTransition } from 'react';
import { useELApp } from '@/shared/ui';
const App = { useApp: useELApp };
import type { PaymentResult, PixPaymentStatus } from './checkoutTypes';

interface UsePixPaymentOptions {
  onPaymentConfirmed: () => Promise<void>;
}

export function usePixPayment({ onPaymentConfirmed }: UsePixPaymentOptions) {
  const { message } = App.useApp();

  const [pixData, setPixData] = useState<PaymentResult | null>(null);
  const [pixPolling, setPixPolling] = useState(false);
  const [pixStatus, setPixStatus] = useState<PixPaymentStatus>('pending');
  const [pixExpireSeconds, setPixExpireSeconds] = useState(30 * 60); // 30 minutes

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
  }, []);

  // Check PIX payment status
  const checkPixStatus = useCallback(async () => {
    if (!pixData?.transaction?.id) return;

    try {
      const refreshRes = await fetch(`/api/payments/${pixData.transaction.id}/refresh`, {
        method: 'POST',
      });

      if (!refreshRes.ok) {
        console.warn('[PIX_POLL] Erro no refresh:', refreshRes.status);
        return;
      }

      const refreshJson = await refreshRes.json();
      // Handle standardized API response format { data: T, error, meta }
      const refreshData = refreshJson.data ?? refreshJson;
      console.log('[PIX_POLL] Status atualizado:', refreshData.payment?.status);

      if (refreshData.payment?.status === 'PAID') {
        setPixStatus('paid');
        setPixPolling(false);
        clearIntervals();
        await onPaymentConfirmed();
      } else if (['CANCELED', 'FAILED', 'EXPIRED'].includes(refreshData.payment?.status)) {
        setPixStatus('expired');
        setPixPolling(false);
        clearIntervals();
      }
    } catch (error) {
      console.error('[PIX_POLL] Erro ao verificar status:', error);
    }
  }, [pixData, onPaymentConfirmed, clearIntervals]);

  // Generate PIX QR Code
  const generatePix = async (totalAmount: number, itemCount: number, email: string) => {
    console.log('[CHECKOUT_CART] Gerando PIX...');

    const amountCents = Math.round(totalAmount * 100);
    const pixRes = await fetch('/api/payments/pagarme/create', {
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
      orderId: string;
      status: string;
      pixQrCode?: string;
      pixQrCodeUrl?: string;
    };

    // Normalise to PaymentResult shape used by the rest of the component
    const pixResult: PaymentResult = {
      success: true,
      transaction: {
        id: rawResult.transactionId,
        referenceId: rawResult.orderId,
        status: rawResult.status,
        amountCents,
        method: 'pix',
      },
      payment: {
        id: 0,
        status: rawResult.status,
        statusDetail: rawResult.status,
        pixQrCode: rawResult.pixQrCode,
        pixQrCodeUrl: rawResult.pixQrCodeUrl,
      },
    };
    setPixData(pixResult);
    message.success('QR Code PIX gerado com sucesso!');
    return pixResult;
  };

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
    }, 5000);

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

  // Reset PIX state
  const resetPix = useCallback(() => {
    clearIntervals();
    setPixData(null);
    setPixPolling(false);
    setPixStatus('pending');
    setPixExpireSeconds(30 * 60);
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
  };
}
