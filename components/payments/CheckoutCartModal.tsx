'use client';

import { useState, useCallback } from 'react';
import { Modal, Button, App, Spin } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCards } from '@/hooks/useAccount';
import { usePixPayment } from './usePixPayment';
import { PixPaymentView } from './PixPaymentView';
import { CardPaymentView } from './CardPaymentView';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import type { CheckoutCartModalProps, WalletData, PaymentMethod } from './checkoutTypes';

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

  const totalAmount = cart.total;
  const itemCount = cart.items.length;

  console.debug('[CHECKOUT_CART] cart items=', itemCount, 'total=', totalAmount);

  // Fetch wallet balance
  const { data: walletData, isLoading: isLoadingWallet } = useQuery<WalletData>({
    queryKey: ['wallet'],
    queryFn: async () => {
      const res = await fetch('/api/wallet');
      if (!res.ok) throw new Error('Erro ao buscar saldo');
      return res.json();
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
      return res.json();
    },
    enabled: open,
  });

  const balance = walletData?.balance?.availableReais ?? 0;
  const hasInsufficientBalance = balance < totalAmount;
  const isConfirmDisabled = !selectedMethod;
  const isLoading = isLoadingWallet || isLoadingCards;

  // Finalize checkout after payment confirmed
  const finalizeCheckout = useCallback(async (
    paymentMethod: 'pix' | 'card' | 'wallet',
    paymentMeta: Record<string, unknown>
  ) => {
    const checkoutRes = await fetch('/api/cart/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMethod,
        paymentConfirmed: true,
        paymentMeta,
      }),
    });

    if (!checkoutRes.ok) {
      const error = await checkoutRes.json();
      throw new Error(error.message || 'Erro ao criar envios');
    }

    // Clear cart
    await fetch('/api/carrinho', { method: 'DELETE' });

    // Invalidate cache
    queryClient.invalidateQueries({ queryKey: ['cart'] });
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
  }, [queryClient]);

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
        message.success('Pagamento PIX confirmado! Criando envios...');
        await finalizeCheckout('pix', {
          mercadoPagoPaymentId: pixData?.payment?.id,
          transactionId: pixData?.transaction?.id,
          amount: totalAmount,
        });
        handleClose();
        router.push('/shipments');
      } catch (error) {
        console.error('[CHECKOUT_CART] Erro ao finalizar checkout PIX:', error);
        message.error('Pagamento confirmado, mas houve erro ao processar. Entre em contato com o suporte.');
      }
    },
  });

  // Card payment handlers
  const handleCardSuccess = async (paymentId: number) => {
    console.log('[CHECKOUT_CART] Pagamento com cartão aprovado:', paymentId);
    try {
      message.success('Pagamento aprovado! Criando envios...');
      await finalizeCheckout('card', {
        mercadoPagoPaymentId: paymentId,
        amount: totalAmount,
      });
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

    setLoading(true);

    try {
      if (selectedMethod === 'wallet') {
        console.log('[CHECKOUT_CART] Processando pagamento com carteira...');

        const cartItemIds = cart.items.map(item => item.id).join(',');
        const debitReferenceId = `cart:${Date.now()}:${cartItemIds.slice(0, 50)}`;

        // Debit from wallet
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

        await finalizeCheckout('wallet', {
          walletDebitReference: debitReferenceId,
          amount: totalAmount,
        });

        message.success('Pagamento aprovado! Envios criados.');
        handleClose();
        router.push('/shipments');

      } else if (selectedMethod === 'pix') {
        await generatePix(totalAmount, itemCount, user?.email || '');
        setCheckoutInProgress(true);
        setLoading(false);
        return;

      } else if (selectedMethod === 'card') {
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
    <Modal
      title="Escolha o método de pagamento"
      open={open}
      onCancel={handleClose}
      closable={!loading}
      maskClosable={!loading}
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
    </Modal>
  );
}
