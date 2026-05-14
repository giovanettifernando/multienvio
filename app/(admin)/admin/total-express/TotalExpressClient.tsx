// app/(admin)/admin/total-express/TotalExpressClient.tsx
'use client';

import { useState, startTransition, useEffect } from 'react';
import {
  Card, Form, Input, Button, Space, Typography, Tabs, Alert, Spin,
  Divider, Tag, InputNumber, Radio, message, Badge, Row, Col,
} from 'antd';
import { inputNumberFormatterBRL, inputNumberParserBRL } from '@/shared/utils/format';
import {
  SaveOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SearchOutlined, ExperimentOutlined, CloudOutlined, SendOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface EnvironmentCredentials {
  username: string;
  password: string;
  remetenteId: string;
  cnpj: string;
  passwordDecryptionFailed?: boolean;
  configured: boolean;
}

interface TEConfig {
  configured: boolean;
  activeEnvironment: 'sandbox' | 'production';
  production: EnvironmentCredentials;
  sandbox: EnvironmentCredentials;
  shippingCommissionPercent?: number | null;
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
  error?: unknown;
}

// ============================================================================
// API calls
// ============================================================================

async function fetchConfig(): Promise<TEConfig> {
  const res = await fetch('/api/admin/integrations/total-express?reveal=true');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: Record<string, unknown>): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/total-express', {
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
  const res = await fetch('/api/admin/integrations/total-express/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.data ?? json;
}

// ============================================================================
// Helper component
// ============================================================================

function EnvironmentBadge({ environment, configured }: { environment: 'sandbox' | 'production'; configured: boolean }) {
  if (!configured) return <Tag color="default">Não configurado</Tag>;
  return environment === 'production'
    ? <Tag color="green">Produção</Tag>
    : <Tag color="orange">Homologação</Tag>;
}

// ============================================================================
// Main component
// ============================================================================

export default function TotalExpressClient() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('config');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [quoteForm] = Form.useForm();
  const [trackingForm] = Form.useForm();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['te-config'],
    queryFn: fetchConfig,
  });

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: (data) => {
      message.success(data.message || 'Configuração salva com sucesso');
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['te-config'] });
      });
    },
    onError: (err: Error) => {
      message.error(err.message || 'Erro ao salvar configuração');
    },
  });

  useEffect(() => {
    if (config) {
      form.setFieldsValue({
        activeEnvironment: config.activeEnvironment,
        shippingCommissionPercent: config.shippingCommissionPercent ?? undefined,
        carrierIconPath: config.carrierIconPath ?? undefined,
        prod_username: config.production?.username,
        prod_password: config.production?.password,
        prod_remetenteId: config.production?.remetenteId,
        prod_cnpj: config.production?.cnpj,
        sandbox_username: config.sandbox?.username,
        sandbox_password: config.sandbox?.password,
        sandbox_remetenteId: config.sandbox?.remetenteId,
        sandbox_cnpj: config.sandbox?.cnpj,
      });
    }
  }, [config, form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      saveMutation.mutate({
        activeEnvironment: values.activeEnvironment,
        production: {
          username: values.prod_username,
          password: values.prod_password,
          remetenteId: values.prod_remetenteId,
          cnpj: values.prod_cnpj,
        },
        sandbox: {
          username: values.sandbox_username,
          password: values.sandbox_password,
          remetenteId: values.sandbox_remetenteId,
          cnpj: values.sandbox_cnpj,
        },
        shippingCommissionPercent: values.shippingCommissionPercent,
        carrierIconPath: values.carrierIconPath,
      });
    } catch {
      message.error('Preencha os campos obrigatórios');
    }
  };

  const handleTest = async (type: string, payload?: Record<string, unknown>) => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await runTest({ type, ...payload });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        type,
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (isLoading) {
    return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /><p>Carregando...</p></div>;
  }

  if (error) {
    return <div style={{ padding: 24 }}><Alert type="error" message="Erro ao carregar configuração" description={String(error)} /></div>;
  }

  const tabs = [
    {
      key: 'config',
      label: <span><ApiOutlined /> Configuração</span>,
      children: (
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="activeEnvironment" label="Ambiente ativo">
                <Radio.Group>
                  <Radio value="production">Produção</Radio>
                  <Radio value="sandbox">Homologação</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>

          <Divider>Produção <EnvironmentBadge environment="production" configured={config?.production?.configured ?? false} /></Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="prod_username" label="Usuário">
                <Input placeholder="usuário da Total Express" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prod_password" label="Senha">
                <Input.Password placeholder="senha" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prod_remetenteId" label="Remetente ID">
                <Input placeholder="ID do remetente cadastrado" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="prod_cnpj" label="CNPJ">
                <Input placeholder="00.000.000/0000-00" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Homologação <EnvironmentBadge environment="sandbox" configured={config?.sandbox?.configured ?? false} /></Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="sandbox_username" label="Usuário">
                <Input placeholder="usuário de homologação" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sandbox_password" label="Senha">
                <Input.Password placeholder="senha de homologação" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sandbox_remetenteId" label="Remetente ID">
                <Input placeholder="ID do remetente (homologação)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sandbox_cnpj" label="CNPJ">
                <Input placeholder="00.000.000/0000-00" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>Financeiro</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="shippingCommissionPercent" label="Comissão de frete (%)">
                <InputNumber
                  min={0} max={100} step={0.1}
                  formatter={inputNumberFormatterBRL}
                  parser={inputNumberParserBRL}
                  style={{ width: '100%' }}
                  placeholder="0.00"
                />
              </Form.Item>
            </Col>
          </Row>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            onClick={handleSave}
          >
            Salvar configuração
          </Button>
        </Form>
      ),
    },
    {
      key: 'test-auth',
      label: <span><ExperimentOutlined /> Teste Auth</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            Testa autenticação Basic Auth + uma chamada SOAP de cotação para verificar as credenciais.
          </Text>
          <Button
            type="primary"
            icon={<CloudOutlined />}
            loading={testLoading}
            onClick={() => handleTest('auth')}
          >
            Testar autenticação
          </Button>
          {testResult && testResult.type === 'auth' && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              message={testResult.success ? 'Autenticação OK' : 'Falha na autenticação'}
              description={
                <Space direction="vertical">
                  <Text>{testResult.message}</Text>
                  {testResult.latencyMs && <Text type="secondary">Latência: {testResult.latencyMs}ms</Text>}
                  {!testResult.success && !!testResult.error && (
                    <pre style={{ fontSize: 12, maxHeight: 200, overflow: 'auto' }}>
                      {JSON.stringify(testResult.error, null, 2)}
                    </pre>
                  )}
                </Space>
              }
              showIcon
            />
          )}
        </Space>
      ),
    },
    {
      key: 'test-quote',
      label: <span><SearchOutlined /> Teste Cotação</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form form={quoteForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="cepOrigem" label="CEP Origem" rules={[{ required: true }]}>
                  <Input placeholder="01310-100" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="cepDestino" label="CEP Destino" rules={[{ required: true }]}>
                  <Input placeholder="20040-020" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="pesoKg" label="Peso (kg)" rules={[{ required: true }]}>
                  <InputNumber min={0.01} max={30} step={0.1} style={{ width: '100%' }} placeholder="1.0" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="comprimentoCm" label="Comprimento (cm)">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="20" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="larguraCm" label="Largura (cm)">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="15" />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item name="alturaCm" label="Altura (cm)">
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="10" />
                </Form.Item>
              </Col>
            </Row>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={testLoading}
              onClick={async () => {
                const values = await quoteForm.validateFields();
                handleTest('quote', {
                  cepOrigem: values.cepOrigem,
                  cepDestino: values.cepDestino,
                  pesoKg: values.pesoKg,
                  comprimentoCm: values.comprimentoCm || 20,
                  larguraCm: values.larguraCm || 15,
                  alturaCm: values.alturaCm || 10,
                });
              }}
            >
              Cotar frete
            </Button>
          </Form>
          {testResult && testResult.type === 'quote' && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              description={
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(testResult.result, null, 2)}
                </pre>
              }
              showIcon
            />
          )}
        </Space>
      ),
    },
    {
      key: 'test-tracking',
      label: <span><SendOutlined /> Rastreamento</span>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form form={trackingForm} layout="vertical">
            <Form.Item name="awb" label="AWB" rules={[{ required: true }]}>
              <Input placeholder="Código AWB da Total Express" />
            </Form.Item>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              loading={testLoading}
              onClick={async () => {
                const values = await trackingForm.validateFields();
                handleTest('tracking', { awb: values.awb });
              }}
            >
              Rastrear
            </Button>
          </Form>
          {testResult && testResult.type === 'tracking' && (
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              description={
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto' }}>
                  {JSON.stringify(testResult.result, null, 2)}
                </pre>
              }
              showIcon
            />
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Total Express</Title>
            <Text type="secondary">Configuração da integração Total Express</Text>
          </div>
          <Space>
            {config?.configured
              ? <Badge status="success" text="Configurado" />
              : <Badge status="default" text="Não configurado" />}
            {config?.status && (
              <Tag color={config.status === 'ACTIVE' ? 'green' : 'red'}>
                {config.status}
              </Tag>
            )}
          </Space>
        </div>

        {config?.production?.passwordDecryptionFailed && (
          <Alert
            type="warning"
            icon={<WarningOutlined />}
            message="Falha ao descriptografar senha de produção — reconfigure as credenciais"
            showIcon
          />
        )}

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
        </Card>
      </Space>
    </div>
  );
}
