'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useELApp } from '@/shared/ui';
const App = { useApp: useELApp };
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

  const handleSuccess = async (result: { transactionId?: string; method: string }) => {
    try {
      // Marcar pagamento aprovado no shipment
      const response = await fetch(`/api/shipments/${shipmentId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method: result.method,
          status: 'approved',
          meta: {
            transactionId: result.transactionId,
            amount: totalAmount,
          },
        }),
      });

      if (!response.ok) {
        console.error('[CHECKOUT] Erro ao atualizar pagamento:', await response.text());
      }

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      // Pré-carregar cache do shipment específico para evitar "não encontrado"
      queryClient.invalidateQueries({ queryKey: ['shipment', shipmentId] });

      message.success('Pagamento aprovado! Etiqueta sendo emitida...');

      // Pequeno delay para garantir que o banco processou a transação
      await new Promise((resolve) => setTimeout(resolve, 500));

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
      description={`Pagamento envio ${trackingCode || shipmentId} - Multienvio`}
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
