"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import type { CompanyWizardData } from "@/lib/validation/company";

type QuoteResult = {
  id: string;
  serviceCode: string;
  name: string;
  carrier: string;
  etaDays: number;
  price: number;
  estimatedDelivery: string;
};

type QuoteSnapshot = {
  id: string;
  resultados: QuoteResult[];
};

type QuoteFormValues = {
  cepOrigem: string;
  cepDestino: string;
  pesoKg: number;
  valorDeclarado: number;
  comprimentoCm: number;
  larguraCm: number;
  alturaCm: number;
  servico: string;
};

async function fetchCompany(): Promise<{ company: CompanyWizardData | null }> {
  const response = await fetch("/api/account/company");
  if (!response.ok) {
    throw new Error("Não foi possível carregar os dados da empresa.");
  }
  return response.json();
}

async function requestQuickQuote(payload: QuoteFormValues): Promise<QuoteSnapshot> {
  const response = await fetch("/api/cotacoes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origemDestino: {
        cepOrigem: payload.cepOrigem,
        cepDestino: payload.cepDestino,
        coleta: false,
        portaAPorta: false,
      },
      pacote: {
        pesoKg: payload.pesoKg,
        valorDeclarado: payload.valorDeclarado,
        comprimentoCm: payload.comprimentoCm,
        larguraCm: payload.larguraCm,
        alturaCm: payload.alturaCm,
        categoria: "Documentos",
      },
      preferencias: {
        prioridade: 50,
        adicionais: {
          seguro: false,
          avisoRecebimento: false,
          maoPropria: false,
        },
        transportadoras: [],
        usarTabelaContratada: false,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new Error(body?.mensagem ?? "Não foi possível calcular a cotação.");
  }

  const data = (await response.json()) as QuoteSnapshot;
  return {
    id: data.id,
    resultados: data.resultados.slice(0, 3),
  };
}

const serviceOptions = [
  { label: "Convencional", value: "CONVENCIONAL" },
  { label: "Expresso", value: "EXPRESSO" },
  { label: "Same Day", value: "SAME_DAY" },
];

