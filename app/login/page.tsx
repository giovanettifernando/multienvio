'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Form, Input, Button, Card, Typography, App, Spin } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { useCurrentUser, useIsAdmin } from '@/hooks/useCurrentUser';
import React from 'react';

type LoginValues = {
  email: string;
  senha: string;
};

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const login = useAuthStore((s) => s.login);
  const { user: currentUser, loading: userLoading } = useCurrentUser();
  const isAdmin = useIsAdmin();

  // Wait for hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!hydrated || userLoading) return;

    if (currentUser) {
      const returnUrl = searchParams.get('returnUrl');
      if (returnUrl) {
        router.replace(returnUrl);
      } else if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
    }
  }, [currentUser, isAdmin, hydrated, userLoading, router, searchParams]);

  const onFinish = async (values: LoginValues) => {
    setLoading(true);

    try {
      // Use store's login method (email, password)
      const result = await login(values.email, values.senha);

      if (!result.success) {
        message.error(result.error || 'E-mail ou senha inválidos');
        setLoading(false);
        return;
      }

      message.success('Login realizado com sucesso');

      // Redirect based on returnUrl or user role
      const returnUrl = searchParams.get('returnUrl');
      if (returnUrl) {
        router.replace(returnUrl);
      } else if (isAdmin) {
        router.replace('/admin');
      } else {
        router.replace('/');
      }
    } catch {
      message.error('Erro ao conectar com o servidor');
      setLoading(false);
    }
  };

  // Show loading while checking auth state
  if (!hydrated || userLoading || (hydrated && currentUser)) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" tip="Carregando..." />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <Card style={{ width: 420, maxWidth: '100%' }}>
        <Typography.Title level={3} style={{ marginBottom: 16 }}>
          Acessar Envio Legal
        </Typography.Title>
        <Form
          layout="vertical"
          onFinish={onFinish}
        >
          <Form.Item
            label="E-mail"
            name="email"
            rules={[
              { required: true, message: 'Informe seu e-mail' },
              { type: 'email', message: 'E-mail inválido' },
            ]}
          >
            <Input placeholder="seuemail@dominio.com" autoComplete="email" />
          </Form.Item>

          <Form.Item
            label="Senha"
            name="senha"
            rules={[{ required: true, message: 'Informe sua senha' }]}
          >
            <Input.Password placeholder="Sua senha" autoComplete="current-password" />
          </Form.Item>

          <div style={{ marginBottom: 16, textAlign: 'right' }}>
            <Link href="/auth/forgot-password" style={{ fontSize: 14 }}>
              Esqueci minha senha
            </Link>
          </div>

          <Form.Item style={{ marginTop: 8 }}>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Entrar
            </Button>
          </Form.Item>
        </Form>

        <Typography.Paragraph style={{ marginTop: 16, textAlign: 'center' }} type="secondary">
          Ainda não tem conta?{' '}
          <Link href="/auth/cadastro">Crie agora mesmo</Link>
        </Typography.Paragraph>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <Spin size="large" tip="Carregando..." />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
