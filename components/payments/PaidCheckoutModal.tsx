'use client';

/**
 * PaidCheckoutModal - Modal de Checkout com Pagamento Integrado
 *
 * NOVO FLUXO (shipment criado APÓS pagamento):
 * 1. Usuário entra em /cotacoes/finalizar
 * 2. Código de rastreamento é reservado automaticamente
 * 3. Usuário preenche dados e clica "Pagar agora"
 * 4. Este modal abre com os DADOS do envio (não o shipmentId)
 * 5. Usuário confirma pagamento
 * 6. Modal chama /api/shipments/create-paid que:
 *    - Debita carteira (se wallet)
 *    - Cria shipment com código reservado
 *    - Envia email ao destinatário
 * 7. Redireciona para /shipments/{id}
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { App, Space, Typography, Radio, Spin } from 'antd';
import {
  WalletOutlined,
  QrcodeOutlined,
  CreditCardOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { ELModal } from '@/components/ui/ELModal';
import { ELButton } from '@/components/ui/ELButton';
import { useCards } from '@/hooks/useAccount';
import { usePixPayment } from './usePixPayment';
import { PixPaymentView } from './PixPaymentView';
import { CardPaymentView } from './CardPaymentView';

const { Text } = Typography;

type PaymentMethod = 'wallet' | 'pix' | 'card';

interface WalletData {
  balance: {
    availableReais: number;
    availableCents: number;
  };
}

/**
 * Dados necessários para criar o shipment após confirmação de pagamento
 */
export interface CheckoutData {
  recipient: {
    nome: string;
    telefone?: string | null;
    email?: string | null;
    documento?: string | null;
    cep: string;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade: string;
    uf: string;
    observacoes?: string | null;
    salvarRecorrente?: boolean;
  };
  document: {
    type: 'NFE' | 'DECLARACAO';
    packages?: Array<{
      chave: string;
      xmlId?: string | null;
      items: Array<{
        id: string;
        sku?: string | null;
        descricao: string;
        ncm?: string | null;
        cfop?: string | null;
        quantidade: number;
        pesoLiquido?: number | null;
        valorUnitario: number;
        valorTotal: number;
      }>;
      nfeData?: unknown;
    }>;
    nfeKeys?: Array<{ chave: string }>;
    nfeItems?: Array<{
      descricao: string;
      valorUnitario: number;
      valorTotal?: number;
      quantidade: number;
    }>;
    declarationItems?: Array<{
      id?: string;
      descricao?: string;
      valorUnitario?: number;
      quantidade?: number;
    }>;
    volumeDeclarations?: Array<{
      volumeIndex: number;
      items?: Array<{
        id: string;
        descricao?: string;
        valorUnitario?: number;
        quantidade?: number;
      }>;
    }>;
  };
  volumes: Array<{
    peso: number;
    altura: number;
    largura: number;
    comprimento: number;
  }>;
  insuranceValue?: number;
  freightCost: number;
  totalCost: number;
  pickupPointId?: string | null;
  solicitarColeta?: boolean;
  pickupFee?: {
    collectorId: string;
    feeAmount: number;
    distanceKm: number;
  };
  carrier: string;
  service: string;
  originCep: string;
  originCidade?: string;
  originUf?: string;
  originAddress?: {
    cep: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    nome?: string;
  };
  destinationCep: string;
  estimatedDays: number;
}

export interface PaidCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  checkoutData: CheckoutData;
  trackingCode: string;
  totalAmount: number;
}

/**
 * Modal de checkout que cria o shipment APÓS confirmação do pagamento
 */
