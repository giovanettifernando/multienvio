'use client';

import { Modal, Button, Typography, Space } from 'antd';
import { SavedCardPaymentForm } from '@/components/wallet/SavedCardPaymentForm';
import { CardPaymentForm } from '@/components/wallet/CardPaymentForm';
import { formatCurrency } from './checkoutTypes';

const { Text } = Typography;

interface CardPaymentViewProps {
  open: boolean;
  totalAmount: number;
  itemCount: number;
  savedCards: Array<{ id: string }> | undefined;
  useSavedCard: boolean;
  onUseSavedCard: (value: boolean) => void;
  onSuccess: (paymentId: number) => Promise<void>;
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
    <Modal
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
        />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
          />

          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            {hasSavedCards && (
              <Button type="link" onClick={() => onUseSavedCard(true)} block>
                Voltar para cartões salvos
              </Button>
            )}
            <Button onClick={onCancel} block>
              Cancelar
            </Button>
          </Space>
        </Space>
      )}
    </Modal>
  );
}
