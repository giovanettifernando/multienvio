'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  Typography,
  Alert,
  Spin,
  Tag,
  Collapse,
  Select,
  InputNumber,
  Switch,
  Divider,
  message,
} from 'antd';
import {
  SaveOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined,
  RobotOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  SendOutlined,
  CodeOutlined,
  ToolOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface OpenRouterConfig {
  configured: boolean;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  streamingEnabled: boolean;
  httpReferer: string | null;
  xTitle: string | null;
  isActive: boolean;
  lastUpdated?: string;
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  maxCompletionTokens?: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  modality?: string;
}

interface ModelsResponse {
  categories: string[];
  models: Record<string, ModelInfo[]>;
  totalCount: number;
}

interface TestResult {
  success: boolean;
  message: string;
  keyInfo?: {
    label?: string;
    usage?: number;
    limit?: number | null;
    isFreeTier?: boolean;
    rateLimit?: {
      requests: number;
      interval: string;
    };
  };
}

interface PlaygroundResponse {
  success: boolean;
  duration: number;
  debug: {
    url: string;
    apiKeyLast8: string;
    baseUrl: string;
  };
  request: {
    model: string;
    messages: unknown[];
    tools?: unknown[];
    provider?: unknown;
  };
  response: {
    raw: unknown;
    content: string | null;
    toolCalls: unknown[];
    finishReason: string | null;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    } | null;
  };
  error?: string;
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<OpenRouterConfig> {
  const res = await fetch('/api/admin/config/openrouter');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  streamingEnabled?: boolean;
  httpReferer?: string | null;
  xTitle?: string | null;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/admin/config/openrouter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.message || 'Erro ao salvar');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function testConnection(apiKey?: string): Promise<TestResult> {
  const res = await fetch('/api/admin/config/openrouter/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(apiKey ? { apiKey } : {}),
  });
  const json = await res.json();
  return json.data ?? json;
}

async function fetchModels(): Promise<ModelsResponse> {
  const res = await fetch('/api/admin/config/openrouter/models');
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || err.message || 'Erro ao carregar modelos');
  }
  const json = await res.json();
  return json.data ?? json;
}

