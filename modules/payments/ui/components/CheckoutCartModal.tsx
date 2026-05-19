'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useELApp, ELSpin, ELSpace } from '@/shared/ui';
const App = { useApp: useELApp };
const Spin = ELSpin;
const Space = ELSpace;
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCards } from '@/modules/account/ui/hooks';
import { usePixPayment } from './usePixPayment';
import { PixPaymentView } from './PixPaymentView';
import { CardPaymentView } from './CardPaymentView';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import type { CheckoutCartModalProps, WalletData, PaymentMethod } from './checkoutTypes';
import { ELModal } from '@/shared/ui/ELModal';
import { ELButton } from '@/shared/ui/ELButton';

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
  const [showCardForm, setShowCardForm] = useState(false);
  const [useSavedCard, setUseSavedCard] = useState(true);
  const [checkoutInProgress, setCheckoutInProgress] = useState(false);

  // Estado para códigos de rastreamento reservados (NOVO FLUXO)
  const [reservedTrackingCodes, setReservedTrackingCodes] = useState<string[]>([]);
  const [isReservingCodes, setIsReservingCodes] = useState(false);
  const [reservationError, setReservationError] = useState<string | null>(null);
  const reservationAttemptedRef = useRef(false);

  const totalAmount = cart.total;
  const itemCount = cart.items.length;
  const itemIds = cart.items.map(item => item.id);

  console.debug('[CHECKOUT_CART] cart items=', itemCount, 'total=', totalAmount);

  // Função para reservar códigos com retry automático
  const reserveTrackingCodes = async (retryCount = 0) => {
    const MAX_RETRIES = 3;
    reservationAttemptedRef.current = true;
    setIsReservingCodes(true);
    setReservationError(null);

    try {
      console.log('[CHECKOUT_CART] Reservando', itemCount, 'códigos de rastreamento...');
      const res = await fetch('/api/tracking-codes/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: itemCount }),
      });

      if (!res.ok) {
        throw new Error('Erro ao reservar códigos de rastreamento');
      }

      const json = await res.json();
      const data = json.data ?? json;

      // Se count > 1, retorna { codes: string[] }, senão { code: string }
      const codes = data.codes ?? [data.code];
      setReservedTrackingCodes(codes);
      setReservationError(null);
      console.log('[CHECKOUT_CART] Códigos reservados:', codes);
    } catch (error) {
      console.error('[CHECKOUT_CART] Erro ao reservar códigos (tentativa', retryCount + 1, '):', error);

      // Retry automático
      if (retryCount < MAX_RETRIES) {
        console.log('[CHECKOUT_CART] Tentando novamente em 1s...');
        setTimeout(() => reserveTrackingCodes(retryCount + 1), 1000);
        return;
      }

      // Após todas as tentativas, marcar erro (botão fica desabilitado)
      setReservationError('Erro ao preparar checkout');
      setIsReservingCodes(false);
      return;
    }

    setIsReservingCodes(false);
  };

  // NOVO FLUXO: Reservar códigos de rastreamento ao abrir o modal
  useEffect(() => {
    if (!open || reservationAttemptedRef.current || itemCount === 0) {
      return;
    }

    reserveTrackingCodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reserveTrackingCodes é estável (só usa setState)
  }, [open, itemCount]);

  // Limpar estado ao fechar modal
  useEffect(() => {
    if (!open) {
      reservationAttemptedRef.current = false;
      setReservedTrackingCodes([]);
    }
  }, [open]);

  // Fetch wallet balance
  const { data: walletData, isLoading: isLoadingWallet } = useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch('/api/wallet');
      if (!res.ok) throw new Error('Erro ao buscar saldo');
      const json = await res.json();
      // Handle standardized API response format { data: T, error, meta }
      return (json.data ?? json) as WalletData;
    },
    enabled: open,
  });

  // Fetch saved cards via hook
  const { data: savedCards, isLoading: isLoadingCards } = useCards();

  // Fetch user data for email
  const { data: user } = useQuery<{ email: string }>({
    queryKey: ['user-session'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me');
      if (!res.ok) throw new Error('Erro ao buscar dados do usuário');
      const json = await res.json();
      // Handle standardized API response format { data: T, error, meta }
      // API returns { data: { user: {...} } } so we need to extract user
      const data = json.data ?? json;
      return (data.user ?? data) as { email: string };
    },
    enabled: open,
  });

  const balance = walletData?.balance?.availableReais ?? 0;
  const hasInsufficientBalance = balance < totalAmount;
  // Desabilitar se: não selecionou método, está reservando códigos, ou códigos não foram reservados
  const isConfirmDisabled = !selectedMethod || isReservingCodes || reservedTrackingCodes.length !== itemCount || !!reservationError;
  const isLoading = isLoadingWallet || isLoadingCards || isReservingCodes;

  // PIX payment hook - NOVO FLUXO com códigos reservados
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
        message.success('Pagamento PIX confirmado! Criando envios...');

        // NOVO FLUXO: Usar /api/cart/checkout-paid com códigos reservados
        console.log('[CHECKOUT_CART] PIX confirmado. Criando shipments com códigos:', reservedTrackingCodes);

        const response = await fetch('/api/cart/checkout-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservedTrackingCodes,
            itemIds,
            paymentMethod: 'MERCADO_PAGO',
            mercadoPagoPaymentId: pixData?.payment?.id?.toString(),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || errorData.message || 'Erro ao criar envios');
        }

        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['cart'] });
        queryClient.invalidateQueries({ queryKey: ['shipments'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });

        handleClose();
        router.push('/shipments');
      } catch (error) {
        console.error('[CHECKOUT_CART] Erro ao finalizar checkout PIX:', error);
        message.error('Pagamento confirmado, mas houve erro ao processar. Entre em contato com o suporte.');
      }
    },
  });

  // Card payment handlers - NOVO FLUXO com códigos reservados
  const handleCardSuccess = async (transactionId: string) => {
    console.log('[CHECKOUT_CART] Pagamento com cartão aprovado:', transactionId);
    try {
      message.success('Pagamento aprovado! Criando envios...');

      // NOVO FLUXO: Usar /api/cart/checkout-paid com códigos reservados
      console.log('[CHECKOUT_CART] Cartão aprovado. Criando shipments com códigos:', reservedTrackingCodes);

      const response = await fetch('/api/cart/checkout-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservedTrackingCodes,
          itemIds,
          paymentMethod: 'MERCADO_PAGO',
          mercadoPagoPaymentId: transactionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.message || 'Erro ao criar envios');
      }

      // Invalidar cache
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });

      handleClose();
      router.push('/shipments');
    } catch (error) {
      console.error('[CHECKOUT_CART] Erro ao finalizar checkout:', error);
      message.error('Pagamento aprovado, mas houve erro ao processar. Entre em contato com o suporte.');
    }
  };

  const handleCardError = (error: Error) => {
    message.error(error.message || 'Erro ao processar pagamento com cartão');
    setShowCardForm(false);
    setCheckoutInProgress(false);
    setLoading(false);
  };

  const handleConfirm = async () => {
    if (!selectedMethod) return;

    // Verificar se códigos foram reservados
    if (reservedTrackingCodes.length !== itemCount) {
      message.error('Erro: códigos de rastreamento não foram reservados. Reabra o modal.');
      return;
    }

    setLoading(true);

    try {
      if (selectedMethod === 'wallet') {
        console.log('[CHECKOUT_CART] Processando pagamento com carteira (NOVO FLUXO)...');
        console.log('[CHECKOUT_CART] Códigos reservados:', reservedTrackingCodes);
        console.log('[CHECKOUT_CART] Item IDs:', itemIds);

        // NOVO FLUXO: Usar /api/cart/checkout-paid que cria shipments + debita carteira atomicamente
        const response = await fetch('/api/cart/checkout-paid', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservedTrackingCodes,
            itemIds,
            paymentMethod: 'WALLET',
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
        console.log('[CHECKOUT_CART] Shipments criados com sucesso:', result);

        // Invalidar cache
        queryClient.invalidateQueries({ queryKey: ['cart'] });
        queryClient.invalidateQueries({ queryKey: ['shipments'] });
        queryClient.invalidateQueries({ queryKey: ['wallet'] });

        message.success('Pagamento aprovado! Envios criados.');
        handleClose();
        router.push('/shipments');

      } else if (selectedMethod === 'pix') {
        // PIX: códigos reservados serão usados no callback onPaymentConfirmed
        await generatePix(totalAmount, itemCount, user?.email || '');
        setCheckoutInProgress(true);
        setLoading(false);
        return;

      } else if (selectedMethod === 'card') {
        // Cartão: códigos reservados serão usados no handleCardSuccess
        console.log('[CHECKOUT_CART] Abrindo formulário de cartão...');
        setCheckoutInProgress(true);
        setShowCardForm(true);
        setLoading(false);
        return;
      }

    } catch (error) {
      console.error('[CHECKOUT_CART_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
      message.error(errorMessage);
      setLoading(false);
    }
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

  // Render Card Payment Form
  if (showCardForm && checkoutInProgress) {
    return (
      <CardPaymentView
        open={open}
        totalAmount={totalAmount}
        itemCount={itemCount}
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
        itemCount={itemCount}
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
        <PaymentMethodSelector
          selectedMethod={selectedMethod}
          onMethodChange={loading ? () => {} : setSelectedMethod}
          totalAmount={totalAmount}
          itemCount={itemCount}
          balance={balance}
          hasInsufficientBalance={hasInsufficientBalance}
          savedCardsCount={savedCards?.length || 0}
          isLoading={isLoading}
        />
      </Spin>
    </ELModal>
  );
}
