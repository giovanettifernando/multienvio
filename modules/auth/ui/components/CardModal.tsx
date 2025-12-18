"use client";

import { useEffect, useState } from "react";
import { App, Form, Input, Row, Col } from "antd";
import { ELModal } from '@/shared/ui/ELModal';
import {
  CreditCardOutlined,
  SafetyOutlined,
  UserOutlined,
  IdcardOutlined,
} from "@ant-design/icons";

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

type CardBrand = {
  name: string;
  pattern: RegExp;
  logo?: string;
};

const CARD_BRANDS: CardBrand[] = [
  { name: "Visa", pattern: /^4/ },
  { name: "Mastercard", pattern: /^5[1-5]/ },
  { name: "Elo", pattern: /^(4011|4312|4389|4514|4576|5041|5066|5067|6277|6362|6363|6504|6505|6516)/ },
  { name: "Amex", pattern: /^3[47]/ },
  { name: "Diners", pattern: /^3(?:0[0-5]|[68])/ },
  { name: "Discover", pattern: /^6(?:011|5)/ },
  { name: "JCB", pattern: /^35/ },
  { name: "Hipercard", pattern: /^606282/ },
];

export function CardModal({ open, loading, onSubmit, onCancel }: CardModalProps) {
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cardBrand, setCardBrand] = useState<string | null>(null);

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
        console.error("[CARD_MODAL_PUBLIC_KEY]", err);
        messageApi.error(err instanceof Error ? err.message : "Erro ao carregar Mercado Pago");
      } finally {
        setLoadingKey(false);
      }
    }

    if (open) {
      fetchPublicKey();
      form.resetFields();
      setCardBrand(null);
    }
  }, [open, form, messageApi]);

  /**
   * Detecta a bandeira do cartão baseado no número
   */
  const detectCardBrand = (cardNumber: string): string | null => {
    const cleanNumber = cardNumber.replace(/\s/g, "");

    for (const brand of CARD_BRANDS) {
      if (brand.pattern.test(cleanNumber)) {
        return brand.name;
      }
    }

    return null;
  };

  const handleSubmit = async () => {
    try {
      setProcessing(true);
      const values = await form.validateFields();

      // Verificar se está usando HTTPS (requisito do Mercado Pago) - apenas em produção
      // Em desenvolvimento, o SDK pode funcionar sem HTTPS em alguns casos
      if (typeof window !== "undefined" &&
          window.location.protocol !== "https:" &&
          process.env.NODE_ENV === "production") {
        throw new Error("Não foi possível estabelecer uma conexão segura. Tente novamente.");
      }

      if (!publicKey || !window.MercadoPago) {
        throw new Error("SDK do Mercado Pago não carregado");
      }

      // Parsear validade MM/AA para mês e ano separados
      const [expMonth, expYear] = values.validity.split("/");
      const fullYear = `20${expYear}`; // Converter YY para YYYY (ex: 25 -> 2025)

      // Inicializar SDK do MP
      const mp = new window.MercadoPago(publicKey, { locale: "pt-BR" });

      // Criar token do cartão
      // NOTA: O CVV não é armazenado - será solicitado apenas no momento do pagamento.
      // Para tokenização inicial, usamos um CVV dummy (será substituído no checkout).
      const cardData = {
        cardNumber: values.cardNumber.replace(/\s/g, ""),
        cardholderName: values.holderName,
        cardExpirationMonth: expMonth,
        cardExpirationYear: fullYear,
        securityCode: "123", // CVV dummy para tokenização inicial
        identificationType: values.documentType || "CPF",
        identificationNumber: values.document.replace(/\D/g, ""),
      };

      const token = await mp.createCardToken(cardData);

      if (!token || !token.id) {
        throw new Error("Falha ao tokenizar cartão");
      }

      // Extrair informações do cartão para enviar ao backend
      const cardNumber = values.cardNumber.replace(/\s/g, "");

      // Chamar callback com dados completos + token
      // O backend irá calcular brand, last4, etc.
      onSubmit({
        mpToken: token.id,
        number: cardNumber,
        holderName: values.holderName,
        expMonth: parseInt(expMonth, 10),
        expYear: parseInt(fullYear, 10),
        isDefault: false,
      });
    } catch (err) {
      console.error("[CARD_MODAL_SUBMIT]", err);
      messageApi.error(err instanceof Error ? err.message : "Erro ao processar cartão");
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Formata número do cartão com espaços: 0000 0000 0000 0000
   */
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

  /**
   * Formata e valida validade MM/AA
   */
  const formatValidity = (value: string) => {
    const v = value.replace(/\D/g, "");

    if (v.length >= 2) {
      return `${v.slice(0, 2)}/${v.slice(2, 4)}`;
    }

    return v;
  };

  /**
   * Formata CPF/CNPJ dinamicamente
   */
  const formatDocument = (value: string) => {
    const v = value.replace(/\D/g, "");

    if (v.length <= 11) {
      // CPF: 000.000.000-00
      return v
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    } else {
      // CNPJ: 00.000.000/0000-00
      return v
        .replace(/(\d{2})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1.$2")
        .replace(/(\d{3})(\d)/, "$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
    }
  };

  /**
   * Valida se a validade está no futuro
   */
  const validateValidity = (_: unknown, value: string) => {
    if (!value || !value.includes("/")) {
      return Promise.reject(new Error("Informe a validade no formato MM/AA"));
    }

    const [month, year] = value.split("/");
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);

    // Validar mês (01-12)
    if (monthNum < 1 || monthNum > 12) {
      return Promise.reject(new Error("Mês inválido (01-12)"));
    }

    // Validar ano (atual até +15 anos)
    const currentYear = new Date().getFullYear() % 100; // Pegar últimos 2 dígitos
    const maxYear = currentYear + 15;

    if (yearNum < currentYear || yearNum > maxYear) {
      return Promise.reject(new Error(`Ano inválido (${currentYear}-${maxYear})`));
    }

    // Verificar se não é passado
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYearFull = currentDate.getFullYear();
    const cardYearFull = 2000 + yearNum;

    if (
      cardYearFull < currentYearFull ||
      (cardYearFull === currentYearFull && monthNum < currentMonth)
    ) {
      return Promise.reject(new Error("Cartão expirado"));
    }

    return Promise.resolve();
  };

  return (
    <ELModal
      open={open}
      title="Adicionar cartão"
      okText="Adicionar"
      confirmLoading={loading || processing}
      onOk={handleSubmit}
      onCancel={onCancel}
      size="md"
    >
      <Form form={form} layout="vertical" disabled={loadingKey || loading || processing}>
        {/* Nome no cartão - Full width */}
        <Form.Item
          name="holderName"
          label="Nome impresso no cartão"
          rules={[{ required: true, message: "Informe o nome como está impresso no cartão" }]}
        >
          <Input
            placeholder="NOME COMPLETO"
            prefix={<UserOutlined style={{ color: "#bfbfbf" }} />}
            size="large"
            style={{ textTransform: "uppercase" }}
          />
        </Form.Item>

        {/* Número do cartão - Full width com logo da bandeira */}
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
            prefix={<CreditCardOutlined style={{ color: "#bfbfbf" }} />}
            suffix={
              cardBrand ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#8c8c8c", fontWeight: 500 }}>
                    {cardBrand}
                  </span>
                  <SafetyOutlined style={{ color: "#52c41a" }} />
                </div>
              ) : null
            }
            size="large"
            onChange={(e) => {
              const formatted = formatCardNumber(e.target.value);
              form.setFieldValue("cardNumber", formatted);

              // Detectar bandeira
              const brand = detectCardBrand(formatted);
              setCardBrand(brand);
            }}
          />
        </Form.Item>

        {/* Validade + CPF/CNPJ em linha */}
        <Row gutter={16}>
          <Col xs={24} sm={10}>
            <Form.Item
              name="validity"
              label="Validade"
              rules={[
                { required: true, message: "Informe a validade" },
                { validator: validateValidity },
              ]}
            >
              <Input
                placeholder="MM/AA"
                maxLength={5}
                size="large"
                onChange={(e) => {
                  const formatted = formatValidity(e.target.value);
                  form.setFieldValue("validity", formatted);
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={14}>
            <Form.Item
              name="document"
              label="CPF/CNPJ do titular"
              rules={[
                { required: true, message: "Informe o CPF ou CNPJ" },
                {
                  validator: (_, value) => {
                    const digits = value?.replace(/\D/g, "") || "";
                    if (digits.length !== 11 && digits.length !== 14) {
                      return Promise.reject(new Error("CPF ou CNPJ inválido"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                placeholder="000.000.000-00"
                prefix={<IdcardOutlined style={{ color: "#bfbfbf" }} />}
                maxLength={18}
                size="large"
                onChange={(e) => {
                  const formatted = formatDocument(e.target.value);
                  form.setFieldValue("document", formatted);
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="documentType" hidden initialValue="CPF">
          <Input />
        </Form.Item>
      </Form>
    </ELModal>
  );
}

export default CardModal;
