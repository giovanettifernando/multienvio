// app/(admin)/admin/pagarme/PagarmeClient.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Space, Typography, Tabs, Alert, Spin,
  Switch, Badge, message,
} from 'antd';
import {
  SaveOutlined, ApiOutlined, ExperimentOutlined, CheckCircleOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface PagarmeConfigData {
  secretKey: string;
  publicKey: string;
  sandboxMode: boolean;
  status: string;
  lastUpdated: string;
}

interface PagarmeGetResponse {
  configured: boolean;
  data: PagarmeConfigData | null;
}

// ============================================================================
// API calls
// ============================================================================

async function fetchConfig(): Promise<PagarmeGetResponse> {
  const res = await fetch('/api/admin/integrations/pagarme');
  if (!res.ok) throw new Error('Erro ao carregar configuração');
  const json = await res.json();
  return json.data ?? json;
}

async function saveConfig(data: {
  secretKey: string;
  publicKey: string;
  sandboxMode: boolean;
}): Promise<{ message: string }> {
  const res = await fetch('/api/admin/integrations/pagarme', {
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

export function PagarmeClient() {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState<PagarmeGetResponse | null>(null);
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
        if (cfg.configured && cfg.data) {
          form.setFieldsValue({
            secretKey: cfg.data.secretKey,
            publicKey: cfg.data.publicKey,
            sandboxMode: cfg.data.sandboxMode,
          });
        } else {
          form.setFieldsValue({ sandboxMode: true });
        }
      })
      .catch(err => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setIsLoading(false));
  }, [form]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const result = await saveConfig({
        secretKey: values.secretKey,
        publicKey: values.publicKey,
        sandboxMode: values.sandboxMode ?? true,
      });
      messageApi.success(result.message || 'Configuração salva com sucesso');
      // Reload config to get masked key
      const updated = await fetchConfig();
      setConfig(updated);
      if (updated.configured && updated.data) {
        form.setFieldsValue({
          secretKey: updated.data.secretKey,
          publicKey: updated.data.publicKey,
          sandboxMode: updated.data.sandboxMode,
        });
      }
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
          <Form.Item
            name="secretKey"
            label="Secret Key (sk_test_... ou sk_live_...)"
            rules={[{ required: true, message: 'Informe a secret key' }]}
          >
            <Input.Password placeholder="sk_test_..." />
          </Form.Item>

          <Form.Item
            name="publicKey"
            label="Public Key (pk_test_... ou pk_live_...)"
            rules={[{ required: true, message: 'Informe a public key' }]}
          >
            <Input placeholder="pk_test_..." />
          </Form.Item>

          <Form.Item name="sandboxMode" valuePropName="checked" label="Modo Sandbox (teste)">
            <Switch />
          </Form.Item>

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
                    `Pagar.me configurado — ${cfg.data.sandboxMode ? 'Sandbox' : 'Produção'} — status: ${cfg.data.status}`
                  );
                } else {
                  messageApi.warning('Pagar.me não configurado');
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
            <Title level={3} style={{ margin: 0 }}>Pagar.me</Title>
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
