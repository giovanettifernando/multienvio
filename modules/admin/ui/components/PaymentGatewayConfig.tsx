'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Form, Input, Select, Button, Space, App, Spin, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';

interface GatewayConfig {
  environment: 'SANDBOX' | 'PRODUCTION';
  publicKey: string;
  accessToken: string;
  applicationId?: string;
  webhookSecret?: string;
  accessTokenDecryptionFailed?: boolean;
  webhookSecretDecryptionFailed?: boolean;
}

export default function PaymentGatewayConfig() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [decryptionFailed, setDecryptionFailed] = useState({ accessToken: false, webhookSecret: false });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/payment-gateway/config?reveal=true', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar configuração');

      const json = await res.json();
      const data = json.data ?? json;

      if (data.config) {
        form.setFieldsValue({
          environment: data.config.environment || 'SANDBOX',
          publicKey: data.config.publicKey || '',
          applicationId: data.config.applicationId || '',
          accessToken: data.config.accessToken || '',
          webhookSecret: data.config.webhookSecret || '',
        });
        setDecryptionFailed({
          accessToken: Boolean(data.config.accessTokenDecryptionFailed),
          webhookSecret: Boolean(data.config.webhookSecretDecryptionFailed),
        });
      }
    } catch {
      message.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [form, message]);

  // Carregar configuração atual
  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const onFinish = async (values: GatewayConfig) => {
    setSaving(true);
    try {
      // Remover campos vazios para não sobrescrever
      const payload: Partial<GatewayConfig> = {
        environment: values.environment,
        publicKey: values.publicKey,
      };

      if (values.applicationId) {
        payload.applicationId = values.applicationId;
      }

      if (values.accessToken) {
        payload.accessToken = values.accessToken;
      }

      if (values.webhookSecret) {
        payload.webhookSecret = values.webhookSecret;
      }

      const res = await fetch('/api/admin/payment-gateway/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Erro ao salvar');
      }

      message.success('Configuração salva com sucesso!');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Configuração do Mercado Pago"
      extra={
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadConfig}
            loading={loading}
          >
            Recarregar
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={saving}
          >
            Salvar
          </Button>
        </Space>
      }
    >
      <Spin spinning={loading}>
        <Alert
          message="Credenciais do Mercado Pago"
          description="Configure as credenciais para processar pagamentos. As credenciais são criptografadas antes de serem salvas no banco de dados."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        {(decryptionFailed.accessToken || decryptionFailed.webhookSecret) && (
          <Alert
            type="error"
            icon={<WarningOutlined />}
            message="Erro ao descriptografar credenciais"
            description={`${[
              decryptionFailed.accessToken && 'Access Token',
              decryptionFailed.webhookSecret && 'Webhook Secret',
            ].filter(Boolean).join(' e ')} não ${decryptionFailed.accessToken && decryptionFailed.webhookSecret ? 'puderam' : 'pôde'} ser descriptografado. A ENCRYPTION_KEY do servidor pode ter mudado. Insira o valor novamente para corrigir.`}
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            environment: 'SANDBOX',
          }}
        >
          <Form.Item
            label="Ambiente"
            name="environment"
            rules={[{ required: true, message: 'Selecione o ambiente' }]}
            tooltip="Use SANDBOX para testes e PRODUCTION para pagamentos reais"
          >
            <Select
              options={[
                { label: 'Sandbox (Testes)', value: 'SANDBOX' },
                { label: 'Produção (Pagamentos Reais)', value: 'PRODUCTION' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Public Key"
            name="publicKey"
            rules={[{ required: true, message: 'Public Key é obrigatório' }]}
            tooltip="Chave pública para autenticação no frontend (APP_USR-... ou TEST-...)"
          >
            <Input
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Access Token"
            name="accessToken"
            tooltip="Token de acesso para autenticação no backend"
          >
            <Input.Password
              placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={{ fontFamily: 'monospace' }}
              autoComplete="new-password"
              visibilityToggle
            />
          </Form.Item>

          <Form.Item
            label="Application ID (Número da Aplicação)"
            name="applicationId"
            tooltip="ID da aplicação no Mercado Pago. Encontre em 'Detalhes da aplicação' > 'Número da aplicação'"
          >
            <Input
              placeholder="4013981001613751"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Webhook Secret (Opcional)"
            name="webhookSecret"
            tooltip="Secret para validar assinatura dos webhooks"
          >
            <Input.Password
              placeholder="Secret do webhook"
              style={{ fontFamily: 'monospace' }}
              autoComplete="new-password"
              visibilityToggle
            />
          </Form.Item>

          <Alert
            message="Configuração do Webhook"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>Configure o webhook no painel do Mercado Pago:</p>
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>URL: <code>https://seudominio.com.br/api/webhooks/mercadopago</code></li>
                  <li>Eventos: Pagamentos, Contestações</li>
                </ul>
              </div>
            }
            type="warning"
            showIcon
          />
        </Form>
      </Spin>
    </Card>
  );
}
