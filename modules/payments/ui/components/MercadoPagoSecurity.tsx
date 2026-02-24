"use client";

import { useEffect } from "react";
import Script from "next/script";

/**
 * Componente que carrega o script de segurança do Mercado Pago
 * para coleta de Device Fingerprint (antifraude)
 *
 * @see https://www.mercadopago.com.ar/developers/en/docs/wallet-connect/payment-flow/capture-payment/device-id
 */
export function MercadoPagoSecurity() {
  useEffect(() => {
    // Limpar variável global ao desmontar (para evitar stale data)
    return () => {
      if (typeof window !== "undefined") {
        window.MP_DEVICE_SESSION_ID = undefined;
      }
    };
  }, []);

  return (
    <Script
      src="https://www.mercadopago.com/v2/security.js"
      strategy="afterInteractive"
      data-view="checkout"
    />
  );
}

/**
 * Obtém o Device Session ID gerado pelo script de segurança do MP
 * Usado para melhorar a análise antifraude
 *
 * @returns Device Session ID ou undefined se não disponível
 */
export function getDeviceSessionId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.MP_DEVICE_SESSION_ID;
}

export default MercadoPagoSecurity;
