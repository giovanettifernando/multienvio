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
      title="Configuração do Asaas"
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
          message="Credenciais do Asaas"
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
            label="Public Key (não aplicável ao Asaas)"
            name="publicKey"
            tooltip="O Asaas usa uma única chave de API — não há par público/secreto. Deixe em branco."
          >
            <Input
              placeholder="Não aplicável ao Asaas"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Chave de API (Access Token)"
            name="accessToken"
            tooltip="Chave única do Asaas para autenticação no backend ($aact_hmlg_... em sandbox, $aact_prod_... em produção)"
          >
            <Input.Password
              placeholder="$aact_hmlg_xxxxxxxxxxxxxxxxxxxxxxxx"
              style={{ fontFamily: 'monospace' }}
              autoComplete="new-password"
              visibilityToggle
            />
          </Form.Item>

          <Form.Item
            label="Application ID (não aplicável ao Asaas)"
            name="applicationId"
            tooltip="Não usado pelo Asaas — deixe em branco"
          >
            <Input
              placeholder="Não aplicável ao Asaas"
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          <Form.Item
            label="Token de Webhook do Asaas (Opcional)"
            name="webhookSecret"
            tooltip="Token que você define e cadastra também no painel do Asaas (header asaas-access-token). Sem ele, a validação de webhook falha por padrão."
          >
            <Input.Password
              placeholder="Token cadastrado no painel do Asaas"
              style={{ fontFamily: 'monospace' }}
              autoComplete="new-password"
              visibilityToggle
            />
          </Form.Item>

          <Alert
            message="Configuração do Webhook"
            description={
              <div>
                <p style={{ marginBottom: 8 }}>Configure o webhook no painel do Asaas:</p>
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>URL: <code>https://seudominio.com.br/api/webhooks/asaas</code></li>
                  <li>Eventos: Cobranças (confirmada, recebida, vencida, estornada)</li>
                  <li>Header <code>asaas-access-token</code>: mesmo valor do campo &quot;Token de Webhook&quot; acima</li>
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
