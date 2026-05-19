"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ELCard, ELInput, ELRadio, ELSpace, ELTypography, ELAlert, ELForm, useELApp } from '@/shared/ui';
const Card = ELCard;
const Input = ELInput;
const Radio = ELRadio;
const Space = ELSpace;
const Typography = ELTypography;
const Alert = ELAlert;
const Form = ELForm;
const App = { useApp: useELApp };
import { ELButton, ELModal } from '@/shared/ui';
import { CreditCardOutlined, LockOutlined, LoadingOutlined } from "@ant-design/icons";
import { formatBRL } from "@/shared/utils/format";

// Timeout para aguardar confirmação da operadora (15 segundos)
const CARD_PROCESSING_TIMEOUT_MS = 15000;
import { useCards } from "@/modules/account/ui/hooks";

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
  onSuccess: (transactionId: string) => void;
  onError: (error: Error) => void;
  onUseNewCard: () => void; // Callback para usar novo cartão
  paymentType?: 'wallet_topup' | 'checkout_payment'; // Tipo de pagamento (default: wallet_topup)
  paymentDescription?: string; // Descrição customizada
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
  paymentType = 'wallet_topup',
  paymentDescription,
}: SavedCardPaymentFormProps) {
  const { message: messageApi } = App.useApp();
  const { data: cards, isLoading } = useCards();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [cvv, setCvv] = useState("");
  const [cvvTouched, setCvvTouched] = useState(false);

  // Determinar se o cartão selecionado é AMEX (CVV com 4 dígitos)
  const selectedCard = cards?.find((c) => c.id === selectedCardId);
  const isAmex = selectedCard?.brand?.toUpperCase() === "AMEX";
  const cvvLength = isAmex ? 4 : 3;
  const [processing, setProcessing] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
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

  // Limpar CVV quando trocar de cartão (tamanho pode mudar)
  useEffect(() => {
    setCvv("");
    setCvvTouched(false);
  }, [selectedCardId]);

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

  // Carregar MP SDK e public key
  useEffect(() => {
    async function fetchPublicKey() {
      try {
        const response = await fetch("/api/payments/mercadopago/public-key");
        if (!response.ok) {
          throw new Error("Falha ao carregar configuração do Mercado Pago");
        }
        const json = await response.json();
        // Handle standardized API response format { data: T, error, meta }
        const data = json.data ?? json;
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

    // Mostrar modal de processamento
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
      // Verificar HTTPS (requisito do Mercado Pago) - apenas em produção
      // Em desenvolvimento, o SDK pode funcionar sem HTTPS em alguns casos
      if (typeof window !== "undefined" &&
          window.location.protocol !== "https:" &&
          process.env.NODE_ENV === "production") {
        throw new Error("Cartão não autorizado");
      }

      // Buscar dados do usuário para obter CPF
      const userResponse = await fetch("/api/account/profile", {
        signal: abortControllerRef.current.signal,
      });
      if (!userResponse.ok) {
        throw new Error("Cartão não autorizado");
      }
      const userJson = await userResponse.json();
      // Handle standardized API response format { data: T, error, meta }
      const userData = userJson.data ?? userJson;
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
          signal: abortControllerRef.current.signal,
        }
      );

      if (!tokenizeResponse.ok) {
        // Tratar como "Cartão não autorizado"
        throw new Error("Cartão não autorizado");
      }

      const tokenResponse = await tokenizeResponse.json();
      const token = tokenResponse.data;

      console.log('[SAVED_CARD_PAYMENT] Token criado no backend:', {
        id: token.id,
        first_six_digits: token.first_six_digits,
        last_four_digits: token.last_four_digits,
      });

      if (!token || !token.id) {
        throw new Error("Cartão não autorizado");
      }

      // Verificar cartão selecionado
      if (!selectedCard) {
        throw new Error("Cartão não autorizado");
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
            firstName: userData.fullName?.split(" ")[0] || userData.name?.split(" ")[0] || "Usuario",
            lastName: userData.fullName?.split(" ").slice(1).join(" ") || userData.name?.split(" ").slice(1).join(" ") || "",
            identification: {
              type: "CPF",
              number: userData.cpf?.replace(/\D/g, "") || "00000000000",
            },
          },
          cardData: {
            cardholderName: selectedCard.holderName,
          },
          description: paymentDescription || `Recarga de carteira - ${formatBRL(amount)}`,
          metadata: {
            type: paymentType,
            cardId: selectedCardId,
          },
        }),
        signal: abortControllerRef.current.signal,
      });

      // Limpar timeout se a requisição completou
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (!paymentResponse.ok) {
        // Tratar como "Cartão não autorizado"
        throw new Error("Cartão não autorizado");
      }

      const resultJson = await paymentResponse.json();
      // Handle standardized API response format { data: T, error, meta }
      const result = resultJson.data ?? resultJson;

      // Verificar se o pagamento foi realmente aprovado
      if (result.payment.status === 'approved') {
        setProcessing(false);
        onSuccess(String(result.payment.id));
      } else if (result.payment.status === 'in_process' || result.payment.status === 'pending') {
        // Pagamento em análise - informar usuário
        setProcessing(false);
        throw new Error("Pagamento em análise pela operadora. Você será notificado quando aprovado.");
      } else {
        // Outros status (rejected, etc)
        setProcessing(false);
        throw new Error("Cartão não autorizado");
      }
    } catch (err) {
      // Limpar timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setProcessing(false);

      // Se foi abortado pelo timeout, a mensagem já foi enviada
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      console.error("[SAVED_CARD_PAYMENT]", err);

      // Preservar mensagem de "em análise", outras viram "Cartão não autorizado"
      if (err instanceof Error && err.message.includes("análise")) {
        onError(err);
      } else {
        onError(new Error("Cartão não autorizado"));
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

        <Form.Item
          label="Código de Segurança (CVV)"
          required
          validateStatus={cvvTouched && (!cvv || cvv.length !== cvvLength) ? "error" : undefined}
          help={
            cvvTouched && !cvv
              ? "Informe o CVV do cartão"
              : cvvTouched && cvv.length !== cvvLength
              ? `CVV deve ter ${cvvLength} dígitos`
              : undefined
          }
        >
          <Input
            prefix={<LockOutlined />}
            placeholder={isAmex ? "1234" : "123"}
            value={cvv}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= cvvLength) {
                setCvv(value);
              }
            }}
            onBlur={() => setCvvTouched(true)}
            maxLength={cvvLength}
            size="large"
            style={{ width: "150px" }}
            type="password"
          />
        </Form.Item>

          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            <ELButton
              variant="primary"
              size="large"
              block
              onClick={handleSubmit}
              loading={processing || loadingKey}
              disabled={!selectedCardId || !cvv || cvv.length !== cvvLength || !publicKey}
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
