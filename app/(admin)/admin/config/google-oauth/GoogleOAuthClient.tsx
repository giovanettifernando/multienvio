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
  message,
} from 'antd';
import {
  SaveOutlined,
  GoogleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface GoogleOAuthConfig {
  configured: boolean;
  clientId: string;
  clientSecret: string;
  isActive: boolean;
  updatedAt?: string;
}

interface TestResult {
  success: boolean;
  message: string;
  warning?: string;
  details?: Record<string, unknown>;
  latencyMs?: number;
  error?: string;
}

// ============================================================================
// API Calls
// ============================================================================

async function fetchConfig(): Promise<GoogleOAuthConfig> {
  const res = await fetch('/api/admin/config/google-oauth');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  return res.json();
}

async function saveConfig(data: { clientId: string; clientSecret: string }): Promise<{ success: boolean; message: string }> {
  const res = await fetch('/api/admin/config/google-oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, isActive: true }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Erro ao salvar');
  }
  return res.json();
}

async function testCredentials(data: { clientId: string; clientSecret: string }): Promise<TestResult> {
  const res = await fetch('/api/admin/config/google-oauth/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ============================================================================
// Main Page
// ============================================================================

export default function GoogleOAuthClient() {
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const initializedRef = useRef(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin', 'google-oauth', 'config'],
    queryFn: fetchConfig,
  });

  const saveMutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      message.success('Configuração salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['admin', 'google-oauth', 'config'] });
    },
    onError: (err: Error) => {
      message.error(err.message);
    },
  });

  // Inicializar formulário quando dados carregam
  useEffect(() => {
    if (config && !initializedRef.current) {
      form.setFieldsValue({
        clientId: config.clientId || '',
        // Não preencher clientSecret pois está mascarado
        clientSecret: '',
      });
      initializedRef.current = true;
    }
  }, [config, form]);

  const handleSubmit = (values: { clientId: string; clientSecret: string }) => {
    // Se clientSecret está vazio e já existe configuração, não enviar
    if (!values.clientSecret && config?.configured) {
      message.warning('Informe o Client Secret para salvar');
      return;
    }
    saveMutation.mutate(values);
  };

  const handleTest = async () => {
    const values = form.getFieldsValue();
    if (!values.clientId || !values.clientSecret) {
      message.warning('Preencha o Client ID e Client Secret para testar');
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    try {
      const result = await testCredentials(values);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Erro ao testar',
      });
    } finally {
      setTestLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <Space orientation="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <GoogleOutlined style={{ marginRight: 8, color: '#4285F4' }} />
            Credenciais Google OAuth
          </Title>
          <Text type="secondary">
            Configure as credenciais para login com Google no sistema
          </Text>
        </div>

        {/* Status */}
        {config?.configured && (
          <Alert
            type="success"
            message="Integração Configurada"
            description={
              <Space>
                <Text>Última atualização:</Text>
                <Tag color="blue">
                  {config.updatedAt ? new Date(config.updatedAt).toLocaleString('pt-BR') : 'N/A'}
                </Tag>
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
                    Acesse o{' '}
                    <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">
                      Google Cloud Console
                    </a>
                  </li>
                  <li>Crie um novo projeto ou selecione um existente</li>
                  <li>Vá em &quot;Credenciais&quot; &gt; &quot;Criar credenciais&quot; &gt; &quot;ID do cliente OAuth&quot;</li>
                  <li>Selecione &quot;Aplicativo da Web&quot;</li>
                  <li>
                    Adicione os URIs de redirecionamento autorizados:
                    <ul>
                      <li><Text code>http://localhost:3000/api/auth/google/callback</Text> (desenvolvimento)</li>
                      <li><Text code>https://seudominio.com/api/auth/google/callback</Text> (produção)</li>
                    </ul>
                  </li>
                  <li>Copie o &quot;ID do cliente&quot; e &quot;Chave secreta do cliente&quot;</li>
                </ol>
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
            <Form.Item
              name="clientId"
              label="Client ID"
              rules={[{ required: true, message: 'Client ID é obrigatório' }]}
              extra="ID do cliente OAuth do Google (termina com .apps.googleusercontent.com)"
            >
              <Input
                placeholder="123456789-abc123.apps.googleusercontent.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="clientSecret"
              label="Client Secret"
              rules={[
                {
                  required: !config?.configured,
                  message: 'Client Secret é obrigatório',
                },
              ]}
              extra={
                config?.configured
                  ? 'Deixe em branco para manter o valor atual. Preencha para atualizar.'
                  : 'Chave secreta do cliente OAuth (começa com GOCSPX-)'
              }
            >
              <Input.Password
                placeholder={config?.configured ? '***configurado***' : 'GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                size="large"
              />
            </Form.Item>

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
                  Testar Credenciais
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
                {testResult.latencyMs && <Tag color="blue">{testResult.latencyMs}ms</Tag>}
              </Space>
            }
            style={{ borderColor: testResult.success ? '#52c41a' : '#ff4d4f' }}
          >
            <Alert
              type={testResult.success ? 'success' : 'error'}
              message={testResult.message}
              style={{ marginBottom: testResult.warning || testResult.details ? 16 : 0 }}
            />

            {testResult.warning && (
              <Alert
                type="warning"
                message={testResult.warning}
                style={{ marginBottom: testResult.details ? 16 : 0 }}
              />
            )}

            {testResult.details && (
              <Collapse size="small">
                <Collapse.Panel header="Detalhes" key="details">
                  <pre
                    style={{
                      background: '#f5f5f5',
                      padding: 12,
                      borderRadius: 4,
                      overflow: 'auto',
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(testResult.details, null, 2)}
                  </pre>
                </Collapse.Panel>
              </Collapse>
            )}
          </Card>
        )}
      </Space>
    </div>
  );
}
