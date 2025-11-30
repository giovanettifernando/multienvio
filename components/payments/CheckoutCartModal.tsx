'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Radio, Button, Typography, Space, App, Spin, Alert, Progress } from 'antd';
import { LoadingOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WalletOutlined,
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { SavedCardPaymentForm } from '@/components/wallet/SavedCardPaymentForm';
import { CardPaymentForm } from '@/components/wallet/CardPaymentForm';
import { useCards } from '@/hooks/useAccount';

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

type PaymentMethod = 'wallet' | 'pix' | 'card';

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
  };
}

// Flag para indicar que há checkout PIX/Card em andamento
// Shipments só são criados APÓS confirmação do pagamento

export function CheckoutCartModal({
  open,
  onClose,
  cart,
}: CheckoutCartModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados para pagamento com cartão via Mercado Pago
  const [showCardForm, setShowCardForm] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [checkoutInProgress, setCheckoutInProgress] = useState(false);

  // Estados para PIX via Mercado Pago
  const [pixData, setPixData] = useState<MercadoPagoPaymentResult | null>(null);

  // Estado para polling de status PIX
  const [pixPolling, setPixPolling] = useState(false);
  const [pixStatus, setPixStatus] = useState<'pending' | 'paid' | 'expired' | 'error'>('pending');
  const [pixExpireSeconds, setPixExpireSeconds] = useState(30 * 60); // 30 minutos
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Buscar cartões salvos via hook
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

  const balance = walletData?.balance?.availableReais ?? 0;
  const hasInsufficientBalance = balance < totalAmount;
  const isWalletDisabled = hasInsufficientBalance;
  const isConfirmDisabled = !selectedMethod;
  const isLoading = isLoadingWallet || isLoadingCards;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função para verificar status do pagamento PIX
  const checkPixStatus = useCallback(async () => {
    if (!pixData?.transaction?.id) return;

    try {
      // Primeiro tenta refresh do MP
      const refreshRes = await fetch(`/api/payments/${pixData.transaction.id}/refresh`, {
        method: 'POST',
      });

      if (!refreshRes.ok) {
        console.warn('[PIX_POLL] Erro no refresh:', refreshRes.status);
        return;
      }

      const refreshData = await refreshRes.json();
      console.log('[PIX_POLL] Status atualizado:', refreshData.payment?.status);

      if (refreshData.payment?.status === 'PAID') {
        setPixStatus('paid');
        setPixPolling(false);

        // Limpar intervals
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        // Finalizar checkout - criar shipments agora que pagamento foi confirmado
        await finalizeCheckoutPix();
      } else if (['CANCELED', 'FAILED', 'EXPIRED'].includes(refreshData.payment?.status)) {
        setPixStatus('expired');
        setPixPolling(false);

        // Limpar intervals
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('[PIX_POLL] Erro ao verificar status:', error);
    }
  }, [pixData?.transaction?.id]);

  // Função para finalizar checkout após pagamento PIX confirmado
  // Cria os shipments AGORA que o pagamento foi aprovado
  const finalizeCheckoutPix = async () => {
    try {
      message.success('Pagamento PIX confirmado! Criando envios...');

      // Criar shipments a partir do carrinho (pagamento já confirmado)
      const checkoutRes = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'pix',
          paymentConfirmed: true,
          paymentMeta: {
            mercadoPagoPaymentId: pixData?.payment?.id,
            transactionId: pixData?.transaction?.id,
            amount: totalAmount,
          },
        }),
      });

      if (!checkoutRes.ok) {
        const error = await checkoutRes.json();
        throw new Error(error.message || 'Erro ao criar envios');
      }

      // Limpar carrinho
      await fetch('/api/carrinho', { method: 'DELETE' });

      // Invalidar cache e redirecionar
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      handleClose();
      router.push('/shipments');
    } catch (error) {
      console.error('[CHECKOUT_CART] Erro ao finalizar checkout PIX:', error);
      message.error('Pagamento confirmado, mas houve erro ao processar. Entre em contato com o suporte.');
    }
  };

  // Effect para polling do status PIX
  useEffect(() => {
    if (!pixData || !checkoutInProgress || pixStatus !== 'pending') {
      return;
    }

    console.log('[PIX_POLL] Iniciando polling...');
    setPixPolling(true);

    // Verificar status a cada 5 segundos
    pollingIntervalRef.current = setInterval(() => {
      checkPixStatus();
    }, 5000);

    // Countdown do tempo de expiração
    countdownIntervalRef.current = setInterval(() => {
      setPixExpireSeconds((prev) => {
        if (prev <= 0) {
          setPixStatus('expired');
          setPixPolling(false);
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Fazer primeira verificação imediatamente
    checkPixStatus();

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [pixData, checkoutInProgress, pixStatus, checkPixStatus]);

  // Função para finalizar checkout após pagamento com cartão aprovado
  // Cria os shipments AGORA que o pagamento foi aprovado
  const finalizeCheckoutCard = async (paymentId: number) => {
    try {
      message.success('Pagamento aprovado! Criando envios...');

      // Criar shipments a partir do carrinho (pagamento já confirmado)
      const checkoutRes = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentMethod: 'card',
          paymentConfirmed: true,
          paymentMeta: {
            mercadoPagoPaymentId: paymentId,
            amount: totalAmount,
          },
        }),
      });

      if (!checkoutRes.ok) {
        const error = await checkoutRes.json();
        throw new Error(error.message || 'Erro ao criar envios');
      }

      // Limpar carrinho
      await fetch('/api/carrinho', { method: 'DELETE' });

      // Invalidar cache e redirecionar
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

      handleClose();
      router.push('/shipments');
    } catch (error) {
      console.error('[CHECKOUT_CART] Erro ao finalizar checkout:', error);
      message.error('Pagamento aprovado, mas houve erro ao processar. Entre em contato com o suporte.');
    }
  };

  // Handler para sucesso do pagamento com cartão
  const handleCardSuccess = async (paymentId: number) => {
    console.log('[CHECKOUT_CART] Pagamento com cartão aprovado:', paymentId);
    await finalizeCheckoutCard(paymentId);
  };

  // Handler para erro do pagamento com cartão
  const handleCardError = (error: Error) => {
    message.error(error.message || 'Erro ao processar pagamento com cartão');
    // Não precisa de rollback - shipments não foram criados
    setShowCardForm(false);
    setCheckoutInProgress(false);
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!selectedMethod) return;

    setLoading(true);

    try {
      // Shipments só são criados APÓS confirmação do pagamento
      // Cada método de pagamento tem seu próprio fluxo

      if (selectedMethod === 'wallet') {
        // WALLET: Debitar e criar shipments
        // Nota: Opção só fica habilitada se houver saldo suficiente
        console.log('[CHECKOUT_CART] Processando pagamento com carteira...');

        // Gerar referenceId único para o débito
        const cartItemIds = cart.items.map(item => item.id).join(',');
        const debitReferenceId = `cart:${Date.now()}:${cartItemIds.slice(0, 50)}`;

        // Debitar da carteira
        await fetch('/api/wallet/debit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            referenceId: debitReferenceId,
            amount: totalAmount,
            reason: 'cart_payment',
            metadata: { itemCount },
          }),
        });

        // Criar shipments
        await fetch('/api/cart/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentMethod: 'wallet',
            paymentConfirmed: true,
            paymentMeta: {
              walletDebitReference: debitReferenceId,
              amount: totalAmount,
            },
          }),
        });

        // Limpar carrinho
        await fetch('/api/carrinho', { method: 'DELETE' });

        // Atualizar cache e redirecionar
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['cart'] });
        queryClient.invalidateQueries({ queryKey: ['shipments'] });

        message.success('Pagamento aprovado! Envios criados.');
        handleClose();
        router.push('/shipments');

      } else if (selectedMethod === 'pix') {
        // PIX: Gerar QR Code, shipments criados após confirmação
        console.log('[CHECKOUT_CART] Gerando PIX...');

        const pixRes = await fetch('/api/payments/mercadopago/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionAmount: totalAmount,
            paymentMethodId: 'pix',
            payer: {
              email: user?.email || 'usuario@example.com',
            },
            description: `Pagamento de ${itemCount} envio(s) - Envio Legal`,
            metadata: {
              type: 'checkout_payment',
              itemCount,
            },
          }),
        });

        if (!pixRes.ok) {
          const error = await pixRes.json();
          throw new Error(error.message || 'Erro ao gerar PIX');
        }

        const pixResult: MercadoPagoPaymentResult = await pixRes.json();
        setPixData(pixResult);
        setCheckoutInProgress(true);
        message.success('QR Code PIX gerado com sucesso!');
        setLoading(false);
        return; // Não fechar modal, aguardar pagamento

      } else if (selectedMethod === 'card') {
        // CARD: Mostrar formulário, shipments criados após confirmação
        console.log('[CHECKOUT_CART] Abrindo formulário de cartão...');
        setCheckoutInProgress(true);
        setShowCardForm(true);
        setLoading(false);
        return; // Não fechar modal, aguardar input do usuário
      }

    } catch (error) {
      console.error('[CHECKOUT_CART_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      message.error(errorMessage);
      setLoading(false);
    }
  };

  const handleClose = () => {
    // Limpar intervals de polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setSelectedMethod(null);
    setShowCardForm(false);
    setUseSavedCard(true);
    setCheckoutInProgress(false);
    setPixData(null);
    setPixPolling(false);
    setPixStatus('pending');
    setPixExpireSeconds(30 * 60);
    setLoading(false);
    onClose();
  };

  // Renderizar formulário de cartão do Mercado Pago
  if (showCardForm && checkoutInProgress) {
    const hasSavedCards = savedCards && savedCards.length > 0;
    const shouldShowSavedCardForm = useSavedCard && hasSavedCards;

    return (
      <Modal
        title="Pagamento com Cartão"
        open={open}
        onCancel={() => {
          // Cancelar - não precisa rollback pois shipments não foram criados
          setShowCardForm(false);
          setCheckoutInProgress(false);
        }}
        footer={null}
        width={700}
      >
        {shouldShowSavedCardForm ? (
          <SavedCardPaymentForm
            amount={totalAmount}
            onSuccess={handleCardSuccess}
            onError={handleCardError}
            onUseNewCard={() => setUseSavedCard(false)}
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
              onSuccess={handleCardSuccess}
              onError={handleCardError}
            />

            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {hasSavedCards && (
                <Button type="link" onClick={() => setUseSavedCard(true)} block>
                  Voltar para cartões salvos
                </Button>
              )}
              <Button onClick={() => {
                // Não precisa rollback pois shipments não foram criados
                setShowCardForm(false);
                setCheckoutInProgress(false);
              }} block>
                Cancelar
              </Button>
            </Space>
          </Space>
        )}
      </Modal>
    );
  }

  // Renderizar QR Code PIX
  if (pixData && pixData.payment.pixQrCode && checkoutInProgress) {
    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Status: PAGO
    if (pixStatus === 'paid') {
      return (
        <Modal
          title="Pagamento Confirmado"
          open={open}
          footer={null}
          closable={false}
          width={500}
        >
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CheckCircleFilled style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              Pagamento PIX Confirmado!
            </Typography.Title>
            <Text type="secondary">
              Criando seus envios...
            </Text>
            <div style={{ marginTop: 24 }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
            </div>
          </div>
        </Modal>
      );
    }

    // Status: EXPIRADO
    if (pixStatus === 'expired') {
      return (
        <Modal
          title="PIX Expirado"
          open={open}
          closable={false}
          maskClosable={false}
          keyboard={false}
          footer={[
            <Button key="retry" type="primary" onClick={() => {
              // Gerar novo PIX
              setPixData(null);
              setPixStatus('pending');
              setPixExpireSeconds(30 * 60);
              handleConfirm();
            }}>
              Gerar Novo PIX
            </Button>,
            <Button
              key="cancel"
              danger
              onClick={() => {
                // Não precisa rollback - shipments não foram criados
                handleClose();
              }}
            >
              Cancelar
            </Button>,
          ]}
          width={500}
        >
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <CloseCircleFilled style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 24 }} />
            <Typography.Title level={3} style={{ marginBottom: 8 }}>
              PIX Expirado
            </Typography.Title>
            <Text type="secondary">
              O tempo para pagamento expirou. Você pode gerar um novo código ou cancelar.
            </Text>
          </div>
        </Modal>
      );
    }

    // Status: PENDENTE (aguardando pagamento)
    return (
      <Modal
        title="Pagamento PIX"
        open={open}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={[
          <Button
            key="cancel"
            danger
            onClick={() => {
              // Não precisa rollback - shipments não foram criados
              handleClose();
            }}
          >
            Cancelar Pagamento
          </Button>,
        ]}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Status de polling */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            background: '#fffbe6',
            borderRadius: 8,
            border: '1px solid #ffe58f',
          }}>
            {pixPolling && <LoadingOutlined spin style={{ color: '#faad14' }} />}
            <Text style={{ color: '#d48806' }}>
              Aguardando pagamento... {formatTime(pixExpireSeconds)}
            </Text>
          </div>

          <div style={{ textAlign: 'center' }}>
            <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
              Escaneie o QR Code abaixo com o app do seu banco:
            </Text>

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
                {formatCurrency(totalAmount)}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                ID: {pixData.transaction.referenceId}
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
                    message.success('Código PIX copiado!');
                  }}
                  style={{ paddingLeft: 0 }}
                >
                  Copiar código
                </Button>
              </div>
            }
            type="warning"
          />

        </Space>
      </Modal>
    );
  }

  // Renderizar seleção de método de pagamento (tela principal)
  return (
    <Modal
      title="Escolha o método de pagamento"
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

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin tip="Carregando métodos de pagamento...">
              <div style={{ minHeight: 100 }} />
            </Spin>
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
                {/* Carteira */}
                <Radio value="wallet" disabled={isWalletDisabled} style={{ width: '100%' }}>
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
                <Radio value="pix" style={{ width: '100%' }}>
                  <Space>
                    <QrcodeOutlined style={{ fontSize: 20 }} />
                    <div>PIX</div>
                  </Space>
                </Radio>

                {/* Cartão de crédito */}
                <Radio value="card" style={{ width: '100%' }}>
                  <Space>
                    <CreditCardOutlined style={{ fontSize: 20 }} />
                    <div>Cartão de crédito</div>
                  </Space>
                </Radio>
              </Space>
            </Radio.Group>
          </div>
        )}

        {/* Mensagem informativa */}
        {selectedMethod === 'pix' && (
          <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Você receberá um QR Code para realizar o pagamento.
              Após a confirmação, seus envios serão processados automaticamente.
            </Text>
          </div>
        )}

        {selectedMethod === 'wallet' && (
          <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              O valor será debitado imediatamente da sua carteira.
            </Text>
          </div>
        )}

        {selectedMethod === 'card' && (
          <div style={{ padding: '12px', background: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {savedCards && savedCards.length > 0
                ? `Você tem ${savedCards.length} cartão(ões) salvo(s). Poderá usar um deles ou cadastrar um novo.`
                : 'Você será direcionado para cadastrar os dados do cartão.'}
            </Text>
          </div>
        )}
      </Space>
    </Modal>
  );
}
