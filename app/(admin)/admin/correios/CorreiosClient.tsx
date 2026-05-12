'use client';

import { useState, useEffect, useRef, startTransition } from 'react';
import Image from 'next/image';
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
  Collapse,
  Radio,
  message,
  Badge,
} from 'antd';
import { inputNumberFormatterBRL, inputNumberParserBRL, formatBRL } from '@/shared/utils/format';
import {
  SaveOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  SearchOutlined,
  FileTextOutlined,
  ExperimentOutlined,
  CloudOutlined,
  DownloadOutlined,
  PictureOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface EnvironmentCredentials {
  username: string;
  password: string;
  cartaoPostagem: string;
  contrato?: string;
  dr?: string;
  apiKey?: string;
  passwordDecryptionFailed?: boolean;
  configured: boolean;
}

interface CorreiosConfig {
  configured: boolean;
  activeEnvironment: 'sandbox' | 'production';
  production: EnvironmentCredentials;
  sandbox: EnvironmentCredentials;
  servicos?: Array<{
    codigoServico: string;
    coProduto?: string;
    nomeExibicao: string;
    habilitado: boolean;
    ordemExibicao?: number;
  }>;
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
  correiosApiResponse?: unknown; // Resposta bruta da API dos Correios
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<CorreiosConfig> {
  const res = await fetch('/api/admin/integrations/correios?reveal=true');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: Record<string, unknown>): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/correios', {
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
  const res = await fetch('/api/admin/integrations/correios/test', {
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
  const isSandbox = environment === 'sandbox';

  return (
    <Badge
      status={configured ? 'success' : 'default'}
      text={
        <Space>
          {isSandbox ? <ExperimentOutlined /> : <CloudOutlined />}
          <span>{isSandbox ? 'Homologação' : 'Produção'}</span>
          {configured && <Tag color="green" style={{ marginLeft: 4 }}>Configurado</Tag>}
        </Space>
      }
    />
  );
}

function CredentialsForm({
  prefix,
  environment,
  passwordDecryptionFailed,
}: {
  prefix: string;
  environment: 'sandbox' | 'production';
  passwordDecryptionFailed?: boolean;
}) {
  const isSandbox = environment === 'sandbox';
  const cwsUrl = isSandbox ? 'https://cwshom.correios.com.br' : 'https://cws.correios.com.br';

  return (
    <>
      <Alert
        type="info"
        description={
          <>
            Obtenha suas credenciais no portal{' '}
            <a href={cwsUrl} target="_blank" rel="noopener noreferrer">
              {cwsUrl}
            </a>
          </>
        }
        showIcon
        style={{ marginBottom: 16 }}
      />

      {passwordDecryptionFailed && (
        <Alert
          type="error"
          icon={<WarningOutlined />}
          message="Erro ao descriptografar credenciais"
          description="A senha armazenada não pôde ser descriptografada. Isso pode indicar que a ENCRYPTION_KEY do servidor é diferente da usada ao salvar. Insira a senha novamente para corrigir."
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form.Item
        name={[prefix, 'username']}
        label="Usuário (CNPJ)"
        rules={[{ required: false }]}
        extra="CNPJ do usuário no portal Meu Correios"
      >
        <Input placeholder="00000000000000" maxLength={14} />
      </Form.Item>

      <Form.Item
        name={[prefix, 'password']}
        label="Código de Acesso"
        rules={[{ required: false }]}
        extra="Código gerado no portal CWS."
      >
        <Input.Password
          placeholder="Código de acesso"
          style={{ fontFamily: 'monospace' }}
          visibilityToggle
        />
      </Form.Item>

      <Form.Item
        name={[prefix, 'cartaoPostagem']}
        label="Cartão de Postagem"
        rules={[{ required: false }]}
        extra="Número do cartão de postagem do contrato"
      >
        <Input placeholder="0000000000" maxLength={15} />
      </Form.Item>

      <Form.Item
        name={[prefix, 'apiKey']}
        label="API Key (CWS)"
        rules={[{ required: false }]}
        extra="Chave de API do portal CWS — alternativa ao Código de Acesso"
      >
        <Input.Password
          placeholder="Deixe em branco se não usar API Key"
          style={{ fontFamily: 'monospace' }}
          visibilityToggle
        />
      </Form.Item>

      <Collapse size="small" style={{ marginTop: 8 }}>
        <Collapse.Panel header="Configurações Opcionais" key="optional">
          <Form.Item
            name={[prefix, 'contrato']}
            label="Número do Contrato"
            extra="Opcional - Número do contrato com os Correios"
          >
            <Input placeholder="0000000000" maxLength={15} />
          </Form.Item>

          <Form.Item
            name={[prefix, 'dr']}
            label="Diretoria Regional (DR)"
            extra="Opcional - Código da diretoria regional"
          >
            <Input placeholder="Ex: 10" maxLength={5} />
          </Form.Item>
        </Collapse.Panel>
      </Collapse>
    </>
  );
}

// ============================================================================
// Main Components
// ============================================================================

function ConfigTab() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'correios', 'config'],
    queryFn: fetchConfig,
  });

  const mutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      message.success('Configuração salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'correios', 'config'] });
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  // Estado local para simulador de comissao
  const [simulatorBasePrice, setSimulatorBasePrice] = useState<number>(50);

  // Inicializar formulário quando dados carregam
  useEffect(() => {
    if (config && !initializedRef.current) {
      form.setFieldsValue({
        shippingCommissionPercent: config.shippingCommissionPercent ?? 0,
        carrierIconPath: config.carrierIconPath || '',
        activeEnvironment: config.activeEnvironment || 'sandbox',
        production: {
          username: config.production?.username || '',
          password: config.production?.password || '',
          cartaoPostagem: config.production?.cartaoPostagem || '',
          contrato: config.production?.contrato || '',
          dr: config.production?.dr || '',
          apiKey: config.production?.apiKey || '',
        },
        sandbox: {
          username: config.sandbox?.username || '',
          password: config.sandbox?.password || '',
          cartaoPostagem: config.sandbox?.cartaoPostagem || '',
          contrato: config.sandbox?.contrato || '',
          dr: config.sandbox?.dr || '',
          apiKey: config.sandbox?.apiKey || '',
        },
      });
      initializedRef.current = true;
    }
  }, [config, form]);

  const handleSubmit = (values: Record<string, unknown>) => {
    const payload = {
      shippingCommissionPercent: values.shippingCommissionPercent as number | null,
      carrierIconPath: (values.carrierIconPath as string) || null,
      activeEnvironment: values.activeEnvironment,
      production: values.production,
      sandbox: values.sandbox,
    };
    mutation.mutate(payload);
  };

  // Watch do campo de ícone para preview
  const iconPath = Form.useWatch('carrierIconPath', form);
  const [iconError, setIconError] = useState(false);

  // Reset error quando path muda
  useEffect(() => {
    startTransition(() => {
      setIconError(false);
    });
  }, [iconPath]);

  // Calcular valores do simulador
  const commissionPercent = Form.useWatch('shippingCommissionPercent', form) ?? 0;
  const finalPrice = simulatorBasePrice * (1 + commissionPercent / 100);
  const commissionAmount = finalPrice - simulatorBasePrice;

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      initialValues={{
        activeEnvironment: 'sandbox',
      }}
    >
      {/* Status */}
      {config?.configured && (
        <Alert
          type="success"
          title="Integração Configurada"
          description={
            <Space orientation="vertical" size="small">
              <Space>
                <Text>Ambiente ativo:</Text>
                <Tag color={config.activeEnvironment === 'sandbox' ? 'green' : 'red'}>
                  {config.activeEnvironment === 'sandbox' ? 'Homologação' : 'Produção'}
                </Tag>
              </Space>
              <Space>
                <EnvironmentBadge environment="production" configured={config.production?.configured || false} />
                <Divider type="vertical" />
                <EnvironmentBadge environment="sandbox" configured={config.sandbox?.configured || false} />
              </Space>
            </Space>
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Icone da Transportadora */}
      <Card
        title={
          <Space>
            <PictureOutlined />
            <span>Ícone da Transportadora</span>
          </Space>
        }
        size="small"
        style={{ marginBottom: 16, borderColor: '#faad1433' }}
        headStyle={{ background: '#fffbe6' }}
      >
        <Form.Item
          name="carrierIconPath"
          label="Caminho do Ícone"
          extra="Path relativo (ex: /images/carriers/correios.svg) ou URL externa"
        >
          <Input
            placeholder="/images/carriers/correios.svg"
            style={{ maxWidth: 400 }}
            allowClear
          />
        </Form.Item>

        {/* Preview do Ícone */}
        {iconPath && typeof iconPath === 'string' && iconPath.trim() !== '' && (
          <>
            <Divider style={{ margin: '12px 0' }} />
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Preview</Text>
            <div style={{
              padding: 16,
              background: '#f5f5f5',
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 16,
            }}>
              {!iconError ? (
                <Image
                  src={iconPath}
                  alt="Ícone Correios"
                  width={48}
                  height={48}
                  style={{
                    objectFit: 'contain',
                    border: '1px solid #d9d9d9',
                    borderRadius: 4,
                    background: '#fff',
                  }}
                  onError={() => setIconError(true)}
                  unoptimized
                />
              ) : (
                <div style={{
                  width: 48,
                  height: 48,
                  border: '1px dashed #ff4d4f',
                  borderRadius: 4,
                  background: '#fff2f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <PictureOutlined style={{ color: '#ff4d4f', fontSize: 20 }} />
                </div>
              )}
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>48x48px</Text>
                <br />
                <Text code style={{ fontSize: 11 }}>{iconPath}</Text>
                {iconError && (
                  <>
                    <br />
                    <Text type="danger" style={{ fontSize: 11 }}>Erro ao carregar imagem</Text>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Comissao sobre Frete */}
      <Card
        title="Comissao sobre Frete"
        size="small"
        style={{ marginBottom: 16, borderColor: '#1890ff33' }}
        headStyle={{ background: '#e6f7ff' }}
      >
        <Space align="start" wrap>
          <Form.Item
            name="shippingCommissionPercent"
            label="Percentual de comissao (%)"
            extra="Percentual aplicado sobre o valor do frete nas cotacoes dos Correios"
            rules={[
              { type: 'number', min: 0, message: 'Comissao nao pode ser negativa' },
              { type: 'number', max: 100, message: 'Comissao nao pode exceder 100%' },
            ]}
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              step={0.5}
              style={{ width: 150 }}
              addonAfter="%"
            />
          </Form.Item>
          <Form.Item
            name="shippingCommissionPercent2"
            label="Percentual de Comissão (%)"
            rules={[
              { type: 'number', min: 0, message: 'Nao pode ser negativo' },
              { type: 'number', max: 100, message: 'Nao pode exceder 100%' },
            ]}
          >
            <InputNumber
              min={0}
              max={100}
              precision={2}
              step={0.5}
              style={{ width: 150 }}
              addonAfter="%"
            />
          </Form.Item>
        </Space>

        {/* Simulador */}
        <Divider style={{ margin: '12px 0' }} />
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Simulador</Text>
        <Space wrap>
          <span>Frete base:</span>
          <InputNumber
            value={simulatorBasePrice}
            onChange={(v) => setSimulatorBasePrice(v ?? 50)}
            min={0}
            precision={2}
            prefix="R$"
            style={{ width: 120 }}
          />
          <span style={{ color: '#999' }}>&rarr;</span>
          <span>Final:</span>
          <Text strong style={{ color: '#52c41a' }}>
            {formatBRL(finalPrice)}
          </Text>
          <Tag color="blue">+{formatBRL(commissionAmount)}</Tag>
        </Space>
      </Card>

      {/* Ambiente Ativo */}
      <Card title="Ambiente Ativo" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="activeEnvironment"
          label="Selecione o ambiente que sera usado para operacoes"
          extra="O sistema usara as credenciais do ambiente selecionado para todas as chamadas de API"
        >
          <Radio.Group optionType="button" buttonStyle="solid">
            <Radio.Button value="sandbox">
              <Space>
                <ExperimentOutlined />
                Homologacao (Sandbox)
              </Space>
            </Radio.Button>
            <Radio.Button value="production">
              <Space>
                <CloudOutlined />
                Producao
              </Space>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
      </Card>

      {/* Credenciais de Produção */}
      <Card
        title={
          <Space>
            <CloudOutlined />
            <span>Credenciais de Produção</span>
            {config?.production?.configured && <Tag color="green">Configurado</Tag>}
          </Space>
        }
        size="small"
        style={{ marginBottom: 16, borderColor: '#ff4d4f33' }}
        headStyle={{ background: '#fff2f0' }}
      >
        <CredentialsForm
          prefix="production"
          environment="production"
          passwordDecryptionFailed={config?.production?.passwordDecryptionFailed}
        />
      </Card>

      {/* Credenciais de Homologação */}
      <Card
        title={
          <Space>
            <ExperimentOutlined />
            <span>Credenciais de Homologação (Sandbox)</span>
            {config?.sandbox?.configured && <Tag color="green">Configurado</Tag>}
          </Space>
        }
        size="small"
        style={{ marginBottom: 16, borderColor: '#52c41a33' }}
        headStyle={{ background: '#f6ffed' }}
      >
        <CredentialsForm
          prefix="sandbox"
          environment="sandbox"
          passwordDecryptionFailed={config?.sandbox?.passwordDecryptionFailed}
        />
      </Card>

      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          loading={mutation.isPending}
          size="large"
        >
          Salvar Configuração
        </Button>
      </Form.Item>
    </Form>
  );
}

function TestAuthTab() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await runTest({ type: 'auth' });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        type: 'auth',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <ApiUrlPreview endpoint="/token/v1/autentica/cartaopostagem" />

      <Alert
        type="info"
        title="Teste de Autenticação"
        description="Verifica se as credenciais CWS estão corretas e obtém um token JWT válido."
        showIcon
      />

      <Button
        type="primary"
        icon={<ApiOutlined />}
        onClick={handleTest}
        loading={loading}
        size="large"
      >
        Testar Autenticação
      </Button>

      {result && <TestResultDisplay result={result} />}
    </Space>
  );
}

function TestQuoteTab() {
  const [form] = Form.useForm();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async (values: Record<string, unknown>) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await runTest({
        type: 'quote',
        cepOrigem: (values.cepOrigem as string).replace(/\D/g, ''),
        cepDestino: (values.cepDestino as string).replace(/\D/g, ''),
        pesoGramas: values.pesoGramas,
        comprimentoCm: values.comprimentoCm,
        larguraCm: values.larguraCm,
        alturaCm: values.alturaCm,
        valorDeclarado: values.valorDeclarado,
      });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        type: 'quote',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <ApiUrlPreview endpoint="/preco/v1/nacional" />

      <Alert
        type="info"
        title="Teste de Cotação"
        description="Consulta preços e prazos para todos os serviços habilitados."
        showIcon
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleTest}
        initialValues={{
          cepOrigem: '01310100',
          cepDestino: '22041080',
          pesoGramas: 500,
          comprimentoCm: 20,
          larguraCm: 15,
          alturaCm: 10,
        }}
      >
        <Space wrap>
          <Form.Item name="cepOrigem" label="CEP Origem" rules={[{ required: true }]}>
            <Input placeholder="00000000" maxLength={9} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item name="cepDestino" label="CEP Destino" rules={[{ required: true }]}>
            <Input placeholder="00000000" maxLength={9} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item name="pesoGramas" label="Peso (g)">
            <InputNumber min={1} max={30000} style={{ width: 100 }} />
          </Form.Item>

          <Form.Item name="comprimentoCm" label="Comp. (cm)">
            <InputNumber min={1} max={100} style={{ width: 80 }} />
          </Form.Item>

          <Form.Item name="larguraCm" label="Larg. (cm)">
            <InputNumber min={1} max={100} style={{ width: 80 }} />
          </Form.Item>

          <Form.Item name="alturaCm" label="Alt. (cm)">
            <InputNumber min={1} max={100} style={{ width: 80 }} />
          </Form.Item>

          <Form.Item name="valorDeclarado" label="Valor Decl.">
            <InputNumber min={0} prefix="R$" precision={2} decimalSeparator="," formatter={inputNumberFormatterBRL} parser={inputNumberParserBRL} style={{ width: 100 }} />
          </Form.Item>
        </Space>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={loading}>
            Executar Cotação
          </Button>
        </Form.Item>
      </Form>

      {result && <TestResultDisplay result={result} />}
    </Space>
  );
}

function TestTrackingTab() {
  const [form] = Form.useForm();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async (values: Record<string, unknown>) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await runTest({
        type: 'tracking',
        codigoRastreio: (values.codigoRastreio as string).toUpperCase(),
      });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        type: 'tracking',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <ApiUrlPreview endpoint="/rastro/v1/objetos/{codigo}" />

      <Alert
        type="info"
        title="Teste de Rastreamento"
        description="Consulta eventos de rastreamento de um objeto pelo código SRO."
        showIcon
      />

      <Form form={form} layout="inline" onFinish={handleTest}>
        <Form.Item
          name="codigoRastreio"
          label="Código de Rastreio"
          rules={[
            { required: true, message: 'Informe o código' },
            {
              pattern: /^[A-Za-z]{2}\d{9}[A-Za-z]{2}$/,
              message: 'Formato inválido (ex: NX000000000BR)',
            },
          ]}
        >
          <Input
            placeholder="NX000000000BR"
            maxLength={13}
            style={{ width: 180, textTransform: 'uppercase' }}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={loading}>
            Rastrear
          </Button>
        </Form.Item>
      </Form>

      {result && <TestResultDisplay result={result} />}
    </Space>
  );
}

function ApiUrlPreview({ endpoint }: { endpoint: string }) {
  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'correios', 'config'],
    queryFn: fetchConfig,
    staleTime: 0,
    refetchOnMount: true,
  });

  if (isLoading) {
    return <Spin size="small" />;
  }

  const environment = config?.activeEnvironment || 'sandbox';
  const baseUrl = environment === 'production'
    ? 'https://api.correios.com.br'
    : 'https://apihom.correios.com.br';
  const fullUrl = `${baseUrl}${endpoint}`;

  const envConfig = environment === 'production' ? config?.production : config?.sandbox;
  const isConfigured = envConfig?.configured || false;

  return (
    <Card
      size="small"
      style={{
        marginBottom: 16,
        background: environment === 'sandbox' ? '#f6ffed' : '#fff2f0',
        borderColor: environment === 'sandbox' ? '#b7eb8f' : '#ffccc7',
      }}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="small">
        <Space>
          <Text strong>Ambiente:</Text>
          <Tag color={environment === 'sandbox' ? 'green' : 'red'}>
            {environment === 'sandbox' ? 'SANDBOX (Homologação)' : 'PRODUÇÃO'}
          </Tag>
          {!isConfigured && (
            <Tag color="warning">Credenciais não configuradas</Tag>
          )}
        </Space>
        <Space>
          <Text strong>URL Base:</Text>
          <Text code copyable>{baseUrl}</Text>
        </Space>
        <Space>
          <Text strong>Endpoint:</Text>
          <Text code>{endpoint}</Text>
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <Space>
          <Text strong>URL Completa:</Text>
          <Text code copyable style={{ wordBreak: 'break-all' }}>{fullUrl}</Text>
        </Space>
        {environment === 'production' && (
          <Alert
            type="warning"
            title="Atenção: Você está no ambiente de PRODUÇÃO. As requisições serão reais e podem gerar custos."
            style={{ marginTop: 8 }}
            showIcon
          />
        )}
      </Space>
    </Card>
  );
}

