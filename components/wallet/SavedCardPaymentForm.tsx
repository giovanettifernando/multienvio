"use client";

import { useState, useEffect } from "react";
import { Card as AntCard, Input, Button, Radio, Space, Typography, Alert, Form, App } from "antd";
import { CreditCardOutlined, LockOutlined } from "@ant-design/icons";
import { useCards } from "@/hooks/useAccount";

const { Text } = Typography;

// Tipo global do SDK do Mercado Pago
interface MercadoPagoSDK {
  createCardToken: (cardData: {
    cardNumber: string;
    cardholderName: string;
    cardExpirationMonth: string;
    cardExpirationYear: string;
    securityCode: string;
    identificationType: string;
    identificationNumber: string;
  }) => Promise<{ id: string }>;
}

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, options?: { locale?: string }) => MercadoPagoSDK;
  }
}

interface SavedCardPaymentFormProps {
  amount: number;
  onSuccess: (paymentId: number) => void;
  onError: (error: Error) => void;
  onUseNewCard: () => void; // Callback para usar novo cartão
}

/**
 * Formulário para pagamento com cartão salvo
 * Mostra cartões do usuário e pede apenas CVV
 */
export function SavedCardPaymentForm({
  amount,
  onSuccess,
  onError,
  onUseNewCard,
}: SavedCardPaymentFormProps) {
  const { message: messageApi } = App.useApp();
  const { data: cards, isLoading } = useCards();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cvv, setCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);

  // Carregar MP SDK e public key
  useEffect(() => {
    async function fetchPublicKey() {
      try {
        const response = await fetch("/api/payments/mercadopago/public-key");
        if (!response.ok) {
          throw new Error("Falha ao carregar configuração do Mercado Pago");
        }
        const data = await response.json();
        setPublicKey(data.publicKey);

        // Carregar script do SDK do Mercado Pago
        if (!window.MercadoPago) {
          const script = document.createElement("script");
          script.src = "https://sdk.mercadopago.com/js/v2";
          script.async = true;
          document.body.appendChild(script);
        }
      } catch (err) {
        console.error("[SAVED_CARD_MP_KEY]", err);
        messageApi.error(err instanceof Error ? err.message : "Erro ao carregar Mercado Pago");
      } finally {
        setLoadingKey(false);
      }
    }

    fetchPublicKey();
  }, [messageApi]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

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
    if (!selectedCardId || !cvv) {
      onError(new Error("Selecione um cartão e informe o CVV"));
      return;
    }

    setProcessing(true);

    try {
      // Verificar HTTPS (requisito do Mercado Pago)
      if (typeof window !== "undefined" && window.location.protocol !== "https:") {
        throw new Error(
          "Pagamento requer conexão segura (HTTPS). Em desenvolvimento, use ngrok."
        );
      }

      // Buscar dados do usuário para obter CPF
      const userResponse = await fetch("/api/account/profile");
      if (!userResponse.ok) {
        throw new Error("Erro ao buscar dados do usuário");
      }
      const userData = await userResponse.json();
      const userCpf = userData.cpf?.replace(/\D/g, "") || "00000000000";

      // Criar token usando endpoint backend (SDK backend que sabemos que funciona)
      console.log('[SAVED_CARD_PAYMENT] Criando token no backend...');

      const tokenizeResponse = await fetch(
        `/api/account/cards/${selectedCardId}/create-token-backend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cvv,
            cpf: userCpf,
          }),
        }
      );

      if (!tokenizeResponse.ok) {
        const errorData = await tokenizeResponse.json();
        throw new Error(errorData.message || "Erro ao criar token");
      }

      const tokenResponse = await tokenizeResponse.json();
      const token = tokenResponse.data;

      console.log('[SAVED_CARD_PAYMENT] Token criado no backend:', {
        id: token.id,
        first_six_digits: token.first_six_digits,
        last_four_digits: token.last_four_digits,
      });

      if (!token || !token.id) {
        throw new Error("Falha ao criar token");
      }

      // Obter dados do cartão selecionado
      const selectedCard = cards?.find((c) => c.id === selectedCardId);
      if (!selectedCard) {
        throw new Error("Cartão não encontrado");
      }

      // Mapear brand para paymentMethodId
      const paymentMethodMap: Record<string, string> = {
        VISA: "visa",
        MASTERCARD: "master",
        ELO: "elo",
        AMEX: "amex",
        HIPERCARD: "hipercard",
        OTHER: "master", // fallback
      };

      const paymentMethodId = paymentMethodMap[selectedCard.brand] || "master";

      // Processar pagamento com token
      const paymentResponse = await fetch("/api/payments/mercadopago/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.id,
          transactionAmount: amount,
          paymentMethodId,
          installments: 1,
          payer: {
            email: userData.email,
            firstName: userData.fullName.split(" ")[0],
            lastName: userData.fullName.split(" ").slice(1).join(" ") || userData.fullName,
            identification: {
              type: "CPF",
              number: userData.cpf?.replace(/\D/g, "") || "00000000000",
            },
          },
          cardData: {
            cardholderName: selectedCard.holderName,
          },
          description: `Recarga de carteira - R$ ${amount.toFixed(2)}`,
          metadata: {
            type: "wallet_topup",
            cardId: selectedCardId,
          },
        }),
      });

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json();
        throw new Error(errorData.message || "Erro ao processar pagamento");
      }

      const result = await paymentResponse.json();
      onSuccess(result.payment.id);
    } catch (err) {
      console.error("[SAVED_CARD_PAYMENT]", err);
      onError(err instanceof Error ? err : new Error("Erro desconhecido"));
    } finally {
      setProcessing(false);
    }
  };

  // Filtrar cartões válidos (com brand e last4)
  const availableCards = cards?.filter((card) => card.brand && card.last4) || [];

  if (isLoading) {
    return (
      <AntCard>
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <Text type="secondary">Carregando cartões...</Text>
        </div>
      </AntCard>
    );
  }

  if (availableCards.length === 0) {
    return (
      <AntCard>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Alert
            message="Nenhum cartão cadastrado"
            description="Você ainda não possui cartões cadastrados. Adicione um novo cartão para continuar."
            type="info"
            showIcon
          />
          <Button type="primary" onClick={onUseNewCard} block>
            Adicionar Novo Cartão
          </Button>
        </Space>
      </AntCard>
    );
  }

  return (
    <AntCard>
      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        {typeof window !== "undefined" && window.location.protocol !== "https:" && (
          <Alert
            message="HTTPS necessário"
            description="O pagamento requer conexão segura (HTTPS). Use ngrok para desenvolvimento local."
            type="warning"
            showIcon
          />
        )}

        <div>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            Valor a pagar:
          </Text>
          <Text style={{ fontSize: 24, color: "#52c41a" }}>
            {formatCurrency(amount)}
          </Text>
        </div>

        <Form.Item
          label="Selecione um cartão"
          required
          validateStatus={!selectedCardId ? "error" : undefined}
          help={!selectedCardId ? "Selecione um cartão" : undefined}
        >
          <Radio.Group
            value={selectedCardId}
            onChange={(e) => setSelectedCardId(e.target.value)}
            style={{ width: "100%" }}
          >
            <Space direction="vertical" size="small" style={{ width: "100%" }}>
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

        <Form.Item
          label="Código de Segurança (CVV)"
          required
          validateStatus={!cvv || cvv.length < 3 ? "error" : undefined}
          help={
            !cvv
              ? "Informe o CVV do cartão"
              : cvv.length < 3
              ? "CVV deve ter 3 ou 4 dígitos"
              : "Encontrado no verso do cartão"
          }
        >
          <Input
            prefix={<LockOutlined />}
            placeholder="123"
            value={cvv}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 4) {
                setCvv(value);
              }
            }}
            maxLength={4}
            size="large"
            style={{ width: "150px" }}
            type="password"
          />
        </Form.Item>

        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Button
            type="primary"
            size="large"
            block
            onClick={handleSubmit}
            loading={processing || loadingKey}
            disabled={!selectedCardId || !cvv || cvv.length < 3 || !publicKey}
          >
            Pagar {formatCurrency(amount)}
          </Button>

          <Button type="link" onClick={onUseNewCard} block>
            Usar outro cartão
          </Button>
        </Space>
      </Space>
    </AntCard>
  );
}

export default SavedCardPaymentForm;
