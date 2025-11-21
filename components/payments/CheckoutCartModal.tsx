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

import type { Cart } from '@/types/cart';

interface CheckoutCartModalProps {
  open: boolean;
  onClose: () => void;
  cart: Cart;
}

interface WalletData {
  balance: {
    availableReais: number;
    availableCents: number;
    pendingReais: number;
    pendingCents: number;
  };
  monthlySummary?: unknown;
  latestTransactions?: unknown[];
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
  cart,
}: CheckoutCartModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalAmount = cart.total;
  const itemCount = cart.items.length;

  console.debug('[CHECKOUT_CART] cart items=', itemCount, 'total=', totalAmount);

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

  const balance = walletData?.balance?.availableReais ?? 0;
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
      // PASSO 1: Criar shipments a partir do carrinho
      console.log('[CHECKOUT_CART] Criando shipments...');
      const checkoutRes = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!checkoutRes.ok) {
        const error = await checkoutRes.json();
        throw new Error(error.message || 'Erro ao criar shipments');
      }

      const checkoutData = await checkoutRes.json();
      const { cartId, shipmentIds } = checkoutData;

      console.log('[CHECKOUT_CART] Shipments criados:', shipmentIds);

      // PASSO 2: Processar pagamento de acordo com o método selecionado
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
              itemCount,
            },
          }),
        });

        if (!debitRes.ok) {
          const error = await debitRes.json();
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

      // PASSO 3: Limpar carrinho
      await fetch('/api/carrinho', { method: 'DELETE' });

      // PASSO 4: Invalidar cache e redirecionar
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

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
            Você está pagando {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
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
