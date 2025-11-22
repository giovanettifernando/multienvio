'use client';

import { Suspense, useState } from 'react';
import { App, Button, Card, Form, Input } from 'antd';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCollectorSession } from '@/stores/useCollectorSession';

type LoginFormValues = {
  cnpj: string;
  password: string;
};

function CollectorLoginForm() {
  const { message } = App.useApp();
  const searchParams = useSearchParams();
  const router = useRouter();
  const next = searchParams.get('next') || '/collector';
  const setCollector = useCollectorSession((state) => state.setCollector);
  const [loading, setLoading] = useState(false);

  // Função para formatar CNPJ
  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
    if (numbers.length <= 8)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
    if (numbers.length <= 12)
      return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
    return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
  };

  async function onFinish(values: LoginFormValues) {
    setLoading(true);

    try {
      // Remover formatação do CNPJ
      const cnpj = values.cnpj.replace(/\D/g, '');

      const response = await fetch('/api/pontos-coleta/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cnpj,
          password: values.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        message.error(data.message || 'CNPJ ou senha incorretos');
        setLoading(false);
        return;
      }

      // Update store with collector data
      const collector = {
        pointId: data.collector.pointId,
        cnpj: data.collector.cnpj,
        nomeFantasia: data.collector.nomeFantasia,
      };

      setCollector(collector);
      message.success(`Bem-vindo, ${data.collector.nomeFantasia}`);
      router.replace(next);
    } catch (error) {
      console.error('Login error:', error);
      message.error('Erro ao fazer login');
      setLoading(false);
    }
  }

  return (
    <Card title="Ponto de Coleta • Login" style={{ width: 360 }}>
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item
          label="CNPJ"
          name="cnpj"
          rules={[
            { required: true, message: 'CNPJ é obrigatório' },
            {
              validator: (_, value) => {
                const numbers = value?.replace(/\D/g, '') || '';
                if (numbers.length === 14) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error('CNPJ deve ter 14 dígitos'));
              },
            },
          ]}
          normalize={formatCNPJ}
        >
          <Input placeholder="00.000.000/0000-00" maxLength={18} />
        </Form.Item>
        <Form.Item
          label="Senha"
          name="password"
          rules={[{ required: true, message: 'Senha é obrigatória' }]}
        >
          <Input.Password placeholder="••••••••" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          Entrar
        </Button>
      </Form>
    </Card>
  );
}

export default function CollectorLoginPage() {
  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Suspense
        fallback={
          <Card title="Ponto de Coleta • Login" style={{ width: 360 }}>
            Carregando...
          </Card>
        }
      >
        <CollectorLoginForm />
      </Suspense>
    </div>
  );
}
