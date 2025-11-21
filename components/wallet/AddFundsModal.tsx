"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  InputNumber,
  Modal,
  Radio,
  Space,
  Typography,
  App,
  Spin,
  Form,
} from "antd";
import {
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import type { PixTopup } from "@/types/billing";
import { PixQRCode } from "@/components/wallet/PixQRCode";

const { Text } = Typography;

interface Card {
  id: string;
  brand: string;
  last4: string;
  holder: string;
  expMonth: number;
  expYear: number;
  isDefault?: boolean;
}

type PaymentMethod = 'pix' | 'card';

// Mapeamento de bandeiras
const BRAND_LABELS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  elo: 'Elo',
  hipercard: 'Hipercard',
  hiper: 'Hiper',
};

async function createPixTopup(amount: number): Promise<PixTopup> {
  const response = await fetch("/api/wallet/topups/pix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountReais: amount }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.message ?? "Não foi possível gerar o PIX");
  }
  const data = await response.json();
  return {
    id: data.transactionId,
    qrCode: data.qrCode,
    amount: data.amountReais,
    referenceId: data.referenceId,
    status: data.status,
  } as PixTopup;
}

export type AddFundsModalProps = {
  open: boolean;
  onClose: () => void;
  onCardTopupSuccess?: () => void;
};

export function AddFundsModal({
  open,
  onClose,
  onCardTopupSuccess,
}: AddFundsModalProps) {
  const queryClient = useQueryClient();
  const { message: messageApi } = App.useApp();

  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixTopup, setPixTopup] = useState<PixTopup | null>(null);

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

  const isConfirmDisabled =
    !selectedMethod ||
    !topUpAmount ||
    topUpAmount <= 0 ||
    (selectedMethod === 'card' && !selectedCardId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getBrandLabel = (brand: string) => {
    return BRAND_LABELS[brand.toLowerCase()] || brand;
  };

  const handleConfirm = async () => {
    if (!selectedMethod || !topUpAmount || topUpAmount <= 0) return;

    setLoading(true);

    try {
      if (selectedMethod === 'pix') {
        // Gerar QR Code PIX
        const topupData = await createPixTopup(topUpAmount);
        setPixTopup(topupData);
        messageApi.success('QR Code gerado com sucesso!');

      } else if (selectedMethod === 'card' && selectedCardId) {
        // Processar pagamento com cartão
        const response = await fetch("/api/payments/topups/card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: topUpAmount,
            cardId: selectedCardId,
          }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => undefined);
          throw new Error(body?.mensagem ?? "Não foi possível processar o pagamento");
        }

        messageApi.success('Saldo adicionado com sucesso!');
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        onCardTopupSuccess?.();
        onClose();

        // Resetar estado
        setTopUpAmount(0);
        setSelectedMethod(null);
        setSelectedCardId(null);
      }
    } catch (error) {
      console.error('[ADD_FUNDS_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar recarga';
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPixTopup(null);
    setTopUpAmount(0);
    setSelectedMethod(null);
    setSelectedCardId(null);
    onClose();
  };

  // Se estiver mostrando QR Code PIX
  if (pixTopup) {
    return (
      <Modal
        title="QR Code PIX"
        open={open}
        onCancel={handleClose}
        footer={null}
        width={600}
      >
        <PixQRCode
          topup={pixTopup}
          onConfirm={() => {
            queryClient.invalidateQueries({ queryKey: ["wallet"] });
            handleClose();
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal
      title="Adicionar saldo"
      open={open}
      onCancel={handleClose}
      footer={[
        <Button key="cancel" onClick={handleClose} disabled={loading}>
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
          Confirmar recarga
        </Button>,
      ]}
      width={600}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Campo de valor da recarga */}
        <Form.Item
          label="Valor da recarga"
          required
          help={
            !topUpAmount || topUpAmount <= 0
              ? "Digite um valor maior que zero"
              : topUpAmount > 10000
              ? "O valor máximo é R$ 10.000,00"
              : "Valor mínimo: R$ 1,00 | Valor máximo: R$ 10.000,00"
          }
          validateStatus={
            !topUpAmount || topUpAmount <= 0 || topUpAmount > 10000 ? "error" : undefined
          }
        >
          <InputNumber
            value={topUpAmount}
            onChange={(value) => setTopUpAmount(value || 0)}
            min={1}
            max={10000}
            step={10}
            placeholder="R$ 0,00"
            style={{ width: '100%' }}
            prefix="R$"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
            parser={(value) => value?.replace(/\$\s?|(,*)/g, '') as unknown as number}
          />
        </Form.Item>

        {/* Total a adicionar */}
        <div>
          <Text strong>Total a adicionar: </Text>
          <Text style={{ fontSize: 20, color: '#52c41a' }}>
            {formatCurrency(topUpAmount || 0)}
          </Text>
        </div>

        {/* Lista de métodos de pagamento */}
        {isLoadingCards ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Carregando métodos de pagamento..." />
          </div>
        ) : (
          <div>
            <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
              Selecione o método de pagamento:
            </Text>
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
                {/* PIX */}
                <Radio value="pix" style={{ width: '100%' }}>
                  <Space>
                    <QrcodeOutlined style={{ fontSize: 20 }} />
                    <div>
                      <div>PIX</div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Aprovação instantânea via QR Code (simulado)
                      </Text>
                    </div>
                  </Space>
                </Radio>

                {/* Cartão de crédito */}
                <Radio value="card" style={{ width: '100%' }}>
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
                            {getBrandLabel(card.brand)} •••• {card.last4}
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
                    <Text type="secondary">Nenhum cartão cadastrado. </Text>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        window.location.href = "/minha-conta#cards";
                      }}
                    >
                      Cadastrar cartão
                    </Button>
                  </div>
                )}
              </Space>
            </Radio.Group>
          </div>
        )}

        {selectedMethod && (
          <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {selectedMethod === 'pix' &&
                'Você receberá um QR Code para realizar o pagamento. Após a confirmação, o saldo será creditado imediatamente.'}
              {selectedMethod === 'card' &&
                'O pagamento será processado no cartão selecionado e o saldo creditado imediatamente.'}
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  );
}

export default AddFundsModal;
