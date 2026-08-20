'use client';

import { useState, startTransition, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Tabs,
  Alert,
  Spin,
  Divider,
  Tag,
  InputNumber,
  Radio,
  Select,
  message,
  Badge,
  Row,
  Col,
} from 'antd';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/shared/utils/format';
import {
  SaveOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
  ExperimentOutlined,
  CloudOutlined,
  SendOutlined,
  DownloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface EnvironmentCredentials {
  customerCode: string;
  password: string;
  apiAccount: string;
  privateKey: string;
  passwordDecryptionFailed?: boolean;
  privateKeyDecryptionFailed?: boolean;
  configured: boolean;
}

interface JTConfig {
  configured: boolean;
  activeEnvironment: 'sandbox' | 'production';
  production: EnvironmentCredentials;
  sandbox: EnvironmentCredentials;
  shippingCommissionPercent?: number | null;
  insuranceCommissionPercent?: number | null;
  carrierIconPath?: string | null;
  status?: string;
  lastUpdated?: string;
}

interface TestResult {
  success: boolean;
  type: string;
  message: string;
  result?: unknown;
  latencyMs?: number;
  jtApiResponse?: unknown;
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<JTConfig> {
  const res = await fetch('/api/admin/integrations/jt?reveal=true');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: Record<string, unknown>): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/jt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || err.message || 'Erro ao salvar');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function runTest(data: Record<string, unknown>): Promise<TestResult> {
  const res = await fetch('/api/admin/integrations/jt/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.data ?? json;
}

// ============================================================================
// Helper Components
// ============================================================================

function EnvironmentBadge({ environment, configured }: { environment: 'sandbox' | 'production'; configured: boolean }) {
  if (!configured) return <Tag color="default">Não configurado</Tag>;
  return environment === 'production'
    ? <Tag color="green">Produção</Tag>
    : <Tag color="orange">Homologação</Tag>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function JTClient() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('config');

  // Fetch config
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['jt-config'],
    queryFn: fetchConfig,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: (data) => {
      message.success(data.message || 'Configuração salva com sucesso');
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['jt-config'] });
      });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao salvar configuração');
    },
  });

  // Handle save
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const payload = {
        activeEnvironment: values.activeEnvironment,
        production: {
          customerCode: values.prod_customerCode,
          password: values.prod_password,
          apiAccount: values.prod_apiAccount,
          privateKey: values.prod_privateKey,
        },
        sandbox: {
          customerCode: values.sandbox_customerCode,
          password: values.sandbox_password,
          apiAccount: values.sandbox_apiAccount,
          privateKey: values.sandbox_privateKey,
        },
        shippingCommissionPercent: values.shippingCommissionPercent,
        insuranceCommissionPercent: values.insuranceCommissionPercent,
        carrierIconPath: values.carrierIconPath,
      };

      saveMutation.mutate(payload);
    } catch {
      message.error('Preencha os campos obrigatórios');
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <p>Carregando configuração...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="Erro ao carregar configuração" description={String(error)} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={3} style={{ margin: 0 }}>J&T Express</Title>
            {config?.configured
              ? <Badge status="success" text="Configurado" />
              : <Badge status="default" text="Não configurado" />}
          </Space>
          <EnvironmentBadge
            environment={config?.activeEnvironment || 'sandbox'}
            configured={config?.configured || false}
          />
        </div>

        {/* Tabs */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'config',
              label: <span><CloudOutlined /> Configuração</span>,
              children: <ConfigTab config={config} form={form} onSave={handleSave} saving={saveMutation.isPending} />,
            },
            {
              key: 'auth-test',
              label: <span><ApiOutlined /> Teste de Autenticação</span>,
              children: <AuthTestTab />,
            },
            {
              key: 'quote-test',
              label: <span><SearchOutlined /> Teste de Cotação</span>,
              children: <QuoteTestTab />,
            },
            {
              key: 'order-test',
              label: <span><ExperimentOutlined /> Teste de Pedido</span>,
              children: <OrderTestTab />,
            },
          ]}
        />
      </Space>
    </div>
  );
}

// ============================================================================
// Config Tab
// ============================================================================

