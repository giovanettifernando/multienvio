'use client';

import { Suspense, useState, useCallback } from 'react';
import { App, Button, Card, Divider, Form, Input, Space } from 'antd';
import { GoogleOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useColetorSession } from '@/stores/useColetorSession';

type LoginFormValues = {
  email: string;
  password: string;
};

function ColetorLoginForm() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get('next') || '/coletores';
  const setColetor = useColetorSession((state) => state.setColetor);
  const [loading, setLoading] = useState(false);
  const [showResendEmail, setShowResendEmail] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Handle Google login
  const handleGoogleLogin = useCallback(() => {
    setGoogleLoading(true);
    // Redirect to Google OAuth with collector context
    const redirectUrl = encodeURIComponent(next);
    window.location.href = `/api/auth/google?context=collector&redirect=${redirectUrl}`;
  }, [next]);

  async function onFinish(values: LoginFormValues) {
    setLoading(true);
    setShowResendEmail(false);

    try {
      const response = await fetch('/api/coletores/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          message.warning({
            content: data.message,
            duration: 5,
          });
          setShowResendEmail(true);
          setLoading(false);
          return;
        }

        if (data.code === 'ACCOUNT_INACTIVE') {
          message.info({
            content: data.message,
            duration: 5,
          });
          setLoading(false);
          return;
        }

        // Generic error or INVALID_CREDENTIALS
        message.error(data.message || 'E-mail ou senha incorretos');
        setLoading(false);
        return;
      }

      // Update store with coletor data
      setColetor(data.coletor);
      message.success(`Bem-vindo, ${data.coletor.pfNome}`);
      router.replace(next);
    } catch (error) {
      console.error('Login error:', error);
      message.error('Erro ao fazer login. Tente novamente mais tarde.');
      setLoading(false);
    }
  }

  async function handleResendEmail() {
    // TODO: Implement resend email endpoint
    message.info('Funcionalidade temporariamente indisponível. Entre em contato com o suporte.');
  }

  return (
    <Card title="Coletor Autônomo • Login" style={{ width: 400 }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="E-mail"
          name="email"
          rules={[
            { required: true, message: 'E-mail é obrigatório' },
            { type: 'email', message: 'E-mail inválido' },
          ]}
        >
          <Input type="email" placeholder="seu@email.com" />
        </Form.Item>
        <Form.Item
          label="Senha"
          name="password"
          rules={[{ required: true, message: 'Senha é obrigatória' }]}
        >
          <Input.Password placeholder="••••••••" />
        </Form.Item>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Button type="primary" htmlType="submit" block loading={loading} disabled={loading || googleLoading}>
            Entrar
          </Button>

          <Divider plain style={{ margin: '8px 0', color: 'rgba(0,0,0,0.45)' }}>ou</Divider>

          <Button
            block
            icon={<GoogleOutlined />}
            onClick={handleGoogleLogin}
            loading={googleLoading}
            disabled={loading || googleLoading}
          >
            Continuar com Google
          </Button>

          {showResendEmail && (
            <Button block onClick={handleResendEmail}>
              Reenviar e-mail de verificação
            </Button>
          )}
          <Link href="/coletores/cadastro" style={{ width: '100%' }}>
            <Button block>Sou novo coletor / Quero me cadastrar</Button>
          </Link>
        </Space>
      </Form>
    </Card>
  );
}

export default function LoginColetorClient() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f0f2f5',
      }}
    >
      <Suspense
        fallback={
          <Card title="Coletor Autônomo • Login" style={{ width: 400 }}>
            Carregando...
          </Card>
        }
      >
        <ColetorLoginForm />
      </Suspense>
    </div>
  );
}
