'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { useAuthStore } from '@/stores/auth';
import React from 'react';

type LoginValues = {
  email: string;
  senha: string;
};

export default function LoginPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);

  const onFinish = async (values: LoginValues) => {
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.mensagem || 'Erro ao realizar login');
        return;
      }

      login(data);
      message.success('Login realizado com sucesso');
      router.replace('/');
    } catch (error) {
      message.error('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

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

        <Typography.Paragraph style={{ marginTop: 8, textAlign: 'center', fontSize: 12 }} type="secondary">
          Usuários de teste: demo@enviolegal.com / demo123 ou admin@enviolegal.com / admin123
        </Typography.Paragraph>
      </Card>
    </div>
  );
}
