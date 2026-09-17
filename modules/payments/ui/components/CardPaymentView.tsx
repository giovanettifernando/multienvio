'use client';

import { ELTypography, ELSpace } from '@/shared/ui';
const Typography = ELTypography;
const Space = ELSpace;
import { SavedCardPaymentForm } from '@/modules/wallet/ui/components/SavedCardPaymentForm';
import { CardPaymentForm } from '@/modules/wallet/ui/components/CardPaymentForm';
import { formatCurrency } from './checkoutTypes';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';

const { Text } = Typography;

interface CardPaymentViewProps {
  open: boolean;
  totalAmount: number;
  itemCount: number;
  savedCards: Array<{ id: string }> | undefined;
  useSavedCard: boolean;
  onUseSavedCard: (value: boolean) => void;
  onSuccess: (transactionId: string) => Promise<void>;
  onError: (error: Error) => void;
  onCancel: () => void;
}

export function CardPaymentView({
  open,
  totalAmount,
  itemCount,
  savedCards,
  useSavedCard,
  onUseSavedCard,
  onSuccess,
  onError,
  onCancel,
}: CardPaymentViewProps) {
  const hasSavedCards = savedCards && savedCards.length > 0;
  const shouldShowSavedCardForm = useSavedCard && hasSavedCards;

  return (
    <ELModal
      title="Pagamento com Cartão"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      {shouldShowSavedCardForm ? (
        <SavedCardPaymentForm
          amount={totalAmount}
          onSuccess={onSuccess}
          onError={onError}
          onUseNewCard={() => onUseSavedCard(false)}
          paymentType="checkout_payment"
          paymentDescription={`Pagamento de ${itemCount} envio(s) - Multienvio`}
        />
      ) : (
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ marginBottom: 16 }}>
            <Text strong>Valor a pagar: </Text>
            <Text style={{ fontSize: 20, color: '#52c41a' }}>
              {formatCurrency(totalAmount)}
            </Text>
            <br />
            <Text type="secondary">
              {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
            </Text>
          </div>

          <CardPaymentForm
            amount={totalAmount}
            onSuccess={onSuccess}
            onError={onError}
            paymentType="checkout_payment"
          />

          <Space orientation="vertical" size="small" style={{ width: '100%' }}>
            {hasSavedCards && (
              <ELButton variant="link" onClick={() => onUseSavedCard(true)} block>
                Voltar para cartões salvos
              </ELButton>
            )}
            <ELButton onClick={onCancel} block>
              Cancelar
            </ELButton>
          </Space>
        </Space>
      )}
    </ELModal>
  );
}
