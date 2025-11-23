"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  Alert,
} from "antd";
import {
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { CardPaymentForm } from "./CardPaymentForm";
import { SavedCardPaymentForm } from "./SavedCardPaymentForm";
import { useCards } from "@/hooks/useAccount";

const { Text } = Typography;

type PaymentMethod = 'pix' | 'card';

interface MercadoPagoPaymentResult {
  success: boolean;
  transaction: {
    id: string;
    referenceId: string;
    status: string;
    amountCents: number;
    method: string;
  };
  payment: {
    id: number;
    status: string;
    statusDetail: string;
    pixQrCode?: string;
    pixQrCodeBase64?: string;
    boletoUrl?: string;
    boletoBarcode?: string;
  };
}

async function createMercadoPagoPayment(
  amount: number,
  email: string
): Promise<MercadoPagoPaymentResult> {
  const response = await fetch("/api/payments/mercadopago/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionAmount: amount,
      paymentMethodId: 'pix',
      payer: {
        email,
      },
      description: `Recarga de carteira - R$ ${amount.toFixed(2)}`,
      metadata: {
        type: 'wallet_topup',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.message ?? "Não foi possível criar o pagamento");
  }

  return response.json();
}

export type AddFundsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function AddFundsModal({
  open,
  onClose,
}: AddFundsModalProps) {
  const { message: messageApi } = App.useApp();

  const [topUpAmount, setTopUpAmount] = useState<number>(0);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<MercadoPagoPaymentResult | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true); // true = usar cartão salvo, false = novo cartão

  // Buscar cartões salvos usando hook otimizado
  const { data: savedCards, isLoading: isLoadingCards } = useCards();

  // Buscar dados do usuário para email
  const { data: user } = useQuery<{ email: string }>({
    queryKey: ['user-session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Erro ao buscar dados do usuário');
      return res.json();
    },
    enabled: open,
  });

  const isConfirmDisabled =
    !selectedMethod ||
    !topUpAmount ||
    topUpAmount <= 0;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const handleConfirm = async () => {
    if (!selectedMethod || !topUpAmount || topUpAmount <= 0) return;

    setLoading(true);

    try {
      if (selectedMethod === 'pix') {
        // Criar pagamento PIX via Mercado Pago
        const paymentResult = await createMercadoPagoPayment(
          topUpAmount,
          user?.email || 'usuario@example.com'
        );

        setPixData(paymentResult);
        messageApi.success('QR Code PIX gerado com sucesso!');

      } else if (selectedMethod === 'card') {
        // Mostrar formulário de cartão do Mercado Pago
        setShowCardForm(true);
        setLoading(false);
        return;
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
    setPixData(null);
    setTopUpAmount(0);
    setSelectedMethod(null);
    setShowCardForm(false);
    setUseSavedCard(true); // Reset para cartão salvo por padrão
    onClose();
  };

  const handleCardSuccess = (paymentId: number) => {
    messageApi.success('Pagamento processado com sucesso!');
    console.log('[CARD_SUCCESS] Payment ID:', paymentId);
    handleClose();
    // Invalidar query da carteira para atualizar saldo
    window.location.reload(); // TODO: melhorar com invalidateQueries
  };

  const handleCardError = (error: Error) => {
    messageApi.error(error.message || 'Erro ao processar pagamento');
    setShowCardForm(false);
  };

  // Se estiver mostrando formulário de cartão
  if (showCardForm) {
    // Decidir qual formulário mostrar: cartão salvo ou novo cartão
    const hasSavedCards = savedCards && savedCards.length > 0;
    const shouldShowSavedCardForm = useSavedCard && hasSavedCards;

    return (
      <Modal
        title={shouldShowSavedCardForm ? "Pagar com Cartão Salvo" : "Pagamento com Cartão - Mercado Pago"}
        open={open}
        onCancel={() => {
          setShowCardForm(false);
          setUseSavedCard(true); // Reset ao fechar
        }}
        footer={null}
        width={700}
      >
        {shouldShowSavedCardForm ? (
          <SavedCardPaymentForm
            amount={topUpAmount}
            onSuccess={handleCardSuccess}
            onError={handleCardError}
            onUseNewCard={() => setUseSavedCard(false)} // Trocar para formulário de novo cartão
          />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Valor a pagar: </Text>
              <Text style={{ fontSize: 20, color: '#52c41a' }}>
                {formatCurrency(topUpAmount)}
              </Text>
            </div>

            <CardPaymentForm
              amount={topUpAmount}
              onSuccess={handleCardSuccess}
              onError={handleCardError}
            />

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {hasSavedCards && (
                <Button type="link" onClick={() => setUseSavedCard(true)} block>
                  Voltar para cartões salvos
                </Button>
              )}
              <Button onClick={() => setShowCardForm(false)} block>
                Cancelar
              </Button>
            </Space>
          </Space>
        )}
      </Modal>
    );
  }

  // Se estiver mostrando QR Code PIX
  if (pixData && pixData.payment.pixQrCode) {
    return (
      <Modal
        title="QR Code PIX - Mercado Pago"
        open={open}
        onCancel={handleClose}
        footer={[
          <Button key="close" onClick={handleClose}>
            Fechar
          </Button>,
        ]}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="Aguardando pagamento"
            description="Após escanear o QR Code e realizar o pagamento, o saldo será creditado automaticamente em sua carteira."
            type="info"
            showIcon
          />

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
              Escaneie o QR Code abaixo com o app do seu banco:
            </Text>

            {/* QR Code real do Mercado Pago */}
            {pixData.payment.pixQrCodeBase64 && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`data:image/png;base64,${pixData.payment.pixQrCodeBase64}`}
                alt="QR Code PIX"
                style={{
                  width: 280,
                  height: 280,
                  border: '2px solid #d9d9d9',
                  borderRadius: 12,
                  padding: 16,
                  background: '#fff',
                }}
              />
            )}

            <div style={{ marginTop: 16 }}>
              <Text strong style={{ fontSize: 18 }}>
                {formatCurrency(topUpAmount)}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID da transação: {pixData.transaction.referenceId}
              </Text>
            </div>
          </div>

          <Alert
            message="PIX Copia e Cola"
            description={
              <div style={{ wordBreak: 'break-all', fontSize: 12 }}>
                {pixData.payment.pixQrCode}
                <br />
                <Button
                  type="link"
                  size="small"
                  onClick={() => {
                    navigator.clipboard.writeText(pixData.payment.pixQrCode!);
                    messageApi.success('Código PIX copiado!');
                  }}
                  style={{ paddingLeft: 0 }}
                >
                  Copiar código
                </Button>
              </div>
            }
            type="warning"
          />

          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
            O saldo será creditado automaticamente após a confirmação do pagamento pelo Mercado Pago.
          </Text>
        </Space>
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
              onChange={(e) => setSelectedMethod(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* PIX */}
                <Radio value="pix" style={{ width: '100%' }}>
                  <Space>
                    <QrcodeOutlined style={{ fontSize: 20 }} />
                    <div>PIX via Mercado Pago</div>
                  </Space>
                </Radio>

                {/* Cartão de crédito */}
                <Radio value="card" style={{ width: '100%' }}>
                  <Space>
                    <CreditCardOutlined style={{ fontSize: 20 }} />
                    <div>Cartão de crédito via Mercado Pago</div>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
        )}

        {selectedMethod === 'pix' && (
          <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Você receberá um QR Code do Mercado Pago para realizar o pagamento.
              Após a confirmação automática pelo gateway, o saldo será creditado em sua carteira.
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  );
}

export default AddFundsModal;
