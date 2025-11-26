'use client';

import { useState } from 'react';
import { Modal, Radio, Button, Typography, Space, App, Spin, Alert } from 'antd';
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

// Contexto de checkout pendente (para continuar após pagamento)
interface PendingCheckout {
  cartId: string;
  shipmentIds: string[];
}

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
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);

  // Estados para PIX via Mercado Pago
  const [pixData, setPixData] = useState<MercadoPagoPaymentResult | null>(null);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função auxiliar para rollback de shipments
  const rollbackShipments = async (cartId: string, shipmentIds: string[]) => {
    console.error('[CHECKOUT_CART] Iniciando rollback...');

    try {
      await Promise.all(
        shipmentIds.map(async (id: string) => {
          const cancelRes = await fetch(`/api/shipments/${id}/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'payment_failed' }),
          });

          if (!cancelRes.ok) {
            console.error(`[CHECKOUT_CART] Falha ao cancelar shipment ${id}`);
          }
        })
      );

      console.log('[CHECKOUT_CART] Rollback concluído - shipments cancelados');

      // Destravar carrinho
      const unlockRes = await fetch(`/api/cart/${cartId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (unlockRes.ok) {
        console.log('[CHECKOUT_CART] Carrinho destravado com sucesso');
      }
    } catch (rollbackError) {
      console.error('[CHECKOUT_CART] Erro durante rollback:', rollbackError);
    }
  };

  // Função para finalizar checkout após pagamento aprovado
  const finalizeCheckout = async (cartId: string, shipmentIds: string[], paymentId: number) => {
    try {
      // Confirmar pagamento dos shipments
      await fetch('/api/shipments/payment-batch', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shipmentIds,
          method: 'card',
          status: 'approved',
          meta: {
            mercadoPagoPaymentId: paymentId,
            amount: totalAmount,
          },
        }),
      });

      // Limpar carrinho
      await fetch('/api/carrinho', { method: 'DELETE' });

      // Invalidar cache e redirecionar
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });

      message.success('Pagamento aprovado! Etiquetas sendo emitidas...');
      handleClose();
      router.push('/shipments');
    } catch (error) {
      console.error('[CHECKOUT_CART] Erro ao finalizar checkout:', error);
      message.error('Pagamento aprovado, mas houve erro ao processar. Entre em contato com o suporte.');
    }
  };

  // Handler para sucesso do pagamento com cartão
  const handleCardSuccess = async (paymentId: number) => {
    if (!pendingCheckout) {
      message.error('Erro: checkout pendente não encontrado');
      return;
    }

    console.log('[CHECKOUT_CART] Pagamento com cartão aprovado:', paymentId);
    await finalizeCheckout(pendingCheckout.cartId, pendingCheckout.shipmentIds, paymentId);
  };

  // Handler para erro do pagamento com cartão
  const handleCardError = async (error: Error) => {
    message.error(error.message || 'Erro ao processar pagamento com cartão');

    if (pendingCheckout) {
      await rollbackShipments(pendingCheckout.cartId, pendingCheckout.shipmentIds);
    }

    setShowCardForm(false);
    setPendingCheckout(null);
    setLoading(false);
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
        body: JSON.stringify({ paymentMethod: selectedMethod }),
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
        try {
          // Debitar da carteira (atômico)
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
            if (error.message?.includes('P2002') || error.message?.includes('já foi debitado')) {
              console.log('[CHECKOUT_CART] Pagamento já processado (idempotente)');
            } else {
              throw new Error(error.message || 'Erro ao debitar da carteira');
            }
          }

          queryClient.invalidateQueries({ queryKey: ['wallet'] });
          message.success('Pagamento com carteira aprovado!');

          // Limpar carrinho e redirecionar
          await fetch('/api/carrinho', { method: 'DELETE' });
          queryClient.invalidateQueries({ queryKey: ['cart'] });
          queryClient.invalidateQueries({ queryKey: ['shipments'] });
          handleClose();
          router.push('/shipments');

        } catch (paymentError) {
          await rollbackShipments(cartId, shipmentIds);
          throw paymentError;
        }

      } else if (selectedMethod === 'pix') {
        // Criar pagamento PIX via Mercado Pago
        try {
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
                cartId,
                shipmentIds,
              },
            }),
          });

          if (!pixRes.ok) {
            const error = await pixRes.json();
            throw new Error(error.message || 'Erro ao gerar PIX');
          }

          const pixResult: MercadoPagoPaymentResult = await pixRes.json();
          setPixData(pixResult);
          setPendingCheckout({ cartId, shipmentIds });
          message.success('QR Code PIX gerado com sucesso!');
          setLoading(false);
          return; // Não fechar modal, aguardar pagamento

        } catch (pixError) {
          await rollbackShipments(cartId, shipmentIds);
          throw pixError;
        }

      } else if (selectedMethod === 'card') {
        // Mostrar formulário de cartão do Mercado Pago
        setPendingCheckout({ cartId, shipmentIds });
        setShowCardForm(true);
        setLoading(false);
        return; // Não fechar modal, aguardar input do usuário
      }

    } catch (error) {
      console.error('[CHECKOUT_CART_ERROR]', error);
      showErrorMessage(error);
    } finally {
      if (selectedMethod === 'wallet') {
        setLoading(false);
      }
    }
  };

  const showErrorMessage = (error: unknown) => {
    let errorMessage = 'Erro ao processar pagamento';
    let errorDescription: string | undefined;

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      if (msg.includes('saldo insuficiente') || msg.includes('insufficient')) {
        errorMessage = 'Saldo insuficiente na carteira';
        errorDescription = `Você precisa de ${formatCurrency(totalAmount)} mas tem apenas ${formatCurrency(balance)} disponível.`;
      } else if (msg.includes('carrinho não encontrado') || msg.includes('cart not found')) {
        errorMessage = 'Carrinho não encontrado';
        errorDescription = 'Seu carrinho expirou ou já foi processado.';
      } else if (msg.includes('carrinho vazio') || msg.includes('cart empty')) {
        errorMessage = 'Carrinho vazio';
        errorDescription = 'Não há itens no carrinho para processar.';
      } else if (msg.includes('carteira não encontrada') || msg.includes('wallet not found')) {
        errorMessage = 'Carteira não disponível';
        errorDescription = 'Sua carteira ainda não foi criada.';
      } else {
        errorMessage = error.message || 'Erro ao processar pagamento';
      }
    }

    if (errorDescription) {
      message.error({
        content: (
          <div>
            <strong>{errorMessage}</strong>
            <div style={{ marginTop: 8, fontSize: 13 }}>{errorDescription}</div>
          </div>
        ),
        duration: 8,
      });
    } else {
      message.error(errorMessage);
    }
  };

  const handleClose = () => {
    setSelectedMethod(null);
    setShowCardForm(false);
    setUseSavedCard(true);
    setPendingCheckout(null);
    setPixData(null);
    setLoading(false);
    onClose();
  };

  // Renderizar formulário de cartão do Mercado Pago
  if (showCardForm && pendingCheckout) {
    const hasSavedCards = savedCards && savedCards.length > 0;
    const shouldShowSavedCardForm = useSavedCard && hasSavedCards;

    return (
      <Modal
        title={shouldShowSavedCardForm ? "Pagar com Cartão Salvo" : "Pagamento com Cartão - Mercado Pago"}
        open={open}
        onCancel={() => {
          // Cancelar checkout pendente
          rollbackShipments(pendingCheckout.cartId, pendingCheckout.shipmentIds);
          setShowCardForm(false);
          setPendingCheckout(null);
        }}
        footer={null}
        width={700}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Total a pagar: </Text>
          <Text style={{ fontSize: 20, color: '#52c41a' }}>
            {formatCurrency(totalAmount)}
          </Text>
          <br />
          <Text type="secondary">
            {itemCount} {itemCount === 1 ? 'envio' : 'envios'}
          </Text>
        </div>

        {shouldShowSavedCardForm ? (
          <SavedCardPaymentForm
            amount={totalAmount}
            onSuccess={handleCardSuccess}
            onError={handleCardError}
            onUseNewCard={() => setUseSavedCard(false)}
          />
        ) : (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
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
                rollbackShipments(pendingCheckout.cartId, pendingCheckout.shipmentIds);
                setShowCardForm(false);
                setPendingCheckout(null);
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
  if (pixData && pixData.payment.pixQrCode && pendingCheckout) {
    return (
      <Modal
        title="QR Code PIX - Mercado Pago"
        open={open}
        onCancel={() => {
          // Não fazer rollback aqui - usuário pode ter pago
          handleClose();
        }}
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
            description="Após escanear o QR Code e realizar o pagamento, o status será atualizado automaticamente via webhook do Mercado Pago."
            type="info"
            showIcon
          />

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

          <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
            Após a confirmação do pagamento, os envios serão processados automaticamente.
          </Text>
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

        {(isLoadingWallet || isLoadingCards) ? (
          <Spin />
        ) : (
          <Radio.Group
            value={selectedMethod}
            onChange={(e) => setSelectedMethod(e.target.value)}
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

              {/* PIX via Mercado Pago */}
              <Radio value="pix">
                <Space>
                  <QrcodeOutlined style={{ fontSize: 20 }} />
                  <div>
                    <div>PIX via Mercado Pago</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Aprovação instantânea
                    </Text>
                  </div>
                </Space>
              </Radio>

              {/* Cartão de crédito via Mercado Pago */}
              <Radio value="card">
                <Space>
                  <CreditCardOutlined style={{ fontSize: 20 }} />
                  <div>
                    <div>Cartão de crédito via Mercado Pago</div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {savedCards && savedCards.length > 0
                        ? `${savedCards.length} cartão(ões) salvo(s)`
                        : 'Cadastre um novo cartão'}
                    </Text>
                  </div>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        )}
      </Space>
    </Modal>
  );
}
