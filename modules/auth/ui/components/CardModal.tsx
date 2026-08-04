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


type CardBrand = {
  name: string;
  pattern: RegExp;
  logo?: string;
};

/**
 * NOTA (Task 14 - migração Asaas): este fluxo de cadastro de cartão em
 * "Minha conta" está fora do escopo desta task (não listado no brief; o
 * fluxo equivalente migrado fica em modules/wallet/ui/components/CardPaymentForm.tsx).
 * `modules/payments/ui/utils/tokenizeCard.ts` foi removido por pedir a rota do
 * Pagar.me no navegador; esta função local preserva o comportamento anterior
 * (idêntico ao utilitário removido) para não quebrar o build. Já estava
 * quebrado em runtime antes desta task (gateway Pagar.me inativo desde a
 * Task 6) — migrar para /api/payments/asaas/tokenize fica para quem tratar
 * este fluxo.
 */
async function tokenizeCard(card: {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}): Promise<string> {
  const res = await fetch('/api/payments/pagarme/tokenize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      number: card.number.replace(/\D/g, ''),
      holderName: card.holderName,
      expMonth: parseInt(card.expMonth, 10),
      expYear: parseInt(card.expYear.length === 2 ? `20${card.expYear}` : card.expYear, 10),
      cvv: card.cvv,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: { message?: string } })?.error?.message || 'Falha ao tokenizar cartão');
  }

  const token = ((json as { data?: { token?: string } })?.data ?? (json as { token?: string }))?.token;
  if (!token) throw new Error('Token inválido retornado pelo Pagar.me');
  return token;
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

      const token = await tokenizeCard({
        number: values.cardNumber.replace(/\s/g, ""),
        holderName: values.holderName,
        expMonth,
        expYear: fullYear,
        cvv: values.cvv || "000",
      });

      onSubmit({
        mpToken: token,
        number: values.cardNumber.replace(/\s/g, ""),
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
