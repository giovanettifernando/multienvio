'use client';

import { useEffect } from 'react';
import { Form, Input, Switch, Button, Card, Space, Flex, Spin, Alert } from 'antd';
import { SaveOutlined, ApiOutlined } from '@ant-design/icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { paymentGatewaySchema } from '@/lib/integrations/schemas';
import { usePaymentGateway, useSavePaymentGateway, useTestPaymentWebhook } from '@/lib/integrations/hooks';

export default function PaymentGatewayTab() {
  const { data: config, isLoading } = usePaymentGateway();
  const saveGateway = useSavePaymentGateway();
  const testWebhook = useTestPaymentWebhook();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(paymentGatewaySchema),
    defaultValues: {
      provider: 'mercadoPago' as const,
      publicKey: '',
      accessToken: '',
      webhookUrl: '',
      webhookSecret: '',
      active: false,
    },
  });

  useEffect(() => {
    if (config) {
      reset(config);
    }
  }, [config, reset]);

  const onSubmit = async (data: z.infer<typeof paymentGatewaySchema>) => {
    try {
      await saveGateway.mutateAsync(data);
    } catch {
      // Error handled by hook
    }
  };

  const handleTestWebhook = () => {
    testWebhook.mutate();
  };

  return (
    <Spin spinning={isLoading}>
      <Flex vertical gap={16}>
        <Alert
          message="Mercado Pago"
          description="Configure as credenciais do Mercado Pago para processar pagamentos. Esta integração permitirá aceitar PIX, cartão de crédito e outras formas de pagamento."
          type="info"
          showIcon
        />

        <Card
          title="Configuração do Mercado Pago"
          extra={
            <Space>
              <Button
                icon={<ApiOutlined />}
                onClick={handleTestWebhook}
                loading={testWebhook.isPending}
              >
                Testar webhook
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSubmit(onSubmit)}
                loading={isSubmitting}
              >
                Salvar
              </Button>
            </Space>
          }
        >
          <Form layout="vertical">
            <Controller
              name="provider"
              control={control}
              render={({ field }) => <input type="hidden" {...field} />}
            />

            <Form.Item
              label="Public Key"
              validateStatus={errors.publicKey ? 'error' : ''}
              help={errors.publicKey?.message || 'Chave pública para autenticação no frontend'}
            >
              <Controller
                name="publicKey"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="APP_USR-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    style={{ fontFamily: 'monospace' }}
                    aria-label="Public Key do Mercado Pago"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Access Token"
              validateStatus={errors.accessToken ? 'error' : ''}
              help={errors.accessToken?.message || 'Token de acesso para autenticação no backend'}
            >
              <Controller
                name="accessToken"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder="APP_USR-xxxxxxxx-xxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxx"
                    style={{ fontFamily: 'monospace' }}
                    aria-label="Access Token do Mercado Pago"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Webhook URL"
              validateStatus={errors.webhookUrl ? 'error' : ''}
              help={errors.webhookUrl?.message || 'URL onde o Mercado Pago enviará notificações'}
            >
              <Controller
                name="webhookUrl"
                control={control}
                render={({ field }) => (
                  <Input
                    {...field}
                    placeholder="https://seudominio.com.br/api/webhooks/mercadopago"
                    aria-label="Webhook URL"
                  />
                )}
              />
            </Form.Item>

            <Form.Item
              label="Webhook Secret"
              validateStatus={errors.webhookSecret ? 'error' : ''}
              help={errors.webhookSecret?.message || 'Secret para validar assinatura dos webhooks (opcional)'}
            >
              <Controller
                name="webhookSecret"
                control={control}
                render={({ field }) => (
                  <Input.Password
                    {...field}
                    placeholder="Secret para validação (opcional)"
                    style={{ fontFamily: 'monospace' }}
                    aria-label="Webhook Secret"
                  />
                )}
              />
            </Form.Item>

            <Form.Item label="Status" valuePropName="checked">
              <Controller
                name="active"
                control={control}
                render={({ field }) => (
                  <Space>
                    <Switch
                      {...field}
                      checked={field.value}
                      checkedChildren="Ativo"
                      unCheckedChildren="Inativo"
                      aria-label="Status do gateway de pagamento"
                    />
                    <span style={{ color: '#666', fontSize: 14 }}>
                      {field.value ? 'Gateway ativo' : 'Gateway inativo'}
                    </span>
                  </Space>
                )}
              />
            </Form.Item>
          </Form>
        </Card>

        <Card title="Futuras Integrações" type="inner">
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div style={{ padding: '16px 0', color: '#999' }}>
              <p>Integrações planejadas para o futuro:</p>
              <ul style={{ paddingLeft: 24, margin: 0 }}>
                <li>PagSeguro</li>
                <li>Stripe</li>
                <li>PayPal</li>
              </ul>
            </div>
          </Space>
        </Card>
      </Flex>
    </Spin>
  );
}