function ConfigTab({ config, form, onSave, saving }: {
  config: JTConfig | undefined;
  form: ReturnType<typeof Form.useForm>[0];
  onSave: () => void;
  saving: boolean;
}) {
  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        activeEnvironment: config.activeEnvironment || 'sandbox',
        carrierIconPath: config.carrierIconPath || '',
        shippingCommissionPercent: config.shippingCommissionPercent ?? null,
        insuranceCommissionPercent: config.insuranceCommissionPercent ?? null,
        prod_customerCode: config.production?.customerCode || '',
        prod_password: config.production?.password || '',
        prod_apiAccount: config.production?.apiAccount || '',
        prod_privateKey: config.production?.privateKey || '',
        sandbox_customerCode: config.sandbox?.customerCode || '',
        sandbox_password: config.sandbox?.password || '',
        sandbox_apiAccount: config.sandbox?.apiAccount || '',
        sandbox_privateKey: config.sandbox?.privateKey || '',
      });
    }
  }, [config, form]);

  return (
    <Form
      form={form}
      layout="vertical"
    >
      {/* Ícone */}
      <Form.Item label="URL do ícone da transportadora" name="carrierIconPath">
        <Input placeholder="https://www.jtexpress.com.br/newassets/images/logo.png" />
      </Form.Item>

      {/* Comissão */}
      <Space align="start" wrap>
        <Form.Item label="Comissão sobre frete (%)" name="shippingCommissionPercent">
          <InputNumber
            min={0}
            max={100}
            precision={2}
            formatter={inputNumberFormatterBRL}
            parser={inputNumberParserBRL}
            style={{ width: 200 }}
            placeholder="Ex: 10.00"
          />
        </Form.Item>
        <Form.Item
          label="Comissão sobre seguro (%)"
          name="insuranceCommissionPercent"
          help="Somado sobre o valor declarado pelo cliente"
        >
          <InputNumber
            min={0}
            max={100}
            precision={2}
            formatter={inputNumberFormatterBRL}
            parser={inputNumberParserBRL}
            style={{ width: 200 }}
            placeholder="Ex: 1.00"
          />
        </Form.Item>
      </Space>

      {/* Ambiente ativo */}
      <Form.Item label="Ambiente ativo" name="activeEnvironment">
        <Radio.Group>
          <Radio value="sandbox">Homologação (Sandbox)</Radio>
          <Radio value="production">Produção</Radio>
        </Radio.Group>
      </Form.Item>

      <Divider />

      {/* Credenciais Sandbox */}
      <Card
        title={<><Tag color="orange">Homologação</Tag> Credenciais Sandbox</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {(config?.sandbox?.passwordDecryptionFailed || config?.sandbox?.privateKeyDecryptionFailed) && (
          <Alert
            type="error"
            icon={<WarningOutlined />}
            message="Erro ao descriptografar credenciais"
            description="Uma ou mais credenciais armazenadas não puderam ser descriptografadas. A ENCRYPTION_KEY do servidor pode ter mudado. Insira os valores novamente para corrigir."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item label="Customer Code" name="sandbox_customerCode">
          <Input placeholder="Ex: J0086032240" />
        </Form.Item>
        <Form.Item label="Senha" name="sandbox_password">
          <Input.Password placeholder="Senha fornecida pela J&T" />
        </Form.Item>
        <Form.Item label="API Account" name="sandbox_apiAccount">
          <Input placeholder="Ex: 628237137522720788" />
        </Form.Item>
        <Form.Item label="Private Key" name="sandbox_privateKey">
          <Input.Password placeholder="Chave privada fornecida pela J&T" />
        </Form.Item>
      </Card>

      {/* Credenciais Produção */}
      <Card
        title={<><Tag color="green">Produção</Tag> Credenciais de Produção</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {(config?.production?.passwordDecryptionFailed || config?.production?.privateKeyDecryptionFailed) && (
          <Alert
            type="error"
            icon={<WarningOutlined />}
            message="Erro ao descriptografar credenciais"
            description="Uma ou mais credenciais armazenadas não puderam ser descriptografadas. A ENCRYPTION_KEY do servidor pode ter mudado. Insira os valores novamente para corrigir."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item label="Customer Code" name="prod_customerCode">
          <Input placeholder="Ex: J0086032240" />
        </Form.Item>
        <Form.Item label="Senha" name="prod_password">
          <Input.Password placeholder="Senha fornecida pela J&T" />
        </Form.Item>
        <Form.Item label="API Account" name="prod_apiAccount">
          <Input placeholder="Ex: 628237137522720788" />
        </Form.Item>
        <Form.Item label="Private Key" name="prod_privateKey">
          <Input.Password placeholder="Chave privada fornecida pela J&T" />
        </Form.Item>
      </Card>

      {/* Botão Salvar */}
      <Form.Item>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={onSave}
          loading={saving}
          size="large"
        >
          Salvar Configuração
        </Button>
      </Form.Item>
    </Form>
  );
}

// ============================================================================
// Auth Test Tab
// ============================================================================

function AuthTestTab() {
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await runTest({ type: 'auth' });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        type: 'auth',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    }
    setTesting(false);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Text>
        Testa a geração de assinaturas (digest) da J&T com as credenciais configuradas.
      </Text>

      <Button
        type="primary"
        icon={<ApiOutlined />}
        onClick={handleTest}
        loading={testing}
      >
        Testar Autenticação
      </Button>

      {testResult && (
        <Alert
          type={testResult.success ? 'success' : 'error'}
          icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={testResult.success ? 'Autenticação OK' : 'Falha na Autenticação'}
          description={
            <Space direction="vertical">
              <Text>{testResult.message}</Text>
              {testResult.latencyMs && <Text type="secondary">Latência: {testResult.latencyMs}ms</Text>}
              {!!testResult.result && (
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(testResult.result, null, 2)}
                </pre>
              )}
            </Space>
          }
          showIcon
        />
      )}
    </Space>
  );
}

// ============================================================================
// Quote Test Tab
// ============================================================================

function QuoteTestTab() {
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);

      const result = await runTest({
        type: 'quote',
        cepOrigem: values.cepOrigem,
        cepDestino: values.cepDestino,
        pesoKg: values.pesoKg,
        valorDeclarado: values.valorDeclarado,
        goodsTypeCode: values.goodsTypeCode,
      });
      setTestResult(result);
    } catch (err) {
      if (err instanceof Error) {
        setTestResult({
          success: false,
          type: 'quote',
          message: err.message,
        });
      }
    }
    setTesting(false);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Text>
        Testa a cotação de preço e prazo usando a API da J&T com as credenciais configuradas.
      </Text>

      <Form form={form} layout="vertical" initialValues={{ pesoKg: 1, cepOrigem: '80030-000' }}>
        <Row gutter={12}>
          <Col span={5}>
            <Form.Item label="CEP Origem" name="cepOrigem">
              <Input placeholder="01310-100" />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item
              label="CEP Destino"
              name="cepDestino"
              rules={[{ required: true, message: 'Obrigatório' }]}
            >
              <Input placeholder="20040-020" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item
              label="Peso (kg)"
              name="pesoKg"
              rules={[{ required: true, message: 'Obrigatório' }]}
            >
              <InputNumber min={0.01} max={30} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item label="Valor declarado (R$)" name="valorDeclarado">
              <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item label="Tipo de mercadoria" name="goodsTypeCode">
              <Select options={GOODS_TYPE_OPTIONS} allowClear placeholder="Opcional" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleTest}
            loading={testing}
          >
            Testar Cotação
          </Button>
        </Form.Item>
      </Form>

      {testResult && (
        <Alert
          type={testResult.success ? 'success' : 'error'}
          icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={testResult.success ? 'Cotação Realizada' : 'Falha na Cotação'}
          description={
            <Space direction="vertical">
              <Text>{testResult.message}</Text>
              {testResult.latencyMs && <Text type="secondary">Latência: {testResult.latencyMs}ms</Text>}
              {!!testResult.result && (
                <Card size="small" style={{ marginTop: 8 }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {JSON.stringify(testResult.result, null, 2)}
                  </pre>
                </Card>
              )}
              {!!testResult.jtApiResponse && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary">Resposta bruta da API:</Text>
                  <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(testResult.jtApiResponse, null, 2)}
                  </pre>
                </>
              )}
            </Space>
          }
          showIcon
        />
      )}
    </Space>
  );
}