function TestPrePostagemTab() {
  const [form] = Form.useForm();
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTest = async (values: Record<string, unknown>) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await runTest({
        type: 'prepostagem',
        codigoServico: values.codigoServico as string,
        pesoGramas: values.pesoGramas as number,
        alturaCm: values.alturaCm as number,
        larguraCm: values.larguraCm as number,
        comprimentoCm: values.comprimentoCm as number,
        // Remetente (documento é OBRIGATÓRIO)
        remetenteNome: values.remetenteNome as string,
        remetenteDocumento: (values.remetenteDocumento as string).replace(/\D/g, ''),
        remetenteCep: (values.remetenteCep as string).replace(/\D/g, ''),
        remetenteLogradouro: values.remetenteLogradouro as string,
        remetenteNumero: values.remetenteNumero as string,
        remetenteBairro: values.remetenteBairro as string,
        remetenteCidade: values.remetenteCidade as string,
        remetenteUf: (values.remetenteUf as string).toUpperCase(),
        // Destinatário
        destinatarioNome: values.destinatarioNome as string,
        destinatarioCep: (values.destinatarioCep as string).replace(/\D/g, ''),
        destinatarioLogradouro: values.destinatarioLogradouro as string,
        destinatarioNumero: values.destinatarioNumero as string,
        destinatarioBairro: values.destinatarioBairro as string,
        destinatarioCidade: values.destinatarioCidade as string,
        destinatarioUf: (values.destinatarioUf as string).toUpperCase(),
        // Declaração de Conteúdo (obrigatório se não tiver NF-e)
        conteudoDescricao: values.conteudoDescricao as string,
        conteudoValor: values.conteudoValor as number,
      });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        type: 'prepostagem',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <ApiUrlPreview endpoint="/prepostagem/v1/prepostagens" />

      <Alert
        type="warning"
        title="⚠️ Teste de Pré-Postagem REAL"
        description={
          <div>
            <p style={{ margin: '4px 0' }}>
              Este teste executa uma <strong>pré-postagem REAL</strong> na API dos Correios:
            </p>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              <li><strong>SANDBOX:</strong> Não gera custos, mas valida todos os campos</li>
              <li><strong>PRODUÇÃO:</strong> Pode gerar custos e reservar código de rastreio real</li>
            </ul>
            <p style={{ margin: '4px 0' }}>
              <strong>Fluxo v1:</strong> POST /prepostagem/v1/prepostagens → POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf
            </p>
          </div>
        }
        showIcon
      />

      <Collapse defaultActiveKey={['endpoints']}>
        <Collapse.Panel
          header={
            <Space>
              <ApiOutlined />
              <span>Endpoints da API de Pré-Postagem v1</span>
              <Tag color="blue">Referência</Tag>
            </Space>
          }
          key="endpoints"
        >
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Ação</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Método</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: '4px 8px' }}>Criar Pré-Postagem</td><td>POST</td><td><code>/prepostagem/v1/prepostagens</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Gerar Rótulo (async)</td><td>POST</td><td><code>/prepostagem/v1/prepostagens/rotulo/assincrono/pdf</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Gerar Rótulo (sync)</td><td>POST</td><td><code>/prepostagem/v1/prepostagens/rotulo/pdf</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Consultar Pré-Postagens</td><td>GET</td><td><code>/prepostagem/v2/prepostagens</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Declaração de Conteúdo</td><td>GET</td><td><code>/prepostagem/v1/prepostagens/declaracaoconteudo/&#123;ids&#125;</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Aviso de Recebimento</td><td>GET</td><td><code>/prepostagem/v1/prepostagens/avisorecebimento/&#123;ids&#125;</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Cancelar por ID</td><td>DELETE</td><td><code>/prepostagem/v1/prepostagens/&#123;idPrePostagem&#125;</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Cancelar por Rastreio</td><td>DELETE</td><td><code>/prepostagem/v1/prepostagens/objeto/&#123;codigoObjeto&#125;</code></td></tr>
              </tbody>
            </table>
          </div>
        </Collapse.Panel>
      </Collapse>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleTest}
        initialValues={{
          codigoServico: '03298',
          pesoGramas: 500,
          alturaCm: 10,
          larguraCm: 15,
          comprimentoCm: 20,
          // Remetente (use CNPJ real para testes em produção)
          remetenteNome: 'Empresa Teste Ltda',
          remetenteDocumento: '',  // Preencha com CNPJ válido
          remetenteCep: '01310100',
          remetenteLogradouro: 'Av. Paulista',
          remetenteNumero: '1000',
          remetenteBairro: 'Bela Vista',
          remetenteCidade: 'São Paulo',
          remetenteUf: 'SP',
          // Destinatário
          destinatarioNome: 'João da Silva',
          destinatarioCep: '22041080',
          destinatarioLogradouro: 'Rua Barata Ribeiro',
          destinatarioNumero: '500',
          destinatarioBairro: 'Copacabana',
          destinatarioCidade: 'Rio de Janeiro',
          destinatarioUf: 'RJ',
          // Declaração de Conteúdo
          conteudoDescricao: 'Mercadorias diversas',
          conteudoValor: 100,
        }}
      >
        <Card
          title={
            <Space>
              <span>📦 Serviço e Dimensões</span>
              <Tag color="purple">Obrigatório</Tag>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16 }}
        >
          <Space wrap>
            <Form.Item
              name="codigoServico"
              label="Código Serviço"
              rules={[{ required: true, message: 'Obrigatório' }]}
              extra="03298=PAC, 03220=SEDEX"
            >
              <Input placeholder="03298" maxLength={5} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="pesoGramas" label="Peso (g)" rules={[{ required: true }]}>
              <InputNumber min={1} max={30000} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="comprimentoCm" label="Comp. (cm)" extra="mín: 16">
              <InputNumber min={16} max={100} style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="larguraCm" label="Larg. (cm)" extra="mín: 11">
              <InputNumber min={11} max={100} style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="alturaCm" label="Alt. (cm)" extra="mín: 2">
              <InputNumber min={2} max={100} style={{ width: 80 }} />
            </Form.Item>
          </Space>
        </Card>

        <Card
          title={
            <Space>
              <span>📝 Declaração de Conteúdo</span>
              <Tag color="red">Obrigatório (sem NF-e)</Tag>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16, borderColor: '#ff7a45' }}
        >
          <Alert
            type="info"
            title="A Declaração de Conteúdo é obrigatória quando não há NF-e vinculada"
            style={{ marginBottom: 12 }}
            showIcon
          />
          <Space wrap>
            <Form.Item
              name="conteudoDescricao"
              label="Descrição do Conteúdo"
              rules={[{ required: true, message: 'Obrigatório' }]}
              style={{ minWidth: 300 }}
            >
              <Input placeholder="Mercadorias diversas" maxLength={100} />
            </Form.Item>
            <Form.Item
              name="conteudoValor"
              label="Valor Declarado (R$)"
              rules={[{ required: true, message: 'Obrigatório' }]}
            >
              <InputNumber min={1} max={10000} prefix="R$" precision={2} decimalSeparator="," formatter={inputNumberFormatterBRL} parser={inputNumberParserBRL} style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Card>

        <Card
          title={
            <Space>
              <span>👤 Remetente</span>
              <Tag color="red">CPF/CNPJ Obrigatório</Tag>
            </Space>
          }
          size="small"
          style={{ marginBottom: 16, borderColor: '#ff4d4f' }}
        >
          <Alert
            type="error"
            title="O CPF/CNPJ do remetente é OBRIGATÓRIO e deve ser VÁLIDO"
            description="Use o CNPJ real da sua empresa. O Correios valida o documento na API."
            style={{ marginBottom: 12 }}
            showIcon
          />
          <Space wrap style={{ width: '100%' }}>
            <Form.Item
              name="remetenteNome"
              label="Nome/Razão Social"
              rules={[{ required: true, message: 'Obrigatório' }]}
              style={{ minWidth: 200 }}
            >
              <Input placeholder="Nome do remetente" />
            </Form.Item>
            <Form.Item
              name="remetenteDocumento"
              label="CPF/CNPJ"
              rules={[
                { required: true, message: 'Obrigatório' },
                { min: 11, message: 'Mínimo 11 dígitos' },
              ]}
              extra="Apenas números"
            >
              <Input placeholder="00000000000000" maxLength={14} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item name="remetenteCep" label="CEP" rules={[{ required: true }]}>
              <Input placeholder="00000000" maxLength={9} style={{ width: 110 }} />
            </Form.Item>
            <Form.Item name="remetenteLogradouro" label="Logradouro" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Input placeholder="Rua, Av, etc" />
            </Form.Item>
            <Form.Item name="remetenteNumero" label="Número">
              <Input placeholder="Nº" style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="remetenteBairro" label="Bairro">
              <Input placeholder="Bairro" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="remetenteCidade" label="Cidade" rules={[{ required: true }]}>
              <Input placeholder="Cidade" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="remetenteUf" label="UF" rules={[{ required: true }]}>
              <Input placeholder="UF" maxLength={2} style={{ width: 60 }} />
            </Form.Item>
          </Space>
        </Card>

        <Card title="📍 Destinatário" size="small" style={{ marginBottom: 16 }}>
          <Space wrap style={{ width: '100%' }}>
            <Form.Item name="destinatarioNome" label="Nome" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Input placeholder="Nome do destinatário" />
            </Form.Item>
            <Form.Item name="destinatarioCep" label="CEP" rules={[{ required: true }]}>
              <Input placeholder="00000000" maxLength={9} style={{ width: 110 }} />
            </Form.Item>
            <Form.Item name="destinatarioLogradouro" label="Logradouro" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Input placeholder="Rua, Av, etc" />
            </Form.Item>
            <Form.Item name="destinatarioNumero" label="Número">
              <Input placeholder="Nº" style={{ width: 80 }} />
            </Form.Item>
            <Form.Item name="destinatarioBairro" label="Bairro">
              <Input placeholder="Bairro" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="destinatarioCidade" label="Cidade" rules={[{ required: true }]}>
              <Input placeholder="Cidade" style={{ width: 150 }} />
            </Form.Item>
            <Form.Item name="destinatarioUf" label="UF" rules={[{ required: true }]}>
              <Input placeholder="UF" maxLength={2} style={{ width: 60 }} />
            </Form.Item>
          </Space>
        </Card>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" icon={<FileTextOutlined />} loading={loading} size="large">
              🚀 Executar Pré-Postagem
            </Button>
            <Button onClick={() => form.resetFields()}>
              Limpar
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {result && <TestResultDisplay result={result} />}
    </Space>
  );
}

