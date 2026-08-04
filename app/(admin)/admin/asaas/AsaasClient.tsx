// app/(admin)/admin/asaas/AsaasClient.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Space, Typography, Tabs, Alert, Spin,
  Switch, Badge, message,
} from 'antd';
import {
  SaveOutlined, ApiOutlined, ExperimentOutlined, CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface AsaasConfigData {
  /**
   * Nunca é a chave real — apenas um indicador visual do prefixo esperado
   * para o ambiente atual (sandbox/produção). Ver segurança na rota GET.
   */
  apiKeyPreview: string;
  webhookTokenConfigured: boolean;
  sandboxMode: boolean;
  status: string;
  lastUpdated: string;
}

interface AsaasGetResponse {
  configured: boolean;
  data: AsaasConfigData | null;
}

// ============================================================================
// API calls
// ============================================================================

async function fetchConfig(): Promise<AsaasGetResponse> {
  const res = await fetch('/api/admin/integrations/asaas');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: {
  apiKey: string;
  webhookToken?: string;
  sandboxMode: boolean;
}): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/asaas', {
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

// ============================================================================
// Main component
// ============================================================================

export function AsaasClient() {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState<AsaasGetResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    setIsLoading(true);
    setLoadError(null);
    fetchConfig()
      .then(cfg => {
        setConfig(cfg);
        // SECURITY: a chave de API e o token de webhook NUNCA são devolvidos
        // pelo backend (nem mascarados) — o formulário sempre começa vazio.
        // Só o ambiente (não sensível) é pré-preenchido quando já configurado.
        form.setFieldsValue({
          sandboxMode: cfg.configured && cfg.data ? cfg.data.sandboxMode : true,
        });
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setIsLoading(false));
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result = await saveConfig({
        apiKey: values.apiKey,
        webhookToken: values.webhookToken || undefined,
        sandboxMode: values.sandboxMode ?? true,
      });
      messageApi.success(result.message || 'Configuração salva com sucesso');
      // Limpar os campos sensíveis do formulário — nunca ficam preenchidos
      // após salvar, e recarregar a config não os traria de volta mesmo assim.
      form.setFieldsValue({ apiKey: '', webhookToken: '' });
      const updated = await fetchConfig();
      setConfig(updated);
    } catch (err) {
      if (err instanceof Error) {
        messageApi.error(err.message || 'Erro ao salvar configuração');
      }
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
        <p>Carregando...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="Erro ao carregar configuração" description={loadError} />
      </div>
    );
  }

  const tabs = [
    {
      key: 'config',
      label: <span><ApiOutlined /> Configuração</span>,
      children: (
        <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
          {config?.configured && config.data && (
            <Alert
              type="info"
              showIcon
              message="Já configurado"
              description={`Chave atual: ${config.data.apiKeyPreview}. Para trocar, informe uma chave nova abaixo — o campo não é pré-preenchido por segurança.`}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            name="apiKey"
            label="Chave de API"
            rules={[{ required: true, message: 'Informe a chave de API' }]}
            tooltip="Chave única do Asaas ($aact_hmlg_... em sandbox, $aact_prod_... em produção)"
          >
            <Input.Password placeholder="$aact_hmlg_..." autoComplete="new-password" />
          </Form.Item>

          <Form.Item
            name="webhookToken"
            label="Token de webhook"
            tooltip="Valor definido por nós e cadastrado no painel do Asaas (header asaas-access-token). Sem ele, a validação de webhook falha por padrão."
            rules={[
              {
                validator: (_rule, value) => {
                  if (!value) return Promise.resolve();
                  if (/\s/.test(value)) {
                    return Promise.reject(new Error('O token não pode conter espaços'));
                  }
                  if (value.length < 32 || value.length > 255) {
                    return Promise.reject(new Error('O token deve ter entre 32 e 255 caracteres'));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.Password placeholder="Token cadastrado no painel do Asaas" autoComplete="new-password" />
          </Form.Item>

          <Form.Item name="sandboxMode" valuePropName="checked" label="Modo Sandbox (teste)">
            <Switch />
          </Form.Item>

          <Paragraph type="secondary" style={{ marginTop: -8, marginBottom: 16 }}>
            A URL da API é definida automaticamente pelo ambiente: sandbox usa{' '}
            <code>api-sandbox.asaas.com</code>, produção usa <code>api.asaas.com</code>.
          </Paragraph>

          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
          >
            Salvar configuração
          </Button>
        </Form>
      ),
    },
    {
      key: 'test',
      label: <span><ExperimentOutlined /> Teste</span>,
      children: (
        <Space direction="vertical" style={{ maxWidth: 480 }}>
          <Text type="secondary">
            Verifique se as credenciais estão configuradas corretamente.
          </Text>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={async () => {
              try {
                const cfg = await fetchConfig();
                if (cfg.configured && cfg.data) {
                  messageApi.success(
                    `Asaas configurado — ${cfg.data.sandboxMode ? 'Sandbox' : 'Produção'} — status: ${cfg.data.status}` +
                    (cfg.data.webhookTokenConfigured ? '' : ' (token de webhook não configurado)')
                  );
                } else {
                  messageApi.warning('Asaas não configurado');
                }
              } catch {
                messageApi.error('Erro ao verificar configuração');
              }
            }}
          >
            Verificar configuração
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      {contextHolder}
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>Asaas</Title>
            <Text type="secondary">Gateway de Pagamento</Text>
          </div>
          <Space>
            {config?.configured
              ? <Badge status="success" text="Configurado" />
              : <Badge status="default" text="Não configurado" />}
            {config?.configured && config.data?.status && (
              <Badge
                status={config.data.status === 'ACTIVE' ? 'success' : 'error'}
                text={config.data.status}
              />
            )}
          </Space>
        </div>

        <Card>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
        </Card>
      </Space>
    </div>
  );
}
