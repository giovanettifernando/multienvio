'use client';

import React, { useState } from 'react';
import {
  Modal,
  Typography,
  Space,
  Button,
  Radio,
  Card,
  Divider,
  Alert,
  message,
  Spin,
} from 'antd';
import {
  WarningOutlined,
  CreditCardOutlined,
  QrcodeOutlined,
} from '@ant-design/icons';
import { useWallet } from '@/hooks/useWallet';
import { useCards } from '@/hooks/useAccount';
import { formatNumberBR } from '@/lib/format';
import { useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

interface ResolveDebtModalProps {
  open: boolean;
  onClose: () => void;
}

type PaymentMethod = 'pix' | 'card';

export default function ResolveDebtModal({ open, onClose }: ResolveDebtModalProps) {
  const { data: walletData, isLoading: walletLoading } = useWallet();
  const { data: cards, isLoading: cardsLoading } = useCards();
  const queryClient = useQueryClient();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const available = walletData?.balance?.availableReais ?? 0;
  const hasDebt = available < 0;
  const debtAmount = Math.abs(available);

  const handleResolve = async () => {
    if (!hasDebt) {
      message.info('Não há pendências a resolver');
      onClose();
      return;
    }

    if (paymentMethod === 'card' && !selectedCardId) {
      message.warning('Selecione um cartão para continuar');
      return;
    }

    setIsProcessing(true);

    try {
      const response = await fetch('/api/wallet/resolve-debt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod,
          cardId: paymentMethod === 'card' ? selectedCardId : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro ao processar');
      }

      if (data.action === 'create_pix_payment') {
        // TODO: Integrar com fluxo de PIX
        message.info(
          `Gerando PIX de R$ ${formatNumberBR(data.amountToPayReais)}... Funcionalidade em desenvolvimento.`
        );
      } else if (data.action === 'create_card_payment') {
        // TODO: Integrar com fluxo de cartão
        message.info(
          `Processando pagamento de R$ ${formatNumberBR(data.amountToPayReais)} no cartão... Funcionalidade em desenvolvimento.`
        );
      }

      // Invalidar cache da carteira
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet', 'status'] });

      onClose();
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = walletLoading || cardsLoading;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={null}
      footer={null}
      width={500}
      destroyOnClose
    >
      <Spin spinning={isLoading}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', paddingTop: 16 }}>
            <WarningOutlined
              style={{ fontSize: 48, color: '#ff4d4f', marginBottom: 16 }}
            />
            <Title level={4} style={{ margin: 0 }}>
              Resolver Pendências Financeiras
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              Você possui um saldo negativo que precisa ser regularizado para
              continuar utilizando a plataforma.
            </Paragraph>
          </div>

          {/* Valor da dívida */}
          <Card
            style={{
              backgroundColor: '#fff1f0',
              borderColor: '#ffa39e',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">Valor pendente</Text>
              <Title
                level={2}
                style={{ margin: '8px 0', color: '#ff4d4f' }}
              >
                R$ {formatNumberBR(debtAmount)}
              </Title>
            </div>
          </Card>

          <Alert
            type="warning"
            message="Atenção"
            description="Enquanto houver pendências, você não poderá cotar novos envios."
            showIcon
          />

          <Divider>Escolha a forma de pagamento</Divider>

          {/* Seleção de método de pagamento */}
          <Radio.Group
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <Card
                hoverable
                style={{
                  cursor: 'pointer',
                  borderColor: paymentMethod === 'pix' ? '#1890ff' : undefined,
                }}
                onClick={() => setPaymentMethod('pix')}
              >
                <Radio value="pix">
                  <Space>
                    <QrcodeOutlined style={{ fontSize: 20, color: '#00b894' }} />
                    <div>
                      <Text strong>PIX</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Aprovação instantânea
                      </Text>
                    </div>
                  </Space>
                </Radio>
              </Card>

              <Card
                hoverable
                style={{
                  cursor: 'pointer',
                  borderColor: paymentMethod === 'card' ? '#1890ff' : undefined,
                }}
                onClick={() => setPaymentMethod('card')}
              >
                <Radio value="card">
                  <Space>
                    <CreditCardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                    <div>
                      <Text strong>Cartão de Crédito</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {cards && cards.length > 0
                          ? `${cards.length} cartão(s) disponível(is)`
                          : 'Nenhum cartão cadastrado'}
                      </Text>
                    </div>
                  </Space>
                </Radio>
              </Card>

              {/* Lista de cartões */}
              {paymentMethod === 'card' && cards && cards.length > 0 && (
                <Card size="small" style={{ marginLeft: 24 }}>
                  <Radio.Group
                    value={selectedCardId}
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      {cards.map((card) => (
                        <Radio key={card.id} value={card.id}>
                          <Space>
                            <Text>
                              {card.brand.toUpperCase()} **** {card.last4}
                            </Text>
                            <Text type="secondary">
                              {card.expMonth}/{card.expYear}
                            </Text>
                          </Space>
                        </Radio>
                      ))}
                    </Space>
                  </Radio.Group>
                </Card>
              )}

              {paymentMethod === 'card' && (!cards || cards.length === 0) && (
                <Alert
                  type="info"
                  message="Nenhum cartão cadastrado"
                  description="Cadastre um cartão em Minha Conta ou use PIX."
                  style={{ marginLeft: 24 }}
                />
              )}
            </Space>
          </Radio.Group>

          {/* Botões */}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onClose} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button
              type="primary"
              danger
              onClick={handleResolve}
              loading={isProcessing}
              disabled={
                !hasDebt ||
                (paymentMethod === 'card' && (!cards || cards.length === 0 || !selectedCardId))
              }
            >
              Pagar R$ {formatNumberBR(debtAmount)}
            </Button>
          </Space>
        </Space>
      </Spin>
    </Modal>
  );
}
