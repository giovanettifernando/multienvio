'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Space,
  Typography,
  Tabs,
  Alert,
  Spin,
  Divider,
  Tag,
  Table,
  InputNumber,
  Collapse,
  Radio,
  message,
} from 'antd';
import {
  SaveOutlined,
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  SendOutlined,
  SearchOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface CorreiosConfig {
  environment: 'sandbox' | 'production';
  authMode?: 'apiKey' | 'legacy';
  // Modo API Key (novo)
  apiKey?: string;
  // Modo Legado
  username: string;
  password: string;
  cartaoPostagem: string;
  // Opcionais
  contrato?: string;
  dr?: string;
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
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<{ configured: boolean; data: CorreiosConfig | null }> {
  const res = await fetch('/api/admin/integrations/correios');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  return res.json();
}

async function saveConfig(data: Partial<CorreiosConfig>): Promise<{ message: string }> {
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
// Components
// ============================================================================

function ConfigTab() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const [authMode, setAuthMode] = useState<'apiKey' | 'legacy'>('apiKey');
  const initializedRef = useRef(false);

  const { data, isLoading } = useQuery({
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

  const config = data?.data;

  // Sincronizar modo de autenticação apenas uma vez quando os dados carregam
  useEffect(() => {
    if (config && !initializedRef.current) {
      const initialMode = config.authMode || (config.apiKey ? 'apiKey' : 'legacy');
      setAuthMode(initialMode);
      initializedRef.current = true;
    }
  }, [config]);

  const handleSubmit = (values: Record<string, unknown>) => {
    const payload: Partial<CorreiosConfig> = {
      environment: values.sandboxMode ? 'sandbox' : 'production',
      contrato: values.contrato as string,
      dr: values.dr as string,
    };

    // Adicionar campos conforme o modo de autenticação
    if (authMode === 'apiKey') {
      payload.apiKey = values.apiKey as string;
    } else {
      payload.username = values.username as string;
      payload.password = values.password as string;
      payload.cartaoPostagem = values.cartaoPostagem as string;
    }

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
        sandboxMode: config?.environment === 'sandbox',
        apiKey: config?.apiKey || '',
        username: config?.username || '',
        password: config?.password || '',
        cartaoPostagem: config?.cartaoPostagem || '',
        contrato: config?.contrato || '',
        dr: config?.dr || '',
      }}
    >
      {data?.configured && (
        <Alert
          type="success"
          message="Integração Configurada"
          description={
            <>
              Modo: <Tag color="blue">{config?.authMode === 'apiKey' ? 'API Key' : 'Legado'}</Tag>
              {' | '}
              Última atualização:{' '}
              {config?.lastUpdated
                ? new Date(config.lastUpdated).toLocaleString('pt-BR')
                : 'N/A'}
            </>
          }
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card title="Ambiente" size="small" style={{ marginBottom: 16 }}>
        <Form.Item
          name="sandboxMode"
          label="Modo Sandbox (Homologação)"
          valuePropName="checked"
          extra="Ative para usar o ambiente de testes dos Correios"
        >
          <Switch checkedChildren="Sandbox" unCheckedChildren="Produção" />
        </Form.Item>
      </Card>

      <Card title="Autenticação CWS" size="small" style={{ marginBottom: 16 }}>
        <Form.Item label="Modo de Autenticação">
          <Radio.Group
            value={authMode}
            onChange={(e) => setAuthMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="apiKey">API Key (Novo)</Radio.Button>
            <Radio.Button value="legacy">Usuário/Senha (Legado)</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {authMode === 'apiKey' ? (
          <>
            <Alert
              type="info"
              message="Autenticação via API Key"
              description={
                <>
                  Gere sua API Key no portal{' '}
                  <a href="https://cws.correios.com.br" target="_blank" rel="noopener noreferrer">
                    cws.correios.com.br
                  </a>
                  . A chave começa com <code>cws-ch1_</code>.
                </>
              }
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[
                { required: authMode === 'apiKey', message: 'Informe a API Key' },
                {
                  pattern: /^cws-ch1_/,
                  message: 'API Key deve começar com cws-ch1_',
                  warningOnly: true,
                },
              ]}
              extra="Chave gerada no portal CWS dos Correios"
            >
              <Input.Password
                placeholder="cws-ch1_xxxxxxxxxxxxxxxxx"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item
              name="username"
              label="Usuário CWS"
              rules={[{ required: authMode === 'legacy', message: 'Informe o usuário CWS' }]}
              extra="Usuário do componente CWS (Meu Correios)"
            >
              <Input placeholder="seu_usuario_cws" />
            </Form.Item>

            <Form.Item
              name="password"
              label="Senha CWS"
              rules={[{ required: authMode === 'legacy', message: 'Informe a senha CWS' }]}
              extra="Senha do componente CWS"
            >
              <Input.Password placeholder="••••••••" />
            </Form.Item>

            <Form.Item
              name="cartaoPostagem"
              label="Cartão de Postagem"
              rules={[{ required: authMode === 'legacy', message: 'Informe o cartão de postagem' }]}
              extra="Número do cartão de postagem do contrato"
            >
              <Input placeholder="0000000000" maxLength={15} />
            </Form.Item>
          </>
        )}
      </Card>

      <Collapse style={{ marginBottom: 16 }}>
        <Collapse.Panel header="Configurações Opcionais" key="optional">
          <Form.Item
            name="contrato"
            label="Número do Contrato"
            extra="Opcional - Número do contrato com os Correios"
          >
            <Input placeholder="0000000000" maxLength={15} />
          </Form.Item>

          <Form.Item
            name="dr"
            label="Diretoria Regional (DR)"
            extra="Opcional - Código da diretoria regional"
          >
            <Input placeholder="Ex: 10" maxLength={5} />
          </Form.Item>
        </Collapse.Panel>
      </Collapse>

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
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        type="info"
        message="Teste de Autenticação"
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
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        type="info"
        message="Teste de Cotação"
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
          <Form.Item
            name="cepOrigem"
            label="CEP Origem"
            rules={[{ required: true }]}
          >
            <Input placeholder="00000000" maxLength={9} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item
            name="cepDestino"
            label="CEP Destino"
            rules={[{ required: true }]}
          >
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
          <Button
            type="primary"
            htmlType="submit"
            icon={<SendOutlined />}
            loading={loading}
          >
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
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        type="info"
        message="Teste de Rastreamento"
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
          <Button
            type="primary"
            htmlType="submit"
            icon={<SearchOutlined />}
            loading={loading}
          >
            Rastrear
          </Button>
        </Form.Item>
      </Form>

      {result && <TestResultDisplay result={result} />}
    </Space>
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
        type: 'prepostagem_sim',
        codigoServico: values.codigoServico,
        cepOrigem: (values.cepOrigem as string).replace(/\D/g, ''),
        cepDestino: (values.cepDestino as string).replace(/\D/g, ''),
        pesoGramas: values.pesoGramas,
      });
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        type: 'prepostagem_sim',
        message: err instanceof Error ? err.message : 'Erro desconhecido',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        type="warning"
        message="Simulação de Pré-Postagem"
        description="Este teste apenas valida os dados. NÃO cria objetos reais na API dos Correios."
        showIcon
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={handleTest}
        initialValues={{
          codigoServico: '03220',
          cepOrigem: '01310100',
          cepDestino: '22041080',
          pesoGramas: 500,
        }}
      >
        <Space wrap>
          <Form.Item
            name="codigoServico"
            label="Código Serviço"
            rules={[{ required: true }]}
            extra="03220=SEDEX, 03298=PAC"
          >
            <Input placeholder="03220" maxLength={5} style={{ width: 100 }} />
          </Form.Item>

          <Form.Item name="cepOrigem" label="CEP Origem" rules={[{ required: true }]}>
            <Input placeholder="00000000" maxLength={9} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item name="cepDestino" label="CEP Destino" rules={[{ required: true }]}>
            <Input placeholder="00000000" maxLength={9} style={{ width: 120 }} />
          </Form.Item>

          <Form.Item name="pesoGramas" label="Peso (g)">
            <InputNumber min={1} max={30000} style={{ width: 100 }} />
          </Form.Item>
        </Space>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            icon={<FileTextOutlined />}
            loading={loading}
          >
            Simular Pré-Postagem
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
          {result.latencyMs && (
            <Tag color="blue">{result.latencyMs}ms</Tag>
          )}
        </Space>
      }
      style={{
        borderColor: isSuccess ? '#52c41a' : '#ff4d4f',
      }}
    >
      <Alert
        type={isSuccess ? 'success' : 'error'}
        message={result.message}
        style={{ marginBottom: 16 }}
      />

      {result.result != null && (
        <Collapse>
          <Collapse.Panel header="Detalhes da Resposta" key="details">
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
        </Collapse>
      )}
    </Card>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function CorreiosAdminPage() {
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
      <Space direction="vertical" style={{ width: '100%' }} size="large">
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
