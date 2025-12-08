'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, Form, Input, Select, Button, Space, App, Spin, Alert, Tooltip } from 'antd';
import { SaveOutlined, ReloadOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';

interface GatewayConfig {
  environment: 'SANDBOX' | 'PRODUCTION';
  publicKey: string;
  accessToken: string;
  applicationId?: string;
  webhookSecret?: string;
}

interface RevealedFields {
  accessToken: string | null;
  webhookSecret: string | null;
}

export default function PaymentGatewayConfig() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revealLoading, setRevealLoading] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedFields>({
    accessToken: null,
    webhookSecret: null,
  });

  const revealField = useCallback(async (field: 'accessToken' | 'webhookSecret') => {
    // Se já está revelado, esconder
    if (revealed[field] !== null) {
      setRevealed(prev => ({ ...prev, [field]: null }));
      return;
    }

    setRevealLoading(field);
    try {
      const res = await fetch(`/api/admin/payment-gateway/config?reveal=${field}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao revelar');

      const data = await res.json();
      const value = data.config?.[field] || '';

      if (value) {
        setRevealed(prev => ({ ...prev, [field]: value }));
      } else {
        message.warning('Nenhum valor salvo para este campo');
      }
    } catch {
      message.error('Erro ao revelar campo');
    } finally {
      setRevealLoading(null);
    }
  }, [revealed, message]);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setRevealed({ accessToken: null, webhookSecret: null });
    try {
      const res = await fetch('/api/admin/payment-gateway/config', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Erro ao carregar configuração');

      const data = await res.json();

      if (data.config) {
        form.setFieldsValue({
          environment: data.config.environment || 'SANDBOX',
          publicKey: data.config.publicKey || '',
          applicationId: data.config.applicationId || '',
          accessToken: '', // Não retornamos o token por segurança
          webhookSecret: '', // Não retornamos o secret por segurança
        });
      }
    } catch {
      message.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  }, [form]);

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

      // Limpar campos de senha após salvar
      form.setFieldsValue({
        accessToken: '',
        webhookSecret: '',
      });
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
          title="Credenciais do Mercado Pago"
          description="Configure as credenciais para processar pagamentos. As credenciais são criptografadas antes de serem salvas no banco de dados. Para sua segurança, os campos de senha ficam vazios após salvar."
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

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
            tooltip="Token de acesso para autenticação no backend. Deixe vazio para não alterar."
          >
            <Space.Compact style={{ width: '100%' }}>
              {revealed.accessToken ? (
                <Input
                  value={revealed.accessToken}
                  readOnly
                  style={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5' }}
                />
              ) : (
                <Form.Item name="accessToken" noStyle>
                  <Input.Password
                    placeholder="Deixe vazio para não alterar"
                    style={{ fontFamily: 'monospace' }}
                    autoComplete="new-password"
                  />
                </Form.Item>
              )}
              <Tooltip title={revealed.accessToken ? 'Ocultar' : 'Revelar valor salvo'}>
                <Button
                  icon={revealLoading === 'accessToken' ? <Spin size="small" /> : (revealed.accessToken ? <EyeInvisibleOutlined /> : <EyeOutlined />)}
                  onClick={() => revealField('accessToken')}
                  disabled={revealLoading === 'accessToken'}
                />
              </Tooltip>
            </Space.Compact>
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
            tooltip="Secret para validar assinatura dos webhooks. Deixe vazio para não alterar."
          >
            <Space.Compact style={{ width: '100%' }}>
              {revealed.webhookSecret ? (
                <Input
                  value={revealed.webhookSecret}
                  readOnly
                  style={{ fontFamily: 'monospace', backgroundColor: '#f5f5f5' }}
                />
              ) : (
                <Form.Item name="webhookSecret" noStyle>
                  <Input.Password
                    placeholder="Deixe vazio para não alterar"
                    style={{ fontFamily: 'monospace' }}
                    autoComplete="new-password"
                  />
                </Form.Item>
              )}
              <Tooltip title={revealed.webhookSecret ? 'Ocultar' : 'Revelar valor salvo'}>
                <Button
                  icon={revealLoading === 'webhookSecret' ? <Spin size="small" /> : (revealed.webhookSecret ? <EyeInvisibleOutlined /> : <EyeOutlined />)}
                  onClick={() => revealField('webhookSecret')}
                  disabled={revealLoading === 'webhookSecret'}
                />
              </Tooltip>
            </Space.Compact>
          </Form.Item>

          <Alert
            title="Configuração do Webhook"
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
