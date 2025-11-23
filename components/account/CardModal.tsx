"use client";

import { useEffect, useState } from "react";
import { App, Form, Input, Modal, Alert } from "antd";

export type CardFormValues = {
  mpToken: string;
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
};

type CardModalProps = {
  open: boolean;
  loading?: boolean;
  onSubmit: (values: CardFormValues) => void;
  onCancel: () => void;
};

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

export function CardModal({ open, loading, onSubmit, onCancel }: CardModalProps) {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [processing, setProcessing] = useState(false);

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
        console.error("[CARD_MODAL_PUBLIC_KEY]", err);
        messageApi.error(err instanceof Error ? err.message : "Erro ao carregar Mercado Pago");
      } finally {
        setLoadingKey(false);
      }
    }

    if (open) {
      fetchPublicKey();
      form.resetFields();
    }
  }, [open, form, messageApi]);

  const handleSubmit = async () => {
    try {
      setProcessing(true);
      const values = await form.validateFields();

      // Verificar se está usando HTTPS (requisito do Mercado Pago)
      if (typeof window !== "undefined" && window.location.protocol !== "https:") {
        throw new Error(
          "O cadastro de cartões requer HTTPS. Em desenvolvimento, use ngrok ou adicione créditos via 'Cartão de crédito' que salvará o cartão automaticamente."
        );
      }

      if (!publicKey || !window.MercadoPago) {
        throw new Error("SDK do Mercado Pago não carregado");
      }

      // Inicializar SDK do MP
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });

      // Criar token do cartão
      const cardData = {
        cardNumber: values.cardNumber.replace(/\s/g, ""),
        cardholderName: values.holderName,
        cardExpirationMonth: values.expMonth,
        cardExpirationYear: values.expYear,
        securityCode: values.cvv,
        identificationType: values.documentType || "CPF",
        identificationNumber: values.document.replace(/\D/g, ""),
      };

      const token = await mp.createCardToken(cardData);

      if (!token || !token.id) {
        throw new Error("Falha ao tokenizar cartão");
      }

      // Extrair informações do cartão para enviar ao backend
      const cardNumber = values.cardNumber.replace(/\s/g, "");
      const expMonth = parseInt(values.expMonth, 10);
      const expYear = parseInt(values.expYear, 10);

      // Chamar callback com dados completos + token
      // O backend irá calcular brand, last4, etc.
      onSubmit({
        mpToken: token.id,
        number: cardNumber,
        holderName: values.holderName,
        expMonth,
        expYear,
        isDefault: false,
      });
    } catch (err) {
      console.error("[CARD_MODAL_SUBMIT]", err);
      messageApi.error(err instanceof Error ? err.message : "Erro ao processar cartão");
    } finally {
      setProcessing(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(" ");
    } else {
      return value;
    }
  };

  return (
    <Modal
      open={open}
      title="Adicionar cartão"
      okText="Adicionar"
      confirmLoading={loading || processing}
      onOk={handleSubmit}
      onCancel={onCancel}
      width={600}
    >
      {typeof window !== "undefined" && window.location.protocol !== "https:" && (
        <Alert
          message="HTTPS necessário"
          description="O cadastro de cartões requer conexão segura (HTTPS). Use ngrok para desenvolvimento local ou adicione créditos via 'Cartão de crédito' que salvará o cartão automaticamente."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Form form={form} layout="vertical" disabled={loadingKey || loading || processing}>
        <Form.Item
          name="holderName"
          label="Nome impresso no cartão"
          rules={[{ required: true, message: "Informe o nome" }]}
        >
          <Input placeholder="Nome como está no cartão" />
        </Form.Item>

        <Form.Item
          name="cardNumber"
          label="Número do cartão"
          rules={[
            { required: true, message: "Informe o número do cartão" },
            { min: 13, message: "Número inválido" },
          ]}
        >
          <Input
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            onChange={(e) => {
              const formatted = formatCardNumber(e.target.value);
              form.setFieldValue("cardNumber", formatted);
            }}
          />
        </Form.Item>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <Form.Item
            name="expMonth"
            label="Mês"
            rules={[{ required: true, message: "Mês" }]}
          >
            <Input placeholder="MM" maxLength={2} />
          </Form.Item>

          <Form.Item
            name="expYear"
            label="Ano"
            rules={[{ required: true, message: "Ano" }]}
          >
            <Input placeholder="AAAA" maxLength={4} />
          </Form.Item>

          <Form.Item
            name="cvv"
            label="CVV"
            rules={[{ required: true, message: "CVV" }]}
          >
            <Input placeholder="123" maxLength={4} type="password" />
          </Form.Item>
        </div>

        <Form.Item
          name="document"
          label="CPF/CNPJ do titular"
          rules={[{ required: true, message: "Informe o documento" }]}
        >
          <Input placeholder="000.000.000-00" />
        </Form.Item>

        <Form.Item name="documentType" hidden initialValue="CPF">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default CardModal;
