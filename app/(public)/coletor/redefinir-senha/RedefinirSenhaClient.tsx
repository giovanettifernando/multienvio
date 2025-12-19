'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ELCard, ELForm, ELInput, ELButton, ELTypography, ELSpace, ELAlert, useELApp } from '@/shared/ui';
const Card = ELCard;
const Form = ELForm;
const Input = ELInput;
const Button = ELButton;
const Typography = ELTypography;
const Space = ELSpace;
const Alert = ELAlert;
const App = { useApp: useELApp };
import { LockOutlined, CheckCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

function ResetPasswordContent() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      message.error('Token de redefinição não encontrado na URL');
    }
  }, [token, message]);

  const handleSubmit = async (values: { newPassword: string; confirmPassword: string }) => {
    if (!token) {
      message.error('Token de redefinição não encontrado');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/coletor/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          newPassword: values.newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha');
      }

      message.success('Senha redefinida com sucesso!');
      setSuccess(true);

      // Redirecionar para login após 3 segundos
      setTimeout(() => {
        router.push('/coletor/login');
      }, 3000);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Erro ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}>
        <Card style={{ maxWidth: 500, width: '100%' }}>
          <Alert
            message="Link Inválido"
            description="O link de redefinição de senha está incompleto ou inválido. Solicite um novo link."
            type="error"
            showIcon
          />
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
      }}>
        <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
          <Title level={3}>Senha Redefinida!</Title>
          <Text type="secondary">
            Sua senha foi redefinida com sucesso. Você será redirecionado para a página de login em alguns segundos...
          </Text>
          <div style={{ marginTop: 24 }}>
            <Button type="primary" onClick={() => router.push('/coletor/login')}>
              Ir para Login
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px',
    }}>
      <Card style={{ maxWidth: 500, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <LockOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
          <Title level={2} style={{ margin: 0 }}>Redefinir Senha</Title>
          <Text type="secondary">Digite sua nova senha abaixo</Text>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            label="Nova Senha"
            name="newPassword"
            rules={[
              { required: true, message: 'Por favor, digite sua nova senha' },
              { min: 8, message: 'A senha deve ter no mínimo 8 caracteres' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mínimo 8 caracteres"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            label="Confirmar Nova Senha"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Por favor, confirme sua nova senha' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('As senhas não coincidem'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Confirme sua senha"
              size="large"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
              >
                Redefinir Senha
              </Button>

              <Alert
                message="Dicas de Segurança"
                description={
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    <li>Use no mínimo 8 caracteres</li>
                    <li>Combine letras, números e símbolos</li>
                    <li>Não use senhas óbvias ou fáceis de adivinhar</li>
                  </ul>
                }
                type="info"
                showIcon
              />
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}

export default function RedefinirSenhaClient() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <Card style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <Text>Carregando...</Text>
        </Card>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