async function sendPlayground(data: {
  message: string;
  model?: string;
  useTools?: boolean;
  systemPrompt?: string;
}): Promise<PlaygroundResponse> {
  const res = await fetch('/api/admin/config/openrouter/playground', {
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

function ModelOption({ model }: { model: ModelInfo }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <Text strong>{model.name}</Text>
        <br />
        <Text type="secondary" style={{ fontSize: 12 }}>
          {model.id}
        </Text>
      </div>
      <div style={{ textAlign: 'right' }}>
        <Tag color="blue">{(model.contextLength / 1000).toFixed(0)}K ctx</Tag>
        <br />
        <Text type="secondary" style={{ fontSize: 11 }}>
          {model.pricing.prompt}
        </Text>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function OpenRouterClient() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelsResponse | null>(null);

  // API Key reveal state
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);

  // Playground state
  const [playgroundMessage, setPlaygroundMessage] = useState('');
  const [playgroundUseTools, setPlaygroundUseTools] = useState(false);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundResult, setPlaygroundResult] = useState<PlaygroundResponse | null>(null);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'openrouter', 'config'],
    queryFn: fetchConfig,
  });

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      message.success('Configuração salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'openrouter', 'config'] });
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  // Inicializar formulário quando dados carregam
  useEffect(() => {
    if (config && !initializedRef.current) {
      form.setFieldsValue({
        apiKey: config.apiKey || '',
        baseUrl: config.baseUrl || 'https://openrouter.ai/api/v1',
        defaultModel: config.defaultModel || 'anthropic/claude-3-haiku',
        temperature: config.temperature ?? 0.7,
        maxTokens: config.maxTokens ?? 2048,
        streamingEnabled: config.streamingEnabled ?? true,
        httpReferer: config.httpReferer || '',
        xTitle: config.xTitle || '',
      });
      initializedRef.current = true;
    }
  }, [config, form]);

  // Carregar modelos quando configuração existir
  useEffect(() => {
    if (config?.configured) {
      loadModels();
    }
  }, [config?.configured]);

  const loadModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    try {
      const data = await fetchModels();
      setModels(data);
    } catch (err) {
      setModelsError(err instanceof Error ? err.message : 'Erro ao carregar modelos');
    } finally {
      setModelsLoading(false);
    }
  };

  const handleSubmit = (values: {
    apiKey: string;
    baseUrl: string;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    streamingEnabled: boolean;
    httpReferer?: string;
    xTitle?: string;
  }) => {
    // Se apiKey está mascarada e já existe configuração, não enviar
    if (values.apiKey.includes('***') && config?.configured) {
      message.warning('Informe a API Key completa para salvar');
      return;
    }
    saveMutation.mutate({
      ...values,
      httpReferer: values.httpReferer || null,
      xTitle: values.xTitle || null,
    });
  };

  const handleToggleApiKeyVisibility = async () => {
    if (apiKeyVisible) {
      // Voltar a mostrar mascarado
      if (config?.apiKey) {
        form.setFieldsValue({ apiKey: config.apiKey });
      }
      setApiKeyVisible(false);
      return;
    }

    // Buscar chave real do servidor
    setRevealLoading(true);
    try {
      const res = await fetch('/api/admin/config/openrouter?reveal=true');
      if (!res.ok) throw new Error('Erro ao revelar chave');
      const json = await res.json();
      const data = json.data ?? json;
      if (data.apiKey && !data.apiKey.includes('***')) {
        form.setFieldsValue({ apiKey: data.apiKey });
        setApiKeyVisible(true);
      } else {
        message.error('Não foi possível revelar a API Key');
      }
    } catch {
      message.error('Erro ao buscar API Key');
    } finally {
      setRevealLoading(false);
    }
  };

  const handleTest = async () => {
    const values = form.getFieldsValue();
    const apiKey = values.apiKey;

    if (!apiKey || apiKey.includes('***')) {
      message.warning('Preencha a API Key para testar');
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testConnection(apiKey);
      setTestResult(result);
      if (result.success) {
        // Se sucesso, recarregar modelos
        loadModels();
      }
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Erro ao testar',
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handlePlaygroundSend = async () => {
    if (!playgroundMessage.trim()) {
      message.warning('Digite uma mensagem para testar');
      return;
    }

    setPlaygroundLoading(true);
    setPlaygroundResult(null);

    try {
      const result = await sendPlayground({
        message: playgroundMessage,
        useTools: playgroundUseTools,
      });
      setPlaygroundResult(result);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem');
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // Construir opções do Select de modelos
  const modelOptions = models
    ? models.categories.map((category) => ({
        label: category.charAt(0).toUpperCase() + category.slice(1),
        options: models.models[category]?.map((model) => ({
          label: <ModelOption model={model} />,
          value: model.id,
          searchText: `${model.name} ${model.id}`,
        })) || [],
      }))
    : [];

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <RobotOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            Configuração OpenRouter
          </Title>
          <Text type="secondary">
            Configure as credenciais e parâmetros do assistente de IA
          </Text>
        </div>

        {/* Status */}
        {config?.configured && (
          <Alert
            type="success"
            message="Integração Configurada"
            description={
              <Space>
                <Text>Modelo padrão:</Text>
                <Tag color="purple">{config.defaultModel}</Tag>
                {config.lastUpdated && (
                  <>
                    <Text>Atualizado em:</Text>
                    <Tag color="blue">
                      {new Date(config.lastUpdated).toLocaleString('pt-BR')}
                    </Tag>
                  </>
                )}
              </Space>
            }
            showIcon
          />
        )}

        {/* Instruções */}
        <Card size="small">
          <Collapse ghost>
            <Collapse.Panel header="Como obter as credenciais?" key="instructions">
              <Paragraph>
                <ol>
                  <li>
                    Acesse{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                      OpenRouter Keys
                    </a>
                  </li>
                  <li>Crie uma conta ou faça login</li>
                  <li>Clique em &quot;Create Key&quot;</li>
                  <li>Copie a chave gerada (formato: sk-or-v1-...)</li>
                  <li>Cole aqui e teste a conexão</li>
                </ol>
              </Paragraph>
              <Paragraph>
                <Text type="secondary">
                  Dica: Configure HTTP-Referer e X-Title para melhor rastreamento de uso no dashboard do OpenRouter.
                </Text>
              </Paragraph>
            </Collapse.Panel>
          </Collapse>
        </Card>

        {/* Formulário */}
        <Card title="Configuração">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            {/* API Key */}
            <Form.Item
              name="apiKey"
              label="API Key"
              rules={[{ required: true, message: 'API Key é obrigatória' }]}
              extra="Chave de API do OpenRouter (formato: sk-or-v1-...)"
            >
              <Input
                placeholder="sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                size="large"
                type={apiKeyVisible ? 'text' : 'password'}
                style={{ fontFamily: 'monospace' }}
                suffix={
                  config?.configured ? (
                    <Button
                      type="text"
                      size="small"
                      loading={revealLoading}
                      icon={apiKeyVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      onClick={handleToggleApiKeyVisibility}
                      style={{ color: '#8c8c8c' }}
                    />
                  ) : null
                }
              />
            </Form.Item>

            {/* Base URL */}
            <Form.Item
              name="baseUrl"
              label="URL Base"
              extra="URL da API do OpenRouter (manter padrão na maioria dos casos)"
            >
              <Input
                placeholder="https://openrouter.ai/api/v1"
                size="large"
              />
            </Form.Item>

            <Divider>Parâmetros do Modelo</Divider>

            {/* Modelo Padrão */}
            <Form.Item
              name="defaultModel"
              label="Modelo Padrão"
              rules={[{ required: true, message: 'Selecione um modelo' }]}
              extra="Modelo LLM usado pelo assistente"
            >
              <Select
                placeholder="Selecione um modelo..."
                size="large"
                showSearch
                loading={modelsLoading}
                optionFilterProp="searchText"
                options={modelOptions}
                notFoundContent={
                  modelsLoading ? (
                    <Spin size="small" />
                  ) : modelsError ? (
                    <Space orientation="vertical" align="center" style={{ padding: 16 }}>
                      <Text type="danger">{modelsError}</Text>
                      <Button
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={loadModels}
                      >
                        Tentar novamente
                      </Button>
                    </Space>
                  ) : (
                    <Text type="secondary">
                      Salve a configuração primeiro para carregar os modelos
                    </Text>
                  )
                }
                dropdownRender={(menu) => (
                  <>
                    {menu}
                    <Divider style={{ margin: '8px 0' }} />
                    <Space style={{ padding: '0 8px 8px' }}>
                      <Button
                        type="text"
                        icon={<ReloadOutlined />}
                        onClick={loadModels}
                        loading={modelsLoading}
                      >
                        Recarregar modelos
                      </Button>
                      {models && (
                        <Text type="secondary">
                          {models.totalCount} modelos disponíveis
                        </Text>
                      )}
                    </Space>
                  </>
                )}
              />
            </Form.Item>

            {/* Temperature e Max Tokens */}
            <Space size="large" style={{ width: '100%' }}>
              <Form.Item
                name="temperature"
                label="Temperatura"
                style={{ flex: 1 }}
                extra="Controla aleatoriedade (0 = determinístico, 2 = criativo)"
              >
                <InputNumber
                  min={0}
                  max={2}
                  step={0.1}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item
                name="maxTokens"
                label="Máximo de Tokens"
                style={{ flex: 1 }}
                extra="Limite de tokens na resposta"
              >
                <InputNumber
                  min={100}
                  max={100000}
                  step={100}
                  size="large"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Space>

            {/* Streaming */}
            <Form.Item
              name="streamingEnabled"
              label="Streaming"
              valuePropName="checked"
              extra="Habilita resposta em tempo real (recomendado)"
            >
              <Switch
                checkedChildren={<ThunderboltOutlined />}
                unCheckedChildren="Off"
              />
            </Form.Item>

            <Divider>Configurações Opcionais</Divider>

            {/* HTTP Referer */}
            <Form.Item
              name="httpReferer"
              label="HTTP-Referer"
              extra="URL do seu site para rastreamento no dashboard OpenRouter"
            >
              <Input
                placeholder="https://seusite.com"
                size="large"
              />
            </Form.Item>

            {/* X-Title */}
            <Form.Item
              name="xTitle"
              label="X-Title"
              extra="Nome da aplicação para identificação no dashboard"
            >
              <Input
                placeholder="Envio Legal"
                size="large"
              />
            </Form.Item>

            {/* Botões */}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                  loading={saveMutation.isPending}
                  size="large"
                >
                  Salvar
                </Button>

                <Button
                  icon={<ApiOutlined />}
                  onClick={handleTest}
                  loading={testLoading}
                  size="large"
                >
                  Testar Conexão
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Card>

        {/* Resultado do Teste */}
        {testResult && (
          <Card
            size="small"
            title={
              <Space>
                {testResult.success ? (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                ) : (
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                )}
                <span>Resultado do Teste</span>
              </Space>
            }
            style={{ borderColor: testResult.success ? '#52c41a' : '#ff4d4f' }}
          >
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              style={{ marginBottom: testResult.keyInfo ? 16 : 0 }}
            />

            {testResult.keyInfo && (
              <Collapse size="small">
                <Collapse.Panel header="Informações da Chave" key="keyInfo">
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {testResult.keyInfo.label && (
                      <div>
                        <Text type="secondary">Label: </Text>
                        <Text>{testResult.keyInfo.label}</Text>
                      </div>
                    )}
                    {testResult.keyInfo.usage !== undefined && (
                      <div>
                        <Text type="secondary">Uso: </Text>
                        <Text>${(testResult.keyInfo.usage / 100).toFixed(4)}</Text>
                        {testResult.keyInfo.limit && (
                          <Text type="secondary"> / ${(testResult.keyInfo.limit / 100).toFixed(2)}</Text>
                        )}
                      </div>
                    )}
                    {testResult.keyInfo.isFreeTier !== undefined && (
                      <div>
                        <Text type="secondary">Plano: </Text>
                        <Tag color={testResult.keyInfo.isFreeTier ? 'orange' : 'green'}>
                          {testResult.keyInfo.isFreeTier ? 'Free Tier' : 'Paid'}
                        </Tag>
                      </div>
                    )}
                    {testResult.keyInfo.rateLimit && (
                      <div>
                        <Text type="secondary">Rate Limit: </Text>
                        <Text>
                          {testResult.keyInfo.rateLimit.requests} req/{testResult.keyInfo.rateLimit.interval}
                        </Text>
                      </div>
                    )}
                  </Space>
                </Collapse.Panel>
              </Collapse>
            )}
          </Card>
        )}

        {/* Playground */}
        {config?.configured && (
          <Card
            title={
              <Space>
                <CodeOutlined style={{ color: '#722ed1' }} />
                <span>Playground - Testar Modelo</span>
              </Space>
            }
          >
            <Space orientation="vertical" style={{ width: '100%' }} size="middle">
              <Input.TextArea
                placeholder="Digite sua mensagem para testar o modelo..."
                value={playgroundMessage}
                onChange={(e) => setPlaygroundMessage(e.target.value)}
                rows={3}
                disabled={playgroundLoading}
              />

              <Space>
                <Switch
                  checked={playgroundUseTools}
                  onChange={setPlaygroundUseTools}
                  checkedChildren={<><ToolOutlined /> Com Tools</>}
                  unCheckedChildren="Sem Tools"
                />

                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handlePlaygroundSend}
                  loading={playgroundLoading}
                  disabled={!playgroundMessage.trim()}
                >
                  Enviar
                </Button>
              </Space>

              {playgroundResult && (
                <div style={{ marginTop: 16 }}>
                  <Alert
                    type={playgroundResult.success ? 'success' : 'error'}
                    message={
                      <Space>
                        <span>{playgroundResult.success ? 'Sucesso' : 'Erro'}</span>
                        <Tag color="blue">{playgroundResult.duration}ms</Tag>
                        {playgroundResult.response.usage && (
                          <Tag color="purple">
                            {playgroundResult.response.usage.totalTokens} tokens
                          </Tag>
                        )}
                      </Space>
                    }
                    description={playgroundResult.error}
                    style={{ marginBottom: 16 }}
                  />

                  {/* Debug Info */}
                  <Card size="small" title="Debug Info" style={{ marginBottom: 16 }}>
                    <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                      <div>
                        <Text type="secondary">URL: </Text>
                        <Text code>{playgroundResult.debug?.url || 'N/A'}</Text>
                      </div>
                      <div>
                        <Text type="secondary">Base URL: </Text>
                        <Text code>{playgroundResult.debug?.baseUrl || 'N/A'}</Text>
                      </div>
                      <div>
                        <Text type="secondary">API Key: </Text>
                        <Text code>{playgroundResult.debug?.apiKeyLast8 || 'N/A'}</Text>
                      </div>
                    </Space>
                  </Card>

                  {playgroundResult.response.content && (
                    <Card size="small" title="Resposta do Modelo" style={{ marginBottom: 16 }}>
                      <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                        {playgroundResult.response.content}
                      </Paragraph>
                    </Card>
                  )}

                  {playgroundResult.response.toolCalls.length > 0 && (
                    <Card size="small" title={<><ToolOutlined /> Tool Calls</>} style={{ marginBottom: 16 }}>
                      <pre style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 4,
                        overflow: 'auto',
                        fontSize: 12,
                        margin: 0,
                      }}>
                        {JSON.stringify(playgroundResult.response.toolCalls, null, 2)}
                      </pre>
                    </Card>
                  )}

                  <Collapse size="small">
                    <Collapse.Panel header="Request Enviado" key="request">
                      <pre style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 4,
                        overflow: 'auto',
                        fontSize: 11,
                        maxHeight: 300,
                        margin: 0,
                      }}>
                        {JSON.stringify(playgroundResult.request, null, 2)}
                      </pre>
                    </Collapse.Panel>
                    <Collapse.Panel header="Resposta Bruta (Raw)" key="raw">
                      <pre style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 4,
                        overflow: 'auto',
                        fontSize: 11,
                        maxHeight: 400,
                        margin: 0,
                      }}>
                        {JSON.stringify(playgroundResult.response.raw, null, 2)}
                      </pre>
                    </Collapse.Panel>
                  </Collapse>
                </div>
              )}
            </Space>
          </Card>
        )}
      </Space>
    </div>
  );
}
