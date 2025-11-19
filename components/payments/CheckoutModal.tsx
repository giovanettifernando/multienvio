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

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  shipmentId: string;
  totalAmount: number;
  trackingCode?: string;
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

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  console.debug('[CHECKOUT] shipmentId=', shipmentId);

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
    (selectedMethod === 'wallet' && isWalletDisabled) ||
    (selectedMethod === 'card' && !selectedCardId) ||
    loading;

  const handleConfirm = async () => {
    if (isConfirmDisabled) return;

    setLoading(true);

    try {
      if (selectedMethod === 'wallet') {
        // 1) Debitar carteira (idempotente)
        const debitRes = await fetch('/api/wallet/debit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipmentId,
            amount: totalAmount,
            reason: 'shipment_payment',
            trackingCode,
          }),
        });

        const debitData = await debitRes.json();

        // Tratar saldo insuficiente
        if (!debitRes.ok && debitData?.code === 'INSUFFICIENT_FUNDS') {
          message.error('Saldo insuficiente na carteira.');
          return;
        }

        // Se não ok e não é saldo insuficiente, erro genérico
        if (!debitRes.ok) {
          throw new Error(debitData.message || 'Erro ao debitar carteira');
        }

        // Sucesso (novo ou idempotente)
        if (debitData.ok || debitData.idempotent) {
          // 2) Marcar pagamento aprovado no shipment
          await fetch(`/api/shipments/${shipmentId}/payment`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'wallet',
              status: 'approved',
              transactionId: debitData.transactionId,
              meta: { amount: totalAmount },
            }),
          });

          // 3) Invalidar queries da carteira (atualizar saldo no header)
          queryClient.invalidateQueries({ queryKey: ['wallet'] });

          // Mensagem de sucesso
          const successMessage = debitData.idempotent
            ? 'Pagamento já processado anteriormente.'
            : 'Pagamento aprovado via carteira.';
          message.success(successMessage);

          // Redirecionar para a tela do pedido
          onClose();
          router.push(`/shipments/${shipmentId}`);
          return;
        }

        // Se chegou aqui, algo inesperado aconteceu
        throw new Error('Resposta inesperada do servidor');

      } else if (selectedMethod === 'pix') {
        // Pagamento via PIX (simulado - sem gateway)
        await fetch(`/api/shipments/${shipmentId}/payment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'pix',
            status: 'approved',
            meta: { simulated: true },
          }),
        });

        message.success('Pagamento aprovado via PIX (simulado).');

        // Redirecionar para a tela do pedido
        onClose();
        router.push(`/shipments/${shipmentId}`);

      } else if (selectedMethod === 'card' && selectedCardId) {
        // Pagamento via cartão (simulado - sem gateway)
        await fetch(`/api/shipments/${shipmentId}/payment`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'card',
            status: 'approved',
            meta: { cardId: selectedCardId, simulated: true },
          }),
        });

        message.success('Pagamento aprovado no cartão (simulado).');

        // Redirecionar para a tela do pedido
        onClose();
        router.push(`/shipments/${shipmentId}`);
      }

    } catch (error) {
      console.error('[CHECKOUT_ERROR]', error);
      message.error('Não foi possível concluir o pagamento.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getBrandLabel = (brand: string) => {
    return BRAND_LABELS[brand.toLowerCase()] || brand;
  };

  return (
    <Modal
      title="Escolha a forma de pagamento"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          disabled={isConfirmDisabled}
          onClick={handleConfirm}
          icon={<CheckCircleOutlined />}
        >
          Confirmar pagamento
        </Button>,
      ]}
      width={600}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>Total a pagar:</Text>{' '}
          <Text style={{ fontSize: 20, color: '#1890ff' }}>
            {formatCurrency(totalAmount)}
          </Text>
        </div>

        {isLoadingWallet || isLoadingCards ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Carregando opções de pagamento..." />
          </div>
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
              <Radio
                value="wallet"
                disabled={isWalletDisabled}
                style={{ width: '100%' }}
                aria-label="Pagar com carteira"
              >
                <Space>
                  <WalletOutlined style={{ fontSize: 20 }} />
                  <div>
                    <div>
                      <Text strong>Carteira</Text> •{' '}
                      <Text>Saldo: {formatCurrency(balance)}</Text>
                    </div>
                    {isWalletDisabled && (
                      <Text type="danger" style={{ fontSize: 12 }}>
                        Saldo insuficiente
                      </Text>
                    )}
                  </div>
                </Space>
              </Radio>

              {/* PIX */}
              <Radio value="pix" style={{ width: '100%' }} aria-label="Pagar com PIX">
                <Space>
                  <QrcodeOutlined style={{ fontSize: 20 }} />
                  <Text strong>PIX</Text>
                </Space>
              </Radio>

              {/* Cartões salvos */}
              {cards.length > 0 && (
                <div style={{ width: '100%' }}>
                  <Radio
                    value="card"
                    style={{ width: '100%', marginBottom: 8 }}
                    aria-label="Pagar com cartão"
                  >
                    <Space>
                      <CreditCardOutlined style={{ fontSize: 20 }} />
                      <Text strong>Cartão de crédito</Text>
                    </Space>
                  </Radio>

                  {selectedMethod === 'card' && (
                    <div style={{ marginLeft: 32, marginTop: 8 }}>
                      <Radio.Group
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <Space direction="vertical" size="small" style={{ width: '100%' }}>
                          {cards.map((card) => (
                            <Radio
                              key={card.id}
                              value={card.id}
                              style={{ width: '100%' }}
                            >
                              <Space>
                                <CreditCardOutlined />
                                <Text>
                                  {getBrandLabel(card.brand)} •••• {card.last4}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {card.expMonth.toString().padStart(2, '0')}/{card.expYear}
                                </Text>
                              </Space>
                            </Radio>
                          ))}
                        </Space>
                      </Radio.Group>
                    </div>
                  )}
                </div>
              )}
            </Space>
          </Radio.Group>
        )}

        {selectedMethod && (
          <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedMethod === 'wallet' &&
                'O valor será debitado imediatamente da sua carteira.'}
              {selectedMethod === 'pix' &&
                'Você será redirecionado para realizar o pagamento via PIX.'}
              {selectedMethod === 'card' &&
                'O pagamento será processado no cartão selecionado.'}
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  );
}
