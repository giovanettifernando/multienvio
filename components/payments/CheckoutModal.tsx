'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { App } from 'antd';
import { PaymentModal } from './PaymentModal';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  totalAmount: number;
  trackingCode?: string;
}

/**
 * Modal de checkout para pagamento de um único shipment.
 * Wrapper do PaymentModal com lógica específica para shipments.
 */
export function CheckoutModal({
  open,
  onClose,
  shipmentId,
  totalAmount,
  trackingCode,
}: CheckoutModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const handleSuccess = async (result: { paymentId?: number; method: string }) => {
    try {
      // Marcar pagamento aprovado no shipment
      await fetch(`/api/shipments/${shipmentId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: result.method,
          status: 'approved',
          meta: {
            mercadoPagoPaymentId: result.paymentId,
            amount: totalAmount,
          },
        }),
      });

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      message.success('Pagamento aprovado! Etiqueta sendo emitida...');
      router.push(`/shipments/${shipmentId}`);
    } catch (error) {
      console.error('[CHECKOUT] Erro ao finalizar:', error);
      message.error('Pagamento aprovado, mas houve erro ao processar. Entre em contato com o suporte.');
    }
  };

  return (
    <PaymentModal
      open={open}
      onClose={onClose}
      mode="checkout"
      amount={totalAmount}
      allowWallet={true}
      description={`Pagamento envio ${trackingCode || shipmentId} - Envio Legal`}
      metadata={{
        type: 'checkout_payment',
        shipmentId,
        trackingCode,
        referenceId: `shipment:${shipmentId}`,
        reason: 'shipment_payment',
      }}
      onSuccess={handleSuccess}
    />
  );
}