export function PaidCheckoutModal({
  open,
  onClose,
  checkoutData,
  trackingCode,
  totalAmount,
}: PaidCheckoutModalProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { message } = App.useApp();

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [checkoutInProgress, setCheckoutInProgress] = useState(false);

  // Buscar saldo da carteira
  const { data: walletData, isLoading: isLoadingWallet } = useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch('/api/wallet');
      if (!res.ok) throw new Error('Erro ao buscar saldo');
      const json = await res.json();
      return (json.data ?? json) as WalletData;
    },
    enabled: open,
  });

  // Buscar cartões salvos
  const { data: savedCards, isLoading: isLoadingCards } = useCards();

  // Buscar dados do usuário para PIX
  const { data: user } = useQuery<{ email: string }>({
    queryKey: ['user-session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Erro ao buscar dados do usuário');
      const json = await res.json();
      const data = json.data ?? json;
      return (data.user ?? data) as { email: string };
    },
    enabled: open,
  });

  const balance = walletData?.balance?.availableReais ?? 0;
  const hasInsufficientBalance = balance < totalAmount;
  const isLoading = isLoadingWallet || isLoadingCards;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Função para criar shipment com pagamento confirmado
  const createShipmentWithPayment = async (paymentMethod: 'WALLET' | 'MERCADO_PAGO', mercadoPagoPaymentId?: string) => {
    const response = await fetch('/api/shipments/create-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trackingCode,
        paymentMethod,
        mercadoPagoPaymentId,
        recipient: checkoutData.recipient,
        document: checkoutData.document,
        volumes: checkoutData.volumes,
        insuranceValue: checkoutData.insuranceValue,
        freightCost: checkoutData.freightCost,
        totalCost: totalAmount,
        pickupPointId: checkoutData.pickupPointId,
        solicitarColeta: checkoutData.solicitarColeta,
        pickupFee: checkoutData.pickupFee,
        carrier: checkoutData.carrier,
        service: checkoutData.service,
        originCep: checkoutData.originCep,
        originCidade: checkoutData.originCidade,
        originUf: checkoutData.originUf,
        originAddress: checkoutData.originAddress,
        destinationCep: checkoutData.destinationCep,
        estimatedDays: checkoutData.estimatedDays,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error?.message || errorData.message || 'Erro ao processar pagamento';

      if (errorData.error?.code === 'insufficient_funds') {
        throw new Error('Saldo insuficiente na carteira');
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.data || result;
  };

  // PIX payment hook
  const {
    pixData,
    pixPolling,
    pixStatus,
    pixExpireSeconds,
    generatePix,
    resetPix,
    retryPix,
    copyPixCode,
  } = usePixPayment({
    onPaymentConfirmed: async () => {
      try {
        message.success('Pagamento PIX confirmado! Criando envio...');

        const data = await createShipmentWithPayment('MERCADO_PAGO', pixData?.payment?.id?.toString());

        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['shipments'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });

        handleClose();
        router.push(`/shipments/${data.shipmentId}`);
      } catch (error) {
        console.error('[PAID_CHECKOUT] Erro ao finalizar checkout PIX:', error);
        message.error('Pagamento confirmado, mas houve erro ao processar. Entre em contato com o suporte.');
      }
    },
  });

  // Card payment handlers
  const handleCardSuccess = async (paymentId: number) => {
    console.log('[PAID_CHECKOUT] Pagamento com cartão aprovado:', paymentId);
    try {
      message.success('Pagamento aprovado! Criando envio...');

      const data = await createShipmentWithPayment('MERCADO_PAGO', paymentId.toString());

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      handleClose();
      router.push(`/shipments/${data.shipmentId}`);
    } catch (error) {
      console.error('[PAID_CHECKOUT] Erro ao finalizar checkout:', error);
      message.error('Pagamento aprovado, mas houve erro ao processar. Entre em contato com o suporte.');
    }
  };

  const handleCardError = (error: Error) => {
    message.error(error.message || 'Erro ao processar pagamento com cartão');
    setShowCardForm(false);
    setCheckoutInProgress(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetPix();
    setSelectedMethod(null);
    setShowCardForm(false);
    setUseSavedCard(true);
    setCheckoutInProgress(false);
    setLoading(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedMethod) return;

    setLoading(true);

    try {
      if (selectedMethod === 'wallet') {
        console.log('[PAID_CHECKOUT] Processando pagamento com carteira...', {
          trackingCode,
          totalAmount,
        });

        const data = await createShipmentWithPayment('WALLET');

        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['shipments'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });

        message.success('Pagamento aprovado! Etiqueta sendo emitida...');
        router.push(`/shipments/${data.shipmentId}`);

      } else if (selectedMethod === 'pix') {
        console.log('[PAID_CHECKOUT] Gerando PIX...');
        await generatePix(totalAmount, 1, user?.email || '');
        setCheckoutInProgress(true);
        setLoading(false);
        return;

      } else if (selectedMethod === 'card') {
        console.log('[PAID_CHECKOUT] Abrindo formulário de cartão...');
        setCheckoutInProgress(true);
        setShowCardForm(true);
        setLoading(false);
        return;
      }

    } catch (error) {
      console.error('[PAID_CHECKOUT] Erro:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      message.error(errorMessage);
      setLoading(false);
    }
  };

  const isConfirmDisabled =
    !selectedMethod ||
    loading ||
    (selectedMethod === 'wallet' && hasInsufficientBalance);

  // Render Card Payment Form
  if (showCardForm && checkoutInProgress) {
    return (
      <CardPaymentView
        open={open}
        totalAmount={totalAmount}
        itemCount={1}
        savedCards={savedCards}
        useSavedCard={useSavedCard}
        onUseSavedCard={setUseSavedCard}
        onSuccess={handleCardSuccess}
        onError={handleCardError}
        onCancel={() => {
          setShowCardForm(false);
          setCheckoutInProgress(false);
        }}
      />
    );
  }

  // Render PIX QR Code
  if (pixData && pixData.payment.pixQrCode && checkoutInProgress) {
    return (
      <PixPaymentView
        open={open}
        pixData={pixData}
        pixStatus={pixStatus}
        pixPolling={pixPolling}
        pixExpireSeconds={pixExpireSeconds}
        totalAmount={totalAmount}
        itemCount={1}
        onRetry={() => {
          retryPix();
          handleConfirm();
        }}
        onCancel={handleClose}
        onCopyCode={copyPixCode}
      />
    );
  }

  // Render payment method selection (main screen)
  return (
    <ELModal
      title="Escolha o método de pagamento"
      open={open}
      onCancel={handleClose}
      closable={!loading}
      maskClosable={!loading}
      footer={
        <Space>
          <ELButton onClick={handleClose} disabled={loading}>
            Cancelar
          </ELButton>
          <ELButton
            variant="primary"
            onClick={handleConfirm}
            loading={loading}
            disabled={isConfirmDisabled}
            icon={<CheckCircleOutlined />}
          >
            Confirmar pagamento
          </ELButton>
        </Space>
      }
      width={600}
    >
      <Spin
        spinning={loading}
        indicator={<LoadingOutlined style={{ fontSize: 32 }} spin />}
        tip="Processando pagamento..."
        size="large"
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Exibir valor total */}
          <div>
            <Text strong>Total a pagar: </Text>
            <Text style={{ fontSize: 20, color: '#1890ff' }}>{formatCurrency(totalAmount)}</Text>
          </div>

          {/* Lista de métodos de pagamento */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">Carregando métodos de pagamento...</Text>
              </div>
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
                  <Radio
                    value="wallet"
                    disabled={hasInsufficientBalance}
                    style={{ width: '100%' }}
                  >
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
                      <div>
                        <div>PIX</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Pagamento instantâneo
                        </Text>
                      </div>
                    </Space>
                  </Radio>

                  {/* Cartão */}
                  <Radio value="card" style={{ width: '100%' }}>
                    <Space>
                      <CreditCardOutlined style={{ fontSize: 20 }} />
                      <div>
                        <div>Cartão de crédito</div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {savedCards && savedCards.length > 0
                            ? `${savedCards.length} cartão(ões) salvo(s)`
                            : 'Débito ou crédito'}
                        </Text>
                      </div>
                    </Space>
                  </Radio>
                </Space>
              </Radio.Group>
            </div>
          )}

          {/* Mensagem informativa */}
          {selectedMethod === 'wallet' && !hasInsufficientBalance && (
            <div style={{ padding: '12px', background: '#f6ffed', borderRadius: 4, border: '1px solid #b7eb8f' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                O valor será debitado imediatamente da sua carteira e o envio será criado.
              </Text>
            </div>
          )}
          {selectedMethod === 'pix' && (
            <div style={{ padding: '12px', background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Será gerado um QR Code PIX. O envio será criado assim que o pagamento for confirmado.
              </Text>
            </div>
          )}
        </Space>
      </Spin>
    </ELModal>
  );
}
