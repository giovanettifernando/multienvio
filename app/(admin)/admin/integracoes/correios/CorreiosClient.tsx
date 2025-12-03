'use client';

import { useState, useEffect, useRef } from 'react';
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
  const res = await fetch('/api/admin/integrations/correios');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  return res.json();
}

async function fetchConfigRevealed(): Promise<CorreiosConfig> {
  const res = await fetch('/api/admin/integrations/correios?reveal=true');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  return res.json();
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
  return res.json();
}

async function runTest(data: Record<string, unknown>): Promise<TestResult> {
  const res = await fetch('/api/admin/integrations/correios/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
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
  onReveal,
  loadingReveal,
  passwordVisible,
  onPasswordVisibleChange,
}: {
  prefix: string;
  environment: 'sandbox' | 'production';
  onReveal: (env: 'sandbox' | 'production') => void;
  loadingReveal: boolean;
  passwordVisible: boolean;
  onPasswordVisibleChange: (visible: boolean) => void;
}) {
  const isSandbox = environment === 'sandbox';
  const cwsUrl = isSandbox ? 'https://cwshom.correios.com.br' : 'https://cws.correios.com.br';

  return (
    <>
      <Alert
        type="info"
        title={`Credenciais para ${isSandbox ? 'Homologação (Sandbox)' : 'Produção'}`}
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
        extra="Código gerado no portal CWS. Clique no ícone para revelar."
      >
        <Input.Password
          placeholder="••••••••"
          visibilityToggle={{
            visible: passwordVisible,
            onVisibleChange: (visible) => {
              if (visible && !passwordVisible) {
                onReveal(environment);
              } else {
                onPasswordVisibleChange(visible);
              }
            },
          }}
        />
      </Form.Item>
      {loadingReveal && <Spin size="small" style={{ marginLeft: 8 }} />}

      <Form.Item
        name={[prefix, 'cartaoPostagem']}
        label="Cartão de Postagem"
        rules={[{ required: false }]}
        extra="Número do cartão de postagem do contrato"
      >
        <Input placeholder="0000000000" maxLength={15} />
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
  const [productionPasswordVisible, setProductionPasswordVisible] = useState(false);
  const [sandboxPasswordVisible, setSandboxPasswordVisible] = useState(false);
  const [loadingReveal, setLoadingReveal] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'correios', 'config'],
    queryFn: fetchConfig,
  });

  const mutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      message.success('Configuração salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'correios', 'config'] });
      setProductionPasswordVisible(false);
      setSandboxPasswordVisible(false);
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  // Inicializar formulário quando dados carregam
  useEffect(() => {
    if (config && !initializedRef.current) {
      form.setFieldsValue({
        activeEnvironment: config.activeEnvironment || 'sandbox',
        production: {
          username: config.production?.username || '',
          password: config.production?.password || '',
          cartaoPostagem: config.production?.cartaoPostagem || '',
          contrato: config.production?.contrato || '',
          dr: config.production?.dr || '',
        },
        sandbox: {
          username: config.sandbox?.username || '',
          password: config.sandbox?.password || '',
          cartaoPostagem: config.sandbox?.cartaoPostagem || '',
          contrato: config.sandbox?.contrato || '',
          dr: config.sandbox?.dr || '',
        },
      });
      initializedRef.current = true;
    }
  }, [config, form]);

  const handleRevealCredentials = async (environment: 'sandbox' | 'production') => {
    setLoadingReveal(true);
    try {
      const revealed = await fetchConfigRevealed();
      const envData = environment === 'production' ? revealed.production : revealed.sandbox;

      if (envData?.password) {
        form.setFieldsValue({
          [environment]: {
            ...form.getFieldValue(environment),
            password: envData.password,
          },
        });
        if (environment === 'production') {
          setProductionPasswordVisible(true);
        } else {
          setSandboxPasswordVisible(true);
        }
      }
    } catch {
      message.error('Erro ao revelar credenciais');
    } finally {
      setLoadingReveal(false);
    }
  };

  const handleSubmit = (values: Record<string, unknown>) => {
    const payload = {
      activeEnvironment: values.activeEnvironment,
      production: values.production,
      sandbox: values.sandbox,
    };
    mutation.mutate(payload);
  };

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

      {/* Ambiente Ativo */}
      <Card title="Ambiente Ativo" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="activeEnvironment"
          label="Selecione o ambiente que será usado para operações"
          extra="O sistema usará as credenciais do ambiente selecionado para todas as chamadas de API"
        >
          <Radio.Group optionType="button" buttonStyle="solid">
            <Radio.Button value="sandbox">
              <Space>
                <ExperimentOutlined />
                Homologação (Sandbox)
              </Space>
            </Radio.Button>
            <Radio.Button value="production">
              <Space>
                <CloudOutlined />
                Produção
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
          onReveal={handleRevealCredentials}
          loadingReveal={loadingReveal}
          passwordVisible={productionPasswordVisible}
          onPasswordVisibleChange={setProductionPasswordVisible}
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
          onReveal={handleRevealCredentials}
          loadingReveal={loadingReveal}
          passwordVisible={sandboxPasswordVisible}
          onPasswordVisibleChange={setSandboxPasswordVisible}
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
            <InputNumber min={0} prefix="R$" style={{ width: 100 }} />
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
        remetenteNome: values.remetenteNome as string,
        remetenteCep: (values.remetenteCep as string).replace(/\D/g, ''),
        remetenteLogradouro: values.remetenteLogradouro as string,
        remetenteNumero: values.remetenteNumero as string,
        remetenteBairro: values.remetenteBairro as string,
        remetenteCidade: values.remetenteCidade as string,
        remetenteUf: (values.remetenteUf as string).toUpperCase(),
        destinatarioNome: values.destinatarioNome as string,
        destinatarioCep: (values.destinatarioCep as string).replace(/\D/g, ''),
        destinatarioLogradouro: values.destinatarioLogradouro as string,
        destinatarioNumero: values.destinatarioNumero as string,
        destinatarioBairro: values.destinatarioBairro as string,
        destinatarioCidade: values.destinatarioCidade as string,
        destinatarioUf: (values.destinatarioUf as string).toUpperCase(),
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
      <ApiUrlPreview endpoint="/prepostagem/v2/prepostagens" />

      <Alert
        type="info"
        title="Teste de Pré-Postagem Real"
        description="Este teste executa uma pré-postagem REAL na API dos Correios. No ambiente SANDBOX, não gera custos. Em PRODUÇÃO, pode gerar custos."
        showIcon
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleTest}
        initialValues={{
          codigoServico: '03220',
          pesoGramas: 500,
          alturaCm: 10,
          larguraCm: 15,
          comprimentoCm: 20,
          remetenteNome: 'Empresa Teste Ltda',
          remetenteCep: '01310100',
          remetenteLogradouro: 'Av. Paulista',
          remetenteNumero: '1000',
          remetenteBairro: 'Bela Vista',
          remetenteCidade: 'São Paulo',
          remetenteUf: 'SP',
          destinatarioNome: 'João da Silva',
          destinatarioCep: '22041080',
          destinatarioLogradouro: 'Rua Barata Ribeiro',
          destinatarioNumero: '500',
          destinatarioBairro: 'Copacabana',
          destinatarioCidade: 'Rio de Janeiro',
          destinatarioUf: 'RJ',
        }}
      >
        <Card title="Serviço e Dimensões" size="small" style={{ marginBottom: 16 }}>
          <Space wrap>
            <Form.Item name="codigoServico" label="Código Serviço" rules={[{ required: true }]} extra="03220=SEDEX, 03298=PAC">
              <Input placeholder="03220" maxLength={5} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="pesoGramas" label="Peso (g)" rules={[{ required: true }]}>
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
          </Space>
        </Card>

        <Card title="Remetente" size="small" style={{ marginBottom: 16 }}>
          <Space wrap style={{ width: '100%' }}>
            <Form.Item name="remetenteNome" label="Nome" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Input placeholder="Nome do remetente" />
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

        <Card title="Destinatário" size="small" style={{ marginBottom: 16 }}>
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
          <Button type="primary" htmlType="submit" icon={<FileTextOutlined />} loading={loading} size="large">
            Executar Pré-Postagem
          </Button>
        </Form.Item>
      </Form>

      {result && <TestResultDisplay result={result} />}
    </Space>
  );
}

function TestResultDisplay({ result }: { result: TestResult }) {
  const isSuccess = result.success;

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
