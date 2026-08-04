"use client";

import { useEffect, useState } from "react";
import { useELApp, ELForm, ELInput, ELRow, ELCol } from '@/shared/ui';
const App = { useApp: useELApp };
const Form = ELForm;
const Input = ELInput;
const Row = ELRow;
const Col = ELCol;
import { ELModal } from '@/shared/ui/ELModal';
import {
  CreditCardOutlined,
  SafetyOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { maskCEP, isValidCep, normalizeCep } from '@/shared/utils/masks';

export type CardFormValues = {
  /** Token de tokenização do Asaas (Task 9) — o que POST /api/account/cards espera desde a Task 11. */
  asaasToken: string;
  brand: string;
  last4: string;
  holderName: string;
  expMonth: number;
  expYear: number;
};

type CardModalProps = {
  open: boolean;
  loading?: boolean;
  onSubmit: (values: CardFormValues) => void;
  onCancel: () => void;
};


type CardBrand = {
  name: string;
  pattern: RegExp;
  logo?: string;
};

/**
 * NOTA (Task 15 - migração Asaas): este fluxo de cadastro de cartão em
 * "Minha conta" usa a tokenização Asaas (Task 9). O token é persistível
 * (diferente do Pagar.me que exigiu um segundo endpoint de cofre), mas a
 * resposta não devolve holderName/brand/last4, então o formulário reenvia
 * esses dados junto com o token para POST /api/account/cards.
 */
async function tokenizeCard(card: {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  postalCode: string;
  addressNumber: string;
}): Promise<{ token: string; brand: string; last4: string }> {
  const res = await fetch('/api/payments/asaas/tokenize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: card.number.replace(/\D/g, ''),
      holderName: card.holderName,
      expMonth: parseInt(card.expMonth, 10),
      expYear: parseInt(card.expYear.length === 2 ? `20${card.expYear}` : card.expYear, 10),
      ccv: card.cvv,
      postalCode: normalizeCep(card.postalCode),
      addressNumber: card.addressNumber.trim(),
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || 'Falha ao tokenizar cartão');
  }

  const token = (json.data ?? json).token as string;
  const brand = (json.data ?? json).brand as string;
  const last4 = (json.data ?? json).last4 as string;

  if (!token || !brand || !last4) {
    throw new Error('Token ou metadados inválidos retornados pelo Asaas');
  }

  return { token, brand, last4 };
}

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
  const [processing, setProcessing] = useState(false);
  const [cardBrand, setCardBrand] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      form.resetFields();
      setCardBrand(null);
    }
  }, [open, form]);

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

      // Verificar se está usando HTTPS — apenas em produção
      if (typeof window !== "undefined" &&
          window.location.protocol !== "https:" &&
          process.env.NODE_ENV === "production") {
        throw new Error("Não foi possível estabelecer uma conexão segura. Tente novamente.");
      }

      // Parsear validade MM/AA para mês e ano separados
      const [expMonth, expYear] = values.validity.split("/");
      const fullYear = `20${expYear}`;

      const { token, brand, last4 } = await tokenizeCard({
        number: values.cardNumber.replace(/\s/g, ""),
        holderName: values.holderName,
        expMonth,
        expYear: fullYear,
        cvv: values.cvv || "000",
        postalCode: values.postalCode,
        addressNumber: values.addressNumber,
      });

      // Higienizar PAN/CVV do state assim que a resposta do tokenize chega
      // (sucesso OU erro) — o token já basta para o resto do fluxo, não há
      // motivo para manter os dados brutos do cartão em memória depois disso.
      form.setFieldsValue({
        cardNumber: '',
        cvv: '',
      });

      onSubmit({
        asaasToken: token,
        holderName: values.holderName,
        brand,
        last4,
        expMonth: parseInt(expMonth, 10),
        expYear: parseInt(fullYear, 10),
      });
    } catch (err) {
      // Rede fora etc. podem interromper antes da resposta do
      // tokenize chegar — higieniza de novo aqui como rede de segurança
      // (idempotente, sem custo se já estiver limpo).
      form.setFieldsValue({
        cardNumber: '',
        cvv: '',
      });
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
      <Form form={form} layout="vertical" disabled={loading || processing}>
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

        {/* Validade + CVV em linha */}
        <Row gutter={16}>
          <Col xs={24} sm={12}>
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

          <Col xs={24} sm={12}>
            <Form.Item
              name="cvv"
              label="CVV"
              rules={[
                { required: true, message: "Informe o CVV" },
                { len: 3, message: "CVV deve ter 3 dígitos" },
              ]}
            >
              <Input
                placeholder="123"
                maxLength={3}
                size="large"
              />
            </Form.Item>
          </Col>
        </Row>

        {/* CEP + Número do endereço em linha */}
        <Row gutter={16}>
          <Col xs={24} sm={14}>
            <Form.Item
              name="postalCode"
              label="CEP do titular"
              rules={[
                { required: true, message: "Informe o CEP" },
                {
                  validator: (_, value) => {
                    if (!isValidCep(value)) {
                      return Promise.reject(new Error("CEP inválido (8 dígitos)"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <Input
                placeholder="00000-000"
                maxLength={9}
                size="large"
                onChange={(e) => {
                  const formatted = maskCEP(e.target.value);
                  form.setFieldValue("postalCode", formatted);
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} sm={10}>
            <Form.Item
              name="addressNumber"
              label="Número"
              rules={[
                { required: true, message: "Informe o número do endereço" },
              ]}
            >
              <Input
                placeholder="123"
                size="large"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </ELModal>
  );
}

export default CardModal;
