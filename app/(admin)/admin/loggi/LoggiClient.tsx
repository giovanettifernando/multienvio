'use client';

import { useState, useEffect, useRef, useCallback, startTransition, useMemo } from 'react';
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
  message,
  Badge,
  Row,
  Col,
  Progress,
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
  LoadingOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface EnvironmentCredentials {
  clientId: string;
  clientSecret: string;
  companyId: string;
  clientSecretDecryptionFailed?: boolean;
  configured: boolean;
}

interface LoggiConfig {
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
  loggiApiResponse?: unknown;
  error?: string;
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<LoggiConfig> {
  const res = await fetch('/api/admin/integrations/loggi?reveal=true');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: Record<string, unknown>): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/loggi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Erro ao salvar');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function runTest(data: Record<string, unknown>): Promise<TestResult> {
  const res = await fetch('/api/admin/integrations/loggi/test', {
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
    : <Tag color="orange">Staging</Tag>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function LoggiClient() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('config');
  const [resettingCB, setResettingCB] = useState(false);

  // Fetch config
  const { data: config, isLoading, error } = useQuery({
    queryKey: ['loggi-config'],
    queryFn: fetchConfig,
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: (data) => {
      message.success(data.message || 'Configuração salva com sucesso');
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey: ['loggi-config'] });
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
          clientId: values.prod_clientId,
          clientSecret: values.prod_clientSecret,
          companyId: values.prod_companyId,
        },
        sandbox: {
          clientId: values.sandbox_clientId,
          clientSecret: values.sandbox_clientSecret,
          companyId: values.sandbox_companyId,
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
            <Title level={3} style={{ margin: 0 }}>Loggi</Title>
            {config?.configured
              ? <Badge status="success" text="Configurado" />
              : <Badge status="default" text="Não configurado" />}
          </Space>
          <Space>
            <Button
              size="small"
              danger
              onClick={async () => {
                setResettingCB(true);
                try {
                  const result = await runTest({ type: 'reset-cb' });
                  message.success(result.message || 'Circuit breaker resetado');
                } catch {
                  message.error('Erro ao resetar circuit breaker');
                }
                setResettingCB(false);
              }}
              loading={resettingCB}
            >
              Reset Circuit Breaker
            </Button>
            <EnvironmentBadge
              environment={config?.activeEnvironment || 'sandbox'}
              configured={config?.configured || false}
            />
          </Space>
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
              key: 'shipment-test',
              label: <span><ExperimentOutlined /> Teste de Pedido</span>,
              children: <ShipmentTestTab />,
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
  config: LoggiConfig | undefined;
  form: ReturnType<typeof Form.useForm>[0];
  onSave: () => void;
  saving: boolean;
}) {
  const iconUrl = Form.useWatch('carrierIconPath', form);
  const [iconError, setIconError] = useState(false);

  const isValidUrl = useMemo(() => {
    if (!iconUrl || typeof iconUrl !== 'string') return false;
    try {
      const url = new URL(iconUrl);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  }, [iconUrl]);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        activeEnvironment: config?.activeEnvironment || 'sandbox',
        carrierIconPath: config?.carrierIconPath || '',
        shippingCommissionPercent: config?.shippingCommissionPercent ?? null,
        insuranceCommissionPercent: config?.insuranceCommissionPercent ?? null,
        prod_clientId: config?.production?.clientId || '',
        prod_clientSecret: config?.production?.clientSecret || '',
        prod_companyId: config?.production?.companyId || '',
        sandbox_clientId: config?.sandbox?.clientId || '',
        sandbox_clientSecret: config?.sandbox?.clientSecret || '',
        sandbox_companyId: config?.sandbox?.companyId || '',
      }}
    >
      {/* Ícone */}
      <Form.Item label="URL do ícone da transportadora" name="carrierIconPath">
        <Input
          placeholder="https://loggi.com/wp-content/uploads/2023/01/logo-loggi.png"
          onChange={() => setIconError(false)}
        />
      </Form.Item>
      {isValidUrl && !iconError && (
        <div style={{ marginTop: -16, marginBottom: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUrl}
            alt="Preview do ícone"
            onError={() => setIconError(true)}
            style={{
              maxHeight: 48,
              maxWidth: 200,
              objectFit: 'contain',
              border: '1px solid #d9d9d9',
              borderRadius: 4,
              padding: 4,
              background: '#fafafa',
            }}
          />
        </div>
      )}

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
          <Radio value="sandbox">Staging (Sandbox)</Radio>
          <Radio value="production">Produção</Radio>
        </Radio.Group>
      </Form.Item>

      <Divider />

      {/* Credenciais Sandbox */}
      <Card
        title={<><Tag color="orange">Staging</Tag> Credenciais Sandbox (stg.api.loggi.com)</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {config?.sandbox?.clientSecretDecryptionFailed && (
          <Alert
            type="error"
            icon={<WarningOutlined />}
            message="Erro ao descriptografar credenciais"
            description="O Client Secret armazenado não pôde ser descriptografado. A ENCRYPTION_KEY do servidor pode ter mudado. Insira o valor novamente para corrigir."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item label="Client ID" name="sandbox_clientId">
          <Input placeholder="Client ID fornecido pela Loggi" />
        </Form.Item>
        <Form.Item label="Client Secret" name="sandbox_clientSecret">
          <Input.Password placeholder="Client Secret fornecido pela Loggi" />
        </Form.Item>
        <Form.Item label="Company ID" name="sandbox_companyId">
          <Input placeholder="ID da empresa na Loggi" />
        </Form.Item>
      </Card>

      {/* Credenciais Produção */}
      <Card
        title={<><Tag color="green">Produção</Tag> Credenciais de Produção (api.loggi.com)</>}
        size="small"
        style={{ marginBottom: 16 }}
      >
        {config?.production?.clientSecretDecryptionFailed && (
          <Alert
            type="error"
            icon={<WarningOutlined />}
            message="Erro ao descriptografar credenciais"
            description="O Client Secret armazenado não pôde ser descriptografado. A ENCRYPTION_KEY do servidor pode ter mudado. Insira o valor novamente para corrigir."
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form.Item label="Client ID" name="prod_clientId">
          <Input placeholder="Client ID fornecido pela Loggi" />
        </Form.Item>
        <Form.Item label="Client Secret" name="prod_clientSecret">
          <Input.Password placeholder="Client Secret fornecido pela Loggi" />
        </Form.Item>
        <Form.Item label="Company ID" name="prod_companyId">
          <Input placeholder="ID da empresa na Loggi" />
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
        Testa a autenticação OAuth2 da Loggi. Obtém um token Bearer usando client_id e client_secret configurados.
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
              {testResult.latencyMs != null && <Text type="secondary">Latência: {testResult.latencyMs}ms</Text>}
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
        comprimentoCm: values.comprimentoCm,
        larguraCm: values.larguraCm,
        alturaCm: values.alturaCm,
        valorDeclaradoCentavos: values.valorDeclarado ? Math.round(values.valorDeclarado * 100) : undefined,
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
        Testa a cotação de preço e prazo usando a API da Loggi. Retorna opções Express e Econômico.
      </Text>

      <Form form={form} layout="vertical" initialValues={{
        pesoKg: 1,
        cepOrigem: '80030-000',
        comprimentoCm: 20,
        larguraCm: 15,
        alturaCm: 10,
      }}>
        <Row gutter={12}>
          <Col span={5}>
            <Form.Item
              label="CEP Origem"
              name="cepOrigem"
              rules={[{ required: true, message: 'Obrigatório' }]}
            >
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
          <Col span={5}>
            <Form.Item label="Valor declarado (R$)" name="valorDeclarado">
              <InputNumber min={0} step={10} style={{ width: '100%' }} placeholder="0.00" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={5}>
            <Form.Item label="Comprimento (cm)" name="comprimentoCm">
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item label="Largura (cm)" name="larguraCm">
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={5}>
            <Form.Item label="Altura (cm)" name="alturaCm">
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
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
              {testResult.latencyMs != null && <Text type="secondary">Latência: {testResult.latencyMs}ms</Text>}
              {!!testResult.result && (
                <Card size="small" style={{ marginTop: 8 }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {JSON.stringify(testResult.result, null, 2)}
                  </pre>
                </Card>
              )}
              {!!testResult.loggiApiResponse && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary">Resposta bruta da API:</Text>
                  <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(testResult.loggiApiResponse, null, 2)}
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
// Shipment Test Tab
// ============================================================================

interface ShipmentResult {
  success: boolean;
  type: string;
  message: string;
  result?: {
    externalServiceId?: string;
    loggiKey?: string;
    trackingCode?: string;
    shipmentLatencyMs?: number;
    hasLabel?: boolean;
    labelLatencyMs?: number;
    labelBase64?: string;
    quoteInfo?: {
      quotationsCount: number;
      quoteLatencyMs: number;
      selectedService: string;
    };
    apiErrorDetails?: unknown[];
  };
  latencyMs?: number;
  loggiApiResponse?: unknown;
}

const LABEL_POLL_INTERVAL_S = 20;
const LABEL_INITIAL_WAIT_S = 30;
const LABEL_MAX_ATTEMPTS = 10;

function ShipmentTestTab() {
  const [form] = Form.useForm();
  const [testResult, setTestResult] = useState<ShipmentResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Label polling state
  const [labelPolling, setLabelPolling] = useState(false);
  const [labelCountdown, setLabelCountdown] = useState(0);
  const [labelAttempt, setLabelAttempt] = useState(0);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelRawResponse, setLabelRawResponse] = useState<Record<string, unknown> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tracking state
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TestResult | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const tryFetchLabel = useCallback(async (loggiKey: string, trackingCode: string | undefined, attempt: number): Promise<boolean> => {
    setLabelAttempt(attempt);
    setLabelError(null);
    setLabelRawResponse(null);

    let trackingStatus = '';

    // Step 1: Check tracking (informational — does NOT block label attempt)
    if (trackingCode) {
      try {
        const trackResult = await runTest({ type: 'tracking', trackingCode }) as TestResult;
        if (trackResult.success) {
          const status = (trackResult.result as Record<string, unknown>)?.status as Record<string, unknown> | undefined;
          trackingStatus = status?.highLevelStatus
            ? `Tracking OK: ${status.highLevelStatus}`
            : 'Tracking OK (sem status)';
        } else {
          trackingStatus = `Tracking falhou: ${trackResult.message || 'erro'}`;
        }
      } catch {
        trackingStatus = 'Tracking: erro de conexao';
      }
    }

    // Step 2: Always try to generate label regardless of tracking result
    try {
      const result = await runTest({ type: 'label', loggiKey }) as TestResult;
      const rawInfo: Record<string, unknown> = {
        ...(result.loggiApiResponse ? { labelApi: result.loggiApiResponse } : { labelResult: result.result }),
      };
      if (trackingStatus) rawInfo.trackingStatus = trackingStatus;
      setLabelRawResponse(rawInfo);

      if (result.success && (result.result as Record<string, unknown>)?.labelBase64) {
        const labelBase64 = (result.result as Record<string, unknown>).labelBase64 as string;
        const labelLatencyMs = (result.result as Record<string, unknown>).labelLatencyMs as number | undefined;
        setTestResult((prev) => prev ? {
          ...prev,
          result: {
            ...prev.result,
            hasLabel: true,
            labelBase64,
            labelLatencyMs,
          },
        } : prev);
        message.success('Etiqueta gerada com sucesso!');
        return true;
      }
      const errorMsg = result.message || 'Etiqueta sem conteudo';
      setLabelError(trackingStatus ? `${errorMsg} | ${trackingStatus}` : errorMsg);
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setLabelError(trackingStatus ? `${msg} | ${trackingStatus}` : msg);
      return false;
    }
  }, []);

  const startLabelPolling = useCallback((loggiKey: string, trackingCode: string | undefined, initialWaitS: number) => {
    setLabelPolling(true);
    setLabelCountdown(initialWaitS);
    setLabelAttempt(0);
    setLabelError(null);

    // Countdown timer
    let remaining = initialWaitS;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      setLabelCountdown(remaining);
      if (remaining <= 0 && countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }, 1000);

    // Schedule first attempt after initial wait
    const poll = async (attempt: number) => {
      if (attempt > LABEL_MAX_ATTEMPTS) {
        setLabelPolling(false);
        setLabelError('Limite de tentativas atingido. No fluxo assincrono da Loggi, a etiqueta so fica disponivel apos webhook de confirmacao. Use "Verificar Status" para checar o estado do pacote.');
        return;
      }

      const success = await tryFetchLabel(loggiKey, trackingCode, attempt);
      if (success) {
        setLabelPolling(false);
        return;
      }

      // Schedule next attempt
      setLabelCountdown(LABEL_POLL_INTERVAL_S);
      let nextRemaining = LABEL_POLL_INTERVAL_S;
      countdownRef.current = setInterval(() => {
        nextRemaining -= 1;
        setLabelCountdown(nextRemaining);
        if (nextRemaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);

      pollingRef.current = setTimeout(() => poll(attempt + 1), LABEL_POLL_INTERVAL_S * 1000);
    };

    pollingRef.current = setTimeout(() => poll(1), initialWaitS * 1000);
  }, [tryFetchLabel]);

  const stopLabelPolling = useCallback(() => {
    setLabelPolling(false);
    if (pollingRef.current) { clearTimeout(pollingRef.current); pollingRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const handleCreateShipment = async () => {
    try {
      const values = await form.validateFields();
      setTesting(true);
      setTestResult(null);
      setTrackingResult(null);
      stopLabelPolling();
      setLabelRawResponse(null);

      const result = await runTest({
        type: 'shipment',
        shipmentData: {
          externalServiceId: values.externalServiceId || undefined,
          sender: {
            name: values.sender_name,
            phoneNumber: values.sender_phone?.replace(/\D/g, '') || '',
            federalTaxId: values.sender_taxId?.replace(/\D/g, '') || undefined,
            address: {
              logradouro: values.sender_logradouro,
              numero: values.sender_numero,
              complemento: values.sender_complemento || undefined,
              bairro: values.sender_bairro,
              cep: values.sender_cep?.replace(/\D/g, '') || '',
              cidade: values.sender_cidade,
              uf: values.sender_uf,
            },
          },
          receiver: {
            name: values.receiver_name,
            email: values.receiver_email || undefined,
            phoneNumber: values.receiver_phone?.replace(/\D/g, '') || '',
            federalTaxId: values.receiver_taxId?.replace(/\D/g, '') || undefined,
            address: {
              logradouro: values.receiver_logradouro,
              numero: values.receiver_numero,
              complemento: values.receiver_complemento || undefined,
              bairro: values.receiver_bairro,
              cep: values.receiver_cep?.replace(/\D/g, '') || '',
              cidade: values.receiver_cidade,
              uf: values.receiver_uf,
            },
          },
          freightType: values.freightType || 'FREIGHT_TYPE_ECONOMIC',
          weightG: Math.round((values.weightKg || 1) * 1000),
          lengthCm: values.lengthCm || 20,
          widthCm: values.widthCm || 15,
          heightCm: values.heightCm || 10,
          invoiceKey: values.invoiceKey || undefined,
          invoiceSeries: values.invoiceSeries || undefined,
          invoiceNumber: values.invoiceNumber || undefined,
          invoiceTotalValue: values.invoiceTotalValue || undefined,
          invoiceIcms: values.invoiceIcms || undefined,
        },
      }) as ShipmentResult;

      setTestResult(result);

      // Auto-start label polling if shipment was created successfully
      if (result.success && result.result?.loggiKey && !result.result?.hasLabel) {
        startLabelPolling(result.result.loggiKey, result.result.trackingCode, LABEL_INITIAL_WAIT_S);
      }
    } catch (err) {
      if (err instanceof Error) {
        setTestResult({
          success: false,
          type: 'shipment',
          message: err.message,
        });
      }
    }
    setTesting(false);
  };

  const handleCheckStatus = async () => {
    const trackingCode = testResult?.result?.trackingCode;
    if (!trackingCode) return;

    setCheckingStatus(true);
    setTrackingResult(null);
    try {
      const result = await runTest({ type: 'tracking', trackingCode });
      setTrackingResult(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erro ao verificar status');
    }
    setCheckingStatus(false);
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

  const handleManualRetryLabel = async () => {
    const loggiKey = testResult?.result?.loggiKey;
    if (!loggiKey) return;

    stopLabelPolling();
    setLabelPolling(true);
    const success = await tryFetchLabel(loggiKey, testResult?.result?.trackingCode, labelAttempt + 1);
    setLabelPolling(false);
  };

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        message="Fluxo assincrono"
        description="Na Loggi, envios sao criados de forma assincrona. A etiqueta so fica disponivel apos a Loggi processar o pacote (confirmacao via webhook). No teste, fazemos polling do tracking para verificar quando o pacote existe, e entao tentamos gerar a etiqueta."
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          sender_name: 'Empresa Teste',
          sender_phone: '11999999999',
          sender_taxId: '00000000000191',
          sender_logradouro: 'Avenida Paulista',
          sender_numero: '1000',
          sender_complemento: 'Sala 1',
          sender_bairro: 'Bela Vista',
          sender_cep: '01310-100',
          sender_cidade: 'Sao Paulo',
          sender_uf: 'SP',
          freightType: 'FREIGHT_TYPE_ECONOMIC',
          weightKg: 1,
          lengthCm: 20,
          widthCm: 15,
          heightCm: 10,
        }}
      >
        {/* Remetente */}
        <Card
          title={<><Tag color="blue">Remetente</Tag> Dados do remetente (pre-preenchido)</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Nome" name="sender_name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Telefone" name="sender_phone">
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="CPF/CNPJ" name="sender_taxId">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item label="Logradouro" name="sender_logradouro" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Numero" name="sender_numero" rules={[{ required: true }, { max: 8, message: 'Max 8 caracteres' }]}>
                <Input maxLength={8} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Complemento" name="sender_complemento">
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Bairro" name="sender_bairro" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="CEP" name="sender_cep" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Cidade" name="sender_cidade" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="UF" name="sender_uf" rules={[{ required: true }]}>
                <Input maxLength={2} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Destinatario */}
        <Card
          title={<><Tag color="green">Destinatario</Tag> Dados do destinatario</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={8}>
              <Form.Item label="Nome" name="receiver_name" rules={[{ required: true }]}>
                <Input placeholder="Nome do destinatario" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Telefone" name="receiver_phone" rules={[{ required: true }]}>
                <Input placeholder="11999999999" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="CPF/CNPJ" name="receiver_taxId">
                <Input placeholder="Somente numeros" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="E-mail" name="receiver_email">
                <Input placeholder="(opcional)" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item label="Logradouro" name="receiver_logradouro" rules={[{ required: true }]}>
                <Input placeholder="Rua/Avenida" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Numero" name="receiver_numero" rules={[{ required: true }, { max: 8, message: 'Max 8 caracteres' }]}>
                <Input maxLength={8} placeholder="N" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="Complemento" name="receiver_complemento">
                <Input placeholder="Apto, sala..." />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Bairro" name="receiver_bairro" rules={[{ required: true }]}>
                <Input placeholder="Bairro" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="CEP" name="receiver_cep" rules={[{ required: true }]}>
                <Input placeholder="00000-000" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Cidade" name="receiver_cidade" rules={[{ required: true }]}>
                <Input placeholder="Cidade" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="UF" name="receiver_uf" rules={[{ required: true }]}>
                <Input maxLength={2} placeholder="UF" />
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
            <Col span={10}>
              <Form.Item
                label="External Service ID (auto via cotacao)"
                name="externalServiceId"
                tooltip="Deixe vazio para obter automaticamente via cotacao"
              >
                <Input placeholder="(auto — obtido via cotacao)" />
              </Form.Item>
            </Col>
            <Col span={14}>
              <Form.Item label="Tipo de frete" name="freightType">
                <Radio.Group>
                  <Radio value="FREIGHT_TYPE_ECONOMIC">Economico</Radio>
                  <Radio value="FREIGHT_TYPE_EXPRESS">Expresso</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={4}>
              <Form.Item label="Peso (kg)" name="weightKg" rules={[{ required: true }]}>
                <InputNumber min={0.01} max={30} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Comprimento (cm)" name="lengthCm">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Largura (cm)" name="widthCm">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Altura (cm)" name="heightCm">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* NF (opcional) */}
        <Card
          title={<><Tag color="orange">NF</Tag> Dados da Nota Fiscal (opcional)</>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item label="Chave de Acesso NF-e (44 digitos)" name="invoiceKey">
                <Input placeholder="Chave de acesso da NF-e" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="Serie" name="invoiceSeries">
                <Input placeholder="001" />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item label="N NF" name="invoiceNumber">
                <Input placeholder="000001" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item label="Valor total (centavos)" name="invoiceTotalValue">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="5000" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item label="ICMS" name="invoiceIcms">
                <Input placeholder="00" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Botoes */}
        <Form.Item>
          <Space>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleCreateShipment}
              loading={testing}
              size="large"
            >
              Criar Shipment de Teste
            </Button>
            {testResult?.result?.hasLabel && (
              <Button
                icon={<DownloadOutlined />}
                onClick={handleDownloadLabel}
                size="large"
                type="primary"
                ghost
              >
                Baixar Etiqueta (PDF)
              </Button>
            )}
            {testResult?.success && testResult?.result?.loggiKey && !testResult?.result?.hasLabel && !labelPolling && (
              <Button
                icon={<ReloadOutlined />}
                onClick={handleManualRetryLabel}
                size="large"
              >
                Tentar Gerar Etiqueta
              </Button>
            )}
            {testResult?.success && testResult?.result?.trackingCode && (
              <Button
                icon={<SearchOutlined />}
                onClick={handleCheckStatus}
                loading={checkingStatus}
                size="large"
              >
                Verificar Status
              </Button>
            )}
          </Space>
        </Form.Item>
      </Form>

      {/* Label Polling Status */}
      {labelPolling && testResult?.success && !testResult?.result?.hasLabel && (
        <Alert
          type="info"
          icon={<LoadingOutlined />}
          message="Aguardando etiqueta..."
          description={
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text>
                Verificando tracking → gerando etiqueta. Tentativa {labelAttempt}/{LABEL_MAX_ATTEMPTS}.
              </Text>
              {labelCountdown > 0 && (
                <Space>
                  <Progress
                    type="circle"
                    size={40}
                    percent={Math.round((1 - labelCountdown / (labelAttempt === 0 ? LABEL_INITIAL_WAIT_S : LABEL_POLL_INTERVAL_S)) * 100)}
                    format={() => `${labelCountdown}s`}
                  />
                  <Text type="secondary">
                    {labelAttempt === 0
                      ? 'Aguardando processamento inicial...'
                      : `Proxima tentativa em ${labelCountdown}s...`}
                  </Text>
                </Space>
              )}
              {labelError && <Text type="warning">{labelError}</Text>}
              {labelRawResponse && (
                <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(labelRawResponse, null, 2)}
                </pre>
              )}
              <Button size="small" onClick={stopLabelPolling}>Cancelar polling</Button>
            </Space>
          }
          showIcon
        />
      )}

      {/* Label fetch error (when polling stopped) */}
      {!labelPolling && labelError && testResult?.success && !testResult?.result?.hasLabel && (
        <Alert
          type="warning"
          message="Etiqueta ainda nao disponivel"
          description={
            <Space direction="vertical">
              <Text>{labelError}</Text>
              <Text type="secondary">Tentativas realizadas: {labelAttempt}/{LABEL_MAX_ATTEMPTS}</Text>
              {labelRawResponse && (
                <>
                  <Text type="secondary">Resposta da API Loggi:</Text>
                  <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(labelRawResponse, null, 2)}
                  </pre>
                </>
              )}
            </Space>
          }
          showIcon
        />
      )}

      {/* Resultado */}
      {testResult && (
        <Alert
          type={testResult.success ? 'success' : 'error'}
          icon={testResult.success ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
          message={testResult.success ? 'Shipment Criado' : 'Falha na Criacao'}
          description={
            <Space direction="vertical">
              <Text>{testResult.message}</Text>
              {testResult.latencyMs != null && (
                <Text type="secondary">Latencia total: {testResult.latencyMs}ms</Text>
              )}
              {!!testResult.result && (
                <Card size="small" style={{ marginTop: 8 }}>
                  <pre style={{ fontSize: 12, margin: 0 }}>
                    {JSON.stringify({
                      externalServiceId: testResult.result.externalServiceId,
                      loggiKey: testResult.result.loggiKey,
                      trackingCode: testResult.result.trackingCode,
                      shipmentLatencyMs: testResult.result.shipmentLatencyMs,
                      hasLabel: testResult.result.hasLabel,
                      labelLatencyMs: testResult.result.labelLatencyMs,
                      quoteInfo: testResult.result.quoteInfo,
                      apiErrorDetails: testResult.result.apiErrorDetails,
                    }, null, 2)}
                  </pre>
                </Card>
              )}
              {!!testResult.loggiApiResponse && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary">Resposta bruta da API:</Text>
                  <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(testResult.loggiApiResponse, null, 2)}
                  </pre>
                </>
              )}
            </Space>
          }
          showIcon
        />
      )}

      {trackingResult && (
        <Alert
          type={trackingResult.success ? 'info' : 'error'}
          message={trackingResult.success ? 'Status do Rastreamento' : 'Falha no Rastreamento'}
          description={
            <Space direction="vertical">
              <Text>{trackingResult.message}</Text>
              {trackingResult.latencyMs != null && <Text type="secondary">Latencia: {trackingResult.latencyMs}ms</Text>}
              {!!trackingResult.result && (
                <pre style={{ fontSize: 12, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(trackingResult.result, null, 2)}
                </pre>
              )}
              {!!trackingResult.loggiApiResponse && (
                <>
                  <Divider style={{ margin: '8px 0' }} />
                  <Text type="secondary">Resposta bruta:</Text>
                  <pre style={{ fontSize: 11, maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                    {JSON.stringify(trackingResult.loggiApiResponse, null, 2)}
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