// ============================================================================
// Rotulos Tab - Download de rótulos por ID
// ============================================================================

function RotulosTab() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [downloadResult, setDownloadResult] = useState<{ success: boolean; message: string; details?: unknown } | null>(null);

  const handleDownload = async (values: { codigo: string }) => {
    setLoading(true);
    setDownloadResult(null);

    const codigo = values.codigo.trim();

    try {
      const response = await fetch('/api/admin/integrations/correios/rotulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });

      if (!response.ok) {
        const error = await response.json();
        setDownloadResult({
          success: false,
          message: error.message || 'Erro ao baixar rótulo',
          details: error,
        });
        throw new Error(error.message || 'Erro ao baixar rótulo');
      }

      // Criar blob e baixar
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rotulo_${codigo}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadResult({ success: true, message: 'Rótulo baixado com sucesso!' });
      message.success('Rótulo baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar rótulo:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao baixar rótulo';
      if (!downloadResult) {
        setDownloadResult({ success: false, message: errorMsg });
      }
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="large">
      <ApiUrlPreview endpoint="/prepostagem/v1/prepostagens/rotulo/pdf" />

      <Alert
        type="info"
        message="Download de Rótulos"
        description={
          <div>
            <p style={{ margin: '4px 0' }}>
              Informe o <strong>código de rastreio</strong> ou o <strong>ID da pré-postagem</strong> para baixar o rótulo (etiqueta) em PDF.
            </p>
            <p style={{ margin: '4px 0' }}>
              Formatos aceitos:
            </p>
            <ul style={{ margin: '4px 0 4px 20px', padding: 0 }}>
              <li><code>AN312817735BR</code> - Código de rastreio</li>
              <li><code>PRNnhoiSb6SSKvvVJA13MiOA</code> - ID da pré-postagem</li>
            </ul>
          </div>
        }
        showIcon
      />

      <Card title="📄 Baixar Rótulo" size="small">
        <Form form={form} layout="vertical" onFinish={handleDownload}>
          <Form.Item
            name="codigo"
            label="Código de Rastreio ou ID da Pré-Postagem"
            rules={[{ required: true, message: 'Informe o código de rastreio ou ID da pré-postagem' }]}
            extra="Ex: AN312817735BR ou PRNnhoiSb6SSKvvVJA13MiOA"
          >
            <Input
              placeholder="Código de rastreio ou ID da pré-postagem"
              style={{ maxWidth: 400 }}
              allowClear
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<DownloadOutlined />}
                loading={loading}
                size="large"
              >
                📄 Baixar Rótulo PDF
              </Button>
              <Button onClick={() => { form.resetFields(); setDownloadResult(null); }}>
                Limpar
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {downloadResult && (
          <>
            <Alert
              type={downloadResult.success ? 'success' : 'error'}
              message={downloadResult.message}
              showIcon
              style={{ marginTop: 16 }}
            />
            {!downloadResult.success && downloadResult.details && (
              <Collapse style={{ marginTop: 16 }}>
                <Collapse.Panel
                  header={
                    <Space>
                      <FileTextOutlined />
                      <span>Detalhes do Erro</span>
                      <Tag color="red">API Response</Tag>
                    </Space>
                  }
                  key="error-details"
                >
                  <pre style={{
                    background: '#f5f5f5',
                    padding: 12,
                    borderRadius: 4,
                    fontSize: 11,
                    overflow: 'auto',
                    maxHeight: 300,
                  }}>
                    {JSON.stringify(downloadResult.details, null, 2)}
                  </pre>
                </Collapse.Panel>
              </Collapse>
            )}
          </>
        )}
      </Card>

      <Collapse>
        <Collapse.Panel
          header={
            <Space>
              <ApiOutlined />
              <span>Endpoints da API de Rótulos</span>
              <Tag color="blue">Referência</Tag>
            </Space>
          }
          key="endpoints"
        >
          <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, fontSize: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Ação</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Método</th>
                  <th style={{ textAlign: 'left', padding: '4px 8px' }}>Endpoint</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: '4px 8px' }}>Gerar Rótulo (sync)</td><td>POST</td><td><code>/prepostagem/v1/prepostagens/rotulo/pdf</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Gerar Rótulo (async)</td><td>POST</td><td><code>/prepostagem/v1/prepostagens/rotulo/assincrono/pdf</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Declaração de Conteúdo</td><td>GET</td><td><code>/prepostagem/v1/prepostagens/declaracaoconteudo/&#123;ids&#125;</code></td></tr>
                <tr><td style={{ padding: '4px 8px' }}>Aviso de Recebimento</td><td>GET</td><td><code>/prepostagem/v1/prepostagens/avisorecebimento/&#123;ids&#125;</code></td></tr>
              </tbody>
            </table>
          </div>
        </Collapse.Panel>
      </Collapse>
    </Space>
  );
}