export function QuickQuote() {
  const router = useRouter();
  const [form] = Form.useForm<QuoteFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [resultModal, setResultModal] = useState<QuoteSnapshot | null>(null);

  const companyQuery = useQuery({
    queryKey: ["account", "company"],
    queryFn: fetchCompany,
    staleTime: 60_000,
  });

  const defaultCepOrigem = companyQuery.data?.company?.endereco.cep ?? "";

  useEffect(() => {
    if (defaultCepOrigem) {
      const current = form.getFieldValue("cepOrigem");
      if (!current) {
        form.setFieldsValue({ cepOrigem: defaultCepOrigem });
      }
    }
  }, [defaultCepOrigem, form]);

  const quoteMutation = useMutation({
    mutationFn: requestQuickQuote,
    onSuccess: (data) => {
      if (!data.resultados.length) {
        messageApi.info("Nenhum serviço disponível para os parâmetros informados.");
        return;
      }
      setResultModal(data);
    },
    onError: (error: unknown) => {
      const text = error instanceof Error ? error.message : "Não foi possível gerar a cotação.";
      messageApi.error(text);
    },
  });

  const initialValues = useMemo<Partial<QuoteFormValues>>(
    () => ({
      cepOrigem: defaultCepOrigem,
      cepDestino: "",
      pesoKg: 1,
      valorDeclarado: 150,
      comprimentoCm: 20,
      larguraCm: 15,
      alturaCm: 10,
      servico: "CONVENCIONAL",
    }),
    [defaultCepOrigem],
  );

  return (
    <Card
      title="Cotação rápida"
      variant="borderless"
      styles={{ body: { paddingTop: 16 } }}
      extra={
        <Button
          type="link"
          onClick={() => router.push("/cotacoes")}
          aria-label="Ir para página de cotações"
        >
          Ver cotações completas
        </Button>
      }
    >
      {contextHolder}
      <Form<QuoteFormValues>
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={(values) => quoteMutation.mutate(values)}
      >
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <Form.Item
              label="CEP origem"
              name="cepOrigem"
              rules={[
                { required: true, message: "Informe o CEP de origem" },
                {
                  pattern: /^[0-9]{5}-?[0-9]{3}$/u,
                  message: "CEP inválido",
                },
              ]}
            >
              <Input placeholder="00000-000" maxLength={9} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="CEP destino"
              name="cepDestino"
              rules={[
                { required: true, message: "Informe o CEP de destino" },
                {
                  pattern: /^[0-9]{5}-?[0-9]{3}$/u,
                  message: "CEP inválido",
                },
              ]}
            >
              <Input placeholder="00000-000" maxLength={9} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Peso (kg)"
              name="pesoKg"
              rules={[
                { required: true, message: "Informe o peso" },
                {
                  type: "number",
                  max: 30,
                  message: "Peso máximo suportado é 30 kg",
                },
              ]}
            >
              <InputNumber min={0.1} max={30} step={0.1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="Valor declarado (R$)"
              name="valorDeclarado"
              rules={[{ required: true, message: "Informe o valor declarado" }]}
            >
              <InputNumber<number>
                min={0}
                step={10}
                formatter={(value, info) => {
                  // enquanto o usuário digita, preserve o que está no input (evita “pular” o cursor)
                  if (info.userTyping) return info.input || "";
                  const num =
                    typeof value === "number"
                      ? value
                      : value != null && value !== ""
                      ? Number.parseFloat(String(value))
                      : 0;

                  return Number.isFinite(num)
                    ? num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "";
                }}
                parser={(display) => {
                  const s = display ?? "";
                  const parsed = Number.parseFloat(
                    s.replace(/[R$\s.]/gu, "").replace(",", "."),
                  );
                  return Number.isFinite(parsed) ? parsed : 0;
                }}
                style={{ width: "100%" }}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[16, 12]}>
          <Col span={8}>
            <Form.Item
              label="Comprimento (cm)"
              name="comprimentoCm"
              rules={[
                { required: true, message: "Informe o comprimento" },
                {
                  type: "number",
                  min: 16,
                  message: "Comprimento mínimo é 16 cm",
                },
              ]}
            >
              <InputNumber min={16} max={120} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Largura (cm)"
              name="larguraCm"
              rules={[
                { required: true, message: "Informe a largura" },
                {
                  type: "number",
                  min: 11,
                  message: "Largura mínima é 11 cm",
                },
              ]}
            >
              <InputNumber min={11} max={80} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="Altura (cm)"
              name="alturaCm"
              rules={[
                { required: true, message: "Informe a altura" },
                {
                  type: "number",
                  min: 2,
                  message: "Altura mínima é 2 cm",
                },
              ]}
            >
              <InputNumber min={2} max={80} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Serviço preferencial" name="servico">
          <Select options={serviceOptions} placeholder="Selecione a categoria" />
        </Form.Item>

        {companyQuery.isLoading ? (
          <Alert
            message="Carregando dados do remetente padrão..."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Space>
          <Button
            type="primary"
            htmlType="submit"
            loading={quoteMutation.isPending}
            variant="solid"
          >
            Cotar agora
          </Button>
          <Button
            onClick={() => form.resetFields()}
            variant="outlined"
          >
            Limpar
          </Button>
        </Space>
      </Form>

      <Modal
        open={Boolean(resultModal)}
        onCancel={() => setResultModal(null)}
        footer={null}
        title="Melhores opções para o envio"
      >
        {resultModal ? (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            {resultModal.resultados.map((result) => (
              <Card
                key={result.id}
                size="small"
                variant="outlined"
                title={`${result.name} · ${result.carrier}`}
                extra={
                  <Typography.Text strong>
                    {result.price.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </Typography.Text>
                }
              >
                <Typography.Text type="secondary">
                  Entrega em até {result.etaDays} dia(s) útil(eis) · previsão{" "}
                  {new Date(result.estimatedDelivery).toLocaleDateString("pt-BR")}
                </Typography.Text>
              </Card>
            ))}

            <Space style={{ justifyContent: "flex-end", width: "100%" }}>
              <Button
                onClick={() => {
                  setResultModal(null);
                  router.push("/cotacoes");
                }}
                variant="outlined"
              >
                Abrir em Cotar
              </Button>
              {resultModal.resultados[0] ? (
                <Button
                  type="primary"
                  variant="solid"
                  onClick={() =>
                    router.push(
                      `/etiquetas?cotacaoId=${resultModal.id}&serviceCode=${resultModal.resultados[0].serviceCode}`,
                    )
                  }
                >
                  Gerar etiqueta
                </Button>
              ) : null}
            </Space>
          </Space>
        ) : null}
      </Modal>
    </Card>
  );
}
