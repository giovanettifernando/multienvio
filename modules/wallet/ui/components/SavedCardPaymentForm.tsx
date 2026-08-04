"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ELCard, ELRadio, ELSpace, ELTypography, ELAlert, ELForm, useELApp } from '@/shared/ui';
const Card = ELCard;
const Radio = ELRadio;
const Space = ELSpace;
const Typography = ELTypography;
const Alert = ELAlert;
const Form = ELForm;
const App = { useApp: useELApp };
import { ELButton, ELModal } from '@/shared/ui';
import { CreditCardOutlined, LoadingOutlined } from "@ant-design/icons";
import { formatBRL } from "@/shared/utils/format";

// Timeout para aguardar confirmação da operadora (15 segundos)
const CARD_PROCESSING_TIMEOUT_MS = 15000;
import { useCards } from "@/modules/account/ui/hooks";

const { Text } = Typography;

interface SavedCardPaymentFormProps {
  amount: number;
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  onUseNewCard: () => void; // Callback para usar novo cartão
  paymentType?: 'wallet_topup' | 'checkout_payment'; // Tipo de pagamento (default: wallet_topup)
  paymentDescription?: string; // Descrição customizada
}

/**
 * Formulário para pagamento com cartão salvo
 * Asaas: paga diretamente com o creditCardToken salvo no vault (vaultToken) — sem CVV necessário
 */
export function SavedCardPaymentForm({
  amount,
  onSuccess,
  onError,
  onUseNewCard,
  paymentType = 'wallet_topup',
  paymentDescription,
}: SavedCardPaymentFormProps) {
  App.useApp(); // required for Ant Design context
  const { data: cards, isLoading } = useCards();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filtrar cartões válidos (com brand e last4)
  const availableCards = useMemo(
    () => cards?.filter((card) => card.brand && card.last4) || [],
    [cards]
  );

  // Auto-selecionar o primeiro cartão quando carregar
  useEffect(() => {
    if (availableCards.length > 0 && !selectedCardId) {
      setSelectedCardId(availableCards[0].id);
    }
  }, [availableCards, selectedCardId]);

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const getBrandName = (brand: string): string => {
    const brandMap: Record<string, string> = {
      VISA: "Visa",
      MASTERCARD: "Mastercard",
      ELO: "Elo",
      AMEX: "American Express",
      HIPERCARD: "Hipercard",
      OTHER: "Outro",
    };
    return brandMap[brand] || brand;
  };

  const handleSubmit = async () => {
    if (!selectedCardId) { onError(new Error("Selecione um cartão")); return; }

    const selectedCard = availableCards.find(c => c.id === selectedCardId);
    if (!selectedCard) { onError(new Error("Cartão não encontrado")); return; }

    setProcessing(true);

    // Criar AbortController para cancelar requisição no timeout
    abortControllerRef.current = new AbortController();

    // Configurar timeout de 15 segundos
    timeoutRef.current = setTimeout(() => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setProcessing(false);
      onError(new Error("Erro ao processar pagamento, tente novamente mais tarde"));
    }, CARD_PROCESSING_TIMEOUT_MS);

    try {
      // Asaas: paga direto com o creditCardToken salvo no vault (vaultToken), sem CVV
      const res = await fetch('/api/payments/asaas/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          amountCents: amount,
          description: paymentDescription || (paymentType === 'wallet_topup' ? 'Recarga de carteira' : 'Pagamento de envio'),
          paymentMethod: 'credit_card',
          cardToken: selectedCard.vaultToken,
          metadata: { type: paymentType },
        }),
      });

      // Limpar timeout se a requisição completou
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Pagamento recusado');

      setProcessing(false);
      onSuccess((json.data ?? json).transactionId);
    } catch (err) {
      // Limpar timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if ((err as Error).name !== 'AbortError') {
        setProcessing(false);
        onError(err instanceof Error ? err : new Error('Erro no pagamento'));
      }
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <Typography.Text type="secondary">Carregando cartões...</Typography.Text>
        </div>
      </Card>
    );
  }

  if (availableCards.length === 0) {
    return (
      <Card>
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            message="Nenhum cartão cadastrado"
            description="Você ainda não possui cartões cadastrados. Adicione um novo cartão para continuar."
            type="info"
            showIcon
          />
          <ELButton variant="primary" onClick={onUseNewCard} block>
            Adicionar Novo Cartão
          </ELButton>
        </Space>
      </Card>
    );
  }

  return (
    <>
      {/* Modal bloqueante durante processamento */}
      <ELModal
        open={processing}
        closable={false}
        maskClosable={false}
        keyboard={false}
        footer={null}
        centered
        size="sm"
      >
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <LoadingOutlined style={{ fontSize: 48, color: "#1890ff", marginBottom: 24 }} spin />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            Aguardando confirmação da operadora de cartão de crédito
          </div>
          <div style={{ fontSize: 14, color: "#666" }}>
            Por favor, aguarde...
          </div>
        </div>
      </ELModal>

      <Card>
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Text strong style={{ marginBottom: 8, display: "block" }}>
              Valor a pagar:
            </Text>
            <Text style={{ fontSize: 24, color: "#52c41a" }}>
              {formatBRL(amount)}
            </Text>
          </div>

        <Form.Item
          label="Selecione um cartão"
          required
        >
          <Radio.Group
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            style={{ width: "100%" }}
          >
            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              {availableCards.map((card) => (
                <Radio
                  key={card.id}
                  value={card.id}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #d9d9d9",
                    borderRadius: 8,
                    background: selectedCardId === card.id ? "#f0f5ff" : "#fafafa",
                  }}
                >
                  <Space>
                    <CreditCardOutlined style={{ fontSize: 20 }} />
                    <div>
                      <div>
                        <Text strong>{getBrandName(card.brand)}</Text>
                        <Text type="secondary"> •••• {card.last4}</Text>
                      </div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {card.holderName} • Validade: {String(card.expMonth).padStart(2, "0")}/
                        {String(card.expYear).slice(-2)}
                      </Text>
                    </div>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Form.Item>

          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <ELButton
              variant="primary"
              size="large"
              block
              onClick={handleSubmit}
              loading={processing}
              disabled={!selectedCardId}
            >
              Pagar {formatBRL(amount)}
            </ELButton>

            <ELButton variant="link" onClick={onUseNewCard} block>
              Usar outro cartão
            </ELButton>
          </Space>
        </Space>
      </Card>
    </>
  );
}

export default SavedCardPaymentForm;