// ============================================================================
// Order Test Tab
// ============================================================================

const GOODS_TYPE_OPTIONS = [
  { value: 'bm000001', label: 'Documentos' },
  { value: 'bm000002', label: 'Eletrônicos' },
  { value: 'bm000003', label: 'Uso doméstico' },
  { value: 'bm000004', label: 'Alimentos' },
  { value: 'bm000005', label: 'Vestuário' },
  { value: 'bm000006', label: 'Outros' },
  { value: 'bm000007', label: 'Perecíveis' },
  { value: 'bm000008', label: 'Frágeis' },
  { value: 'bm000009', label: 'Líquidos' },
];

interface OrderResult {
  success: boolean;
  type: string;
  message: string;
  result?: {
    txlogisticId?: string;
    billCode?: string;
    orderLatencyMs?: number;
    hasLabel?: boolean;
    labelLatencyMs?: number;
    labelBase64?: string;
  };
  latencyMs?: number;
  jtApiResponse?: unknown;
}

function OrderTestTab() {
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<OrderResult | null>(null);
  const [testing, setTesting] = useState(false);

  const handleCreateOrder = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);

      const result = await runTest({
        type: 'order',
        orderData: {
          sender: {
            name: values.sender_name,
            company: values.sender_company || undefined,
            postCode: values.sender_postCode.replace(/\D/g, ''),
            taxNumber: values.sender_taxNumber?.replace(/\D/g, '') || undefined,
            mobile: values.sender_mobile?.replace(/\D/g, '') || undefined,
            phone: values.sender_mobile?.replace(/\D/g, '') || undefined,
            mailBox: values.sender_email || undefined,
            prov: values.sender_prov,
            city: values.sender_city,
            street: values.sender_street,
            streetNumber: values.sender_streetNumber || undefined,
            address: values.sender_address || 'SEM COMPLEMENTO',
            area: values.sender_area || undefined,
            areaCode: values.sender_mobile?.replace(/\D/g, '').substring(0, 2) || undefined,
            ieNumber: values.sender_ieNumber || '131740832976',
          },
          receiver: {
            name: values.receiver_name,
            company: values.receiver_company || undefined,
            postCode: values.receiver_postCode.replace(/\D/g, ''),
            taxNumber: values.receiver_taxNumber?.replace(/\D/g, '') || undefined,
            mobile: values.receiver_mobile?.replace(/\D/g, '') || undefined,
            phone: values.receiver_mobile?.replace(/\D/g, '') || undefined,
            mailBox: values.receiver_email || undefined,
            prov: values.receiver_prov,
            city: values.receiver_city,
            street: values.receiver_street,
            streetNumber: values.receiver_streetNumber || undefined,
            address: values.receiver_address || 'SEM COMPLEMENTO',
            area: values.receiver_area || undefined,
            areaCode: values.receiver_mobile?.replace(/\D/g, '').substring(0, 2) || undefined,
            ieNumber: values.receiver_ieNumber || '0000000',
          },
          weight: values.weight,
          height: values.height || undefined,
          width: values.width || undefined,
          length: values.length || undefined,
          goodsType: values.goodsType || 'bm000006',
          itemName: values.itemName || 'Mercadoria teste',
          itemQuantity: values.itemQuantity || 1,
          invoiceNumber: values.invoiceNumber || '000000001',
          invoiceSerialNumber: values.invoiceSerialNumber || '001',
          invoiceMoney: values.invoiceMoney || '50.00',
          invoiceAccessKey: values.invoiceAccessKey || '00000000000000000000000000000000000000000000',
          taxCode: values.taxCode || '00000000000000',
        },
      }) as OrderResult;

      setTestResult(result);
    } catch (err) {
      if (err instanceof Error) {
        setTestResult({
          success: false,
          type: 'order',
          message: err.message,
        });
      }
    }
    setTesting(false);
  };

  const handleDownloadLabel = () => {
    const base64 = testResult?.result?.labelBase64;
    if (!base64) return;

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Text>
        Testa a criação de pedido na API da J&T. Se o pedido for criado com sucesso,
        a etiqueta será gerada automaticamente.
      </Text>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          sender_name: 'Empresa Teste',
          sender_company: 'Empresa Teste LTDA',
          sender_postCode: '01310-100',
          sender_taxNumber: '00000000000191',
          sender_mobile: '11999999999',
          sender_email: 'teste@teste.com',
          sender_prov: 'SP',
          sender_city: 'SAO PAULO',
          sender_street: 'AVENIDA PAULISTA',
          sender_streetNumber: '1000',
          sender_address: 'SALA 1',
          sender_area: 'BELA VISTA',
          sender_ieNumber: '131740832976',
          weight: 1,
          goodsType: 'bm000006',
          itemName: 'Mercadoria teste',
          itemQuantity: 1,
          invoiceNumber: '000000001',
          invoiceSerialNumber: '001',
          invoiceMoney: '50.00',
          invoiceAccessKey: '00000000000000000000000000000000000000000000',
          taxCode: '00000000000000',
        }}
      >
        {/* Remetente */}
        <Card
          title={<><Tag color="blue">Remetente</Tag> Dados do remetente (pré-preenchido)</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Nome" name="sender_name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Empresa" name="sender_company">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="CEP" name="sender_postCode" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="UF" name="sender_prov" rules={[{ required: true }]}>
                <Input maxLength={2} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cidade" name="sender_city" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Rua" name="sender_street" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Número" name="sender_streetNumber">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Complemento" name="sender_address">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Bairro" name="sender_area">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="CPF/CNPJ" name="sender_taxNumber">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Telefone" name="sender_mobile">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="E-mail" name="sender_email">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Inscrição Estadual" name="sender_ieNumber">
                <Input placeholder="0000000 ou ISENTO" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Destinatário */}
        <Card
          title={<><Tag color="green">Destinatário</Tag> Dados do destinatário</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Nome" name="receiver_name" rules={[{ required: true }]}>
                <Input placeholder="Nome do destinatário" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Empresa" name="receiver_company">
                <Input placeholder="(opcional)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="CEP" name="receiver_postCode" rules={[{ required: true }]}>
                <Input placeholder="00000-000" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="UF" name="receiver_prov" rules={[{ required: true }]}>
                <Input maxLength={2} placeholder="UF" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Cidade" name="receiver_city" rules={[{ required: true }]}>
                <Input placeholder="Cidade" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Rua" name="receiver_street" rules={[{ required: true }]}>
                <Input placeholder="Rua/Avenida" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Número" name="receiver_streetNumber">
                <Input placeholder="Nº" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Complemento" name="receiver_address">
                <Input placeholder="Apto, sala..." />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Bairro" name="receiver_area">
                <Input placeholder="Bairro" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="CPF/CNPJ" name="receiver_taxNumber">
                <Input placeholder="Somente números" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Telefone" name="receiver_mobile">
                <Input placeholder="11999999999" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="E-mail" name="receiver_email">
                <Input placeholder="email@destino.com" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Inscrição Estadual" name="receiver_ieNumber">
                <Input placeholder="0000000 ou ISENTO" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Pacote */}
        <Card
          title={<><Tag color="purple">Pacote</Tag> Dados do envio</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="Peso (kg)" name="weight" rules={[{ required: true }]}>
                <InputNumber min={0.01} max={30} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Altura (cm)" name="height">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Largura (cm)" name="width">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Comprimento (cm)" name="length">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Tipo de mercadoria" name="goodsType">
                <Select options={GOODS_TYPE_OPTIONS} />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item label="Nome do item" name="itemName">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Quantidade" name="itemQuantity">
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Nota Fiscal */}
        <Card
          title={<><Tag color="orange">NF</Tag> Dados da Nota Fiscal (obrigatórios pela J&T)</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="Nº NF" name="invoiceNumber">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Série" name="invoiceSerialNumber">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Valor (R$)" name="invoiceMoney">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="CFOP / Código Fiscal" name="taxCode">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item label="Chave de Acesso NF-e (44 dígitos)" name="invoiceAccessKey">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Botão */}
        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleCreateOrder}
              loading={testing}
              size="large"
            >
              Criar Pedido de Teste
            </Button>
            {testResult?.result?.hasLabel && (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadLabel}
                size="large"
              >
                Baixar Etiqueta (PDF)
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      {/* Resultado */}
      {testResult && (
        <Alert
          type={testResult.success ? 'success' : 'error'}
          icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={testResult.success ? 'Pedido Criado' : 'Falha na Criação'}
          description={
            <Space direction="vertical">
              <Text>{testResult.message}</Text>
              {testResult.latencyMs != null && (
                <Text type="secondary">Latência total: {testResult.latencyMs}ms</Text>
              )}
              {!!testResult.result && (
                <Card size="small" style={{ marginTop: 8 }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {JSON.stringify({
                      txlogisticId: testResult.result.txlogisticId,
                      billCode: testResult.result.billCode,
                      orderLatencyMs: testResult.result.orderLatencyMs,
                      hasLabel: testResult.result.hasLabel,
                      labelLatencyMs: testResult.result.labelLatencyMs,
                    }, null, 2)}
                  </pre>
                </Card>
              )}
              {!!testResult.jtApiResponse && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary">Resposta bruta da API:</Text>
                  <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(testResult.jtApiResponse, null, 2)}
                  </pre>
                </>
              )}
            </Space>
          }
          showIcon
        />
      )}
    </Space>
  );
}