function TestResultDisplay({ result }: { result: TestResult }) {
  const isSuccess = result.success;
  const [downloadingLabel, setDownloadingLabel] = useState(false);

  // Extrair idObjeto da resposta de pré-postagem
  const resultData = result.result as { idObjeto?: string; codigoRastreio?: string } | undefined;
  const idObjeto = resultData?.idObjeto;
  const codigoRastreio = resultData?.codigoRastreio;
  const isPrePostagem = result.type === 'prepostagem' && isSuccess && idObjeto;

  // Função para baixar o rótulo PDF
  const handleDownloadLabel = async () => {
    if (!idObjeto) return;

    setDownloadingLabel(true);
    try {
      const response = await fetch('/api/admin/integrations/correios/rotulo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: idObjeto }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao baixar rótulo');
      }

      // Criar blob e baixar
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rotulo_${codigoRastreio || idObjeto}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      message.success('Rótulo baixado com sucesso!');
    } catch (error) {
      console.error('Erro ao baixar rótulo:', error);
      message.error(error instanceof Error ? error.message : 'Erro ao baixar rótulo');
    } finally {
      setDownloadingLabel(false);
    }
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          {isSuccess ? (
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
          ) : (
            <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
          )}
          <span>Resultado do Teste</span>
          {result.latencyMs && <Tag color="blue">{result.latencyMs}ms</Tag>}
        </Space>
      }
      style={{ borderColor: isSuccess ? '#52c41a' : '#ff4d4f' }}
    >
      <Alert type={isSuccess ? 'success' : 'error'} title={result.message} style={{ marginBottom: 16 }} />

      {/* Botão para baixar rótulo (somente para pré-postagem bem-sucedida) */}
      {isPrePostagem && (
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownloadLabel}
            loading={downloadingLabel}
            size="large"
          >
            📄 Baixar Rótulo PDF
          </Button>
          <Text type="secondary" style={{ marginLeft: 12 }}>
            ID: {idObjeto} | Rastreio: {codigoRastreio}
          </Text>
        </div>
      )}

      <Collapse>
        {/* Detalhes da resposta interna */}
        {result.result != null && (
          <Collapse.Panel header="Resposta da API Interna" key="internal">
            <pre
              style={{
                background: '#f5f5f5',
                padding: 12,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 400,
                fontSize: 12,
              }}
            >
              {JSON.stringify(result.result, null, 2)}
            </pre>
          </Collapse.Panel>
        )}

        {/* Resposta bruta da API dos Correios */}
        {result.correiosApiResponse != null && (
          <Collapse.Panel
            header={
              <Space>
                <span>Resposta da API dos Correios</span>
                <Tag color="orange">Bruta</Tag>
              </Space>
            }
            key="correios"
          >
            <pre
              style={{
                background: '#fffbe6',
                padding: 12,
                borderRadius: 4,
                overflow: 'auto',
                maxHeight: 500,
                fontSize: 12,
                border: '1px solid #ffe58f',
              }}
            >
              {JSON.stringify(result.correiosApiResponse, null, 2)}
            </pre>
          </Collapse.Panel>
        )}
      </Collapse>
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CorreiosClient() {
  const tabItems = [
    {
      key: 'config',
      label: (
        <span>
          <SaveOutlined /> Configuração
        </span>
      ),
      children: <ConfigTab />,
    },
    {
      key: 'test-auth',
      label: (
        <span>
          <ApiOutlined /> Autenticação
        </span>
      ),
      children: <TestAuthTab />,
    },
    {
      key: 'test-quote',
      label: (
        <span>
          <SendOutlined /> Cotação
        </span>
      ),
      children: <TestQuoteTab />,
    },
    {
      key: 'test-tracking',
      label: (
        <span>
          <SearchOutlined /> Rastreamento
        </span>
      ),
      children: <TestTrackingTab />,
    },
    {
      key: 'test-prepostagem',
      label: (
        <span>
          <FileTextOutlined /> Pré-Postagem
        </span>
      ),
      children: <TestPrePostagemTab />,
    },
    {
      key: 'rotulos',
      label: (
        <span>
          <DownloadOutlined /> Rótulos
        </span>
      ),
      children: <RotulosTab />,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Integração Correios
          </Title>
          <Text type="secondary">
            Configure e teste a integração com as APIs dos Correios (CWS)
          </Text>
        </div>

        <Tabs defaultActiveKey="config" items={tabItems} />
      </Space>
    </div>
  );
}
