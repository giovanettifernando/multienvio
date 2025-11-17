'use client';

import { useState } from 'react';
import { Modal, Radio, Button, Typography, Space, App, Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WalletOutlined,
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface CheckoutCartModalProps {
  open: boolean;
  onClose: () => void;
  cartId: string;
  shipmentIds: string[];
  totalAmount: number;
}

interface WalletData {
  balance: number;
  currency: string;
}

interface Card {
  id: string;
  brand: string;
  last4: string;
  holder: string;
  expMonth: number;
  expYear: number;
}

type PaymentMethod = 'wallet' | 'pix' | 'card';

// Mapeamento de bandeiras para ícones/labels
const BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
  hiper: 'Hiper',
};

export function CheckoutCartModal({
  open,
  onClose,
  cartId,
  shipmentIds,
  totalAmount,
}: CheckoutCartModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  console.debug('[CHECKOUT_CART] cartId=', cartId, 'shipmentIds=', shipmentIds);

  // Buscar saldo da carteira
  const {
    data: walletData,
    isLoading: isLoadingWallet,
  } = useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch('/api/wallet');
      if (!res.ok) throw new Error('Erro ao buscar saldo');
      return res.json();
    },
    enabled: open,
  });

  // Buscar cartões salvos
  const {
    data: cards = [],
    isLoading: isLoadingCards,
  } = useQuery<Card[]>({
    queryKey: ['cards'],
    queryFn: async () => {
      const res = await fetch('/api/cards');
      if (!res.ok) throw new Error('Erro ao buscar cartões');
      return res.json();
    },
    enabled: open,
  });

  const balance = walletData?.balance ?? 0;
  const hasInsufficientBalance = balance < totalAmount;

  const isWalletDisabled = hasInsufficientBalance;
  const isConfirmDisabled =
    !selectedMethod ||
    (selectedMethod === 'card' && !selectedCardId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirm = async () => {
    if (!selectedMethod) return;

    setLoading(true);

    try {
      if (selectedMethod === 'wallet') {
        // Debitar da carteira (idempotente por cartId)
        const debitRes = await fetch('/api/wallet/debit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceId: `cart:${cartId}`,
            amount: totalAmount,
            reason: 'cart_payment',
            metadata: {
              shipmentIds,
              itemCount: shipmentIds.length,
            },
          }),
        });

        if (!debitRes.ok) {
          const error = await debitRes.json();
          // Se for P2002 (duplicate), é idempotente - continuar
          if (!error.message?.includes('P2002') && !error.message?.includes('já foi debitado')) {
            throw new Error(error.message || 'Erro ao debitar da carteira');
          }
        }

        // Atualizar pagamento dos shipments
        await fetch('/api/shipments/payment-batch', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipmentIds,
            method: 'wallet',
            status: 'approved',
            meta: { amount: totalAmount },
          }),
        });

        // Invalidar cache da carteira
        queryClient.invalidateQueries({ queryKey: ['wallet'] });

        message.success('Pagamento com carteira aprovado!');
      } else if (selectedMethod === 'pix') {
        // Aprovar pagamento PIX (simulado)
        await fetch('/api/shipments/payment-batch', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipmentIds,
            method: 'pix',
            status: 'approved',
            meta: { simulated: true, amount: totalAmount },
          }),
        });

        message.success('Pagamento PIX aprovado (simulado)!');
      } else if (selectedMethod === 'card') {
        // Aprovar pagamento com cartão (simulado)
        await fetch('/api/shipments/payment-batch', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipmentIds,
            method: 'card',
            status: 'approved',
            meta: { simulated: true, amount: totalAmount, cardId: selectedCardId },
          }),
        });

        message.success('Pagamento com cartão aprovado (simulado)!');
      }

      // Limpar carrinho
      await fetch('/api/carrinho', { method: 'DELETE' });

      // Invalidar cache do carrinho e dos envios
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

      // Fechar modal e redirecionar
      onClose();
      router.push('/shipments');
    } catch (error) {
      console.error('[CHECKOUT_CART_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Escolha o método de pagamento"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          loading={loading}
          disabled={isConfirmDisabled}
          icon={<CheckCircleOutlined />}
        >
          Confirmar pagamento
        </Button>,
      ]}
      width={600}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>Total a pagar: </Text>
          <Text style={{ fontSize: 20, color: '#1890ff' }}>{formatCurrency(totalAmount)}</Text>
        </div>

        <div>
          <Text type="secondary">
            Você está pagando {shipmentIds.length} {shipmentIds.length === 1 ? 'envio' : 'envios'}
          </Text>
        </div>

        {(isLoadingWallet || isLoadingCards) ? (
          <Spin />
        ) : (
          <Radio.Group
            value={selectedMethod}
            onChange={(e) => {
              setSelectedMethod(e.target.value);
              if (e.target.value !== 'card') {
                setSelectedCardId(null);
              }
            }}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* Carteira */}
              <Radio value="wallet" disabled={isWalletDisabled}>
                <Space>
                  <WalletOutlined style={{ fontSize: 20 }} />
                  <div>
                    <div>Saldo em carteira</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Saldo disponível: {formatCurrency(balance)}
                    </Text>
                    {hasInsufficientBalance && (
                      <div>
                        <Text type="danger" style={{ fontSize: 12 }}>
                          Saldo insuficiente
                        </Text>
                      </div>
                    )}
                  </div>
                </Space>
              </Radio>

              {/* PIX */}
              <Radio value="pix">
                <Space>
                  <QrcodeOutlined style={{ fontSize: 20 }} />
                  <div>
                    <div>PIX</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Aprovação instantânea (simulado)
                    </Text>
                  </div>
                </Space>
              </Radio>

              {/* Cartão de crédito */}
              <Radio value="card">
                <Space>
                  <CreditCardOutlined style={{ fontSize: 20 }} />
                  <div>
                    <div>Cartão de crédito</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Parcelamento disponível (simulado)
                    </Text>
                  </div>
                </Space>
              </Radio>

              {/* Seleção de cartão */}
              {selectedMethod === 'card' && cards.length > 0 && (
                <div style={{ marginLeft: 32 }}>
                  <Radio.Group
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                  >
                    <Space direction="vertical">
                      {cards.map((card) => (
                        <Radio key={card.id} value={card.id}>
                          {BRAND_LABELS[card.brand] || card.brand} •••• {card.last4}
                          <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                            {card.expMonth.toString().padStart(2, '0')}/{card.expYear}
                          </Text>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </div>
              )}

              {selectedMethod === 'card' && cards.length === 0 && (
                <div style={{ marginLeft: 32 }}>
                  <Text type="secondary">Nenhum cartão cadastrado</Text>
                </div>
              )}
            </Space>
          </Radio.Group>
        )}
      </Space>
    </Modal>
  );
}
