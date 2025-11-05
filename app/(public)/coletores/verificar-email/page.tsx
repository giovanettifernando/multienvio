'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, Result, Button, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, WarningOutlined } from '@ant-design/icons';

type Status = 'loading' | 'success' | 'error' | 'already_verified' | 'expired';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const successParam = searchParams.get('success');
  const errorParam = searchParams.get('error');
  const token = searchParams.get('token');

  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Handle redirected states from GET endpoint
    if (successParam === 'verified') {
      setStatus('success');
      setMessage('E-mail verificado com sucesso! Seu cadastro será analisado pela nossa equipe.');
      return;
    }

    if (successParam === 'already_verified') {
      setStatus('already_verified');
      setMessage('Este e-mail já foi verificado anteriormente.');
      return;
    }

    if (errorParam === 'token_invalid') {
      setStatus('error');
      setMessage('Link de verificação inválido.');
      return;
    }

    if (errorParam === 'token_not_found') {
      setStatus('error');
      setMessage('Link de verificação não encontrado ou expirado.');
      return;
    }

    if (errorParam === 'token_expired') {
      setStatus('expired');
      setMessage('Link de verificação expirado. Por favor, solicite um novo cadastro.');
      return;
    }

    if (errorParam === 'server_error') {
      setStatus('error');
      setMessage('Erro ao processar verificação. Tente novamente mais tarde.');
      return;
    }

    // If there's a token, redirect to GET endpoint
    if (token) {
      window.location.href = `/api/coletores/auth/confirm-email?token=${token}`;
      return;
    }

    // No token and no status params
    setStatus('error');
    setMessage('Link de verificação inválido ou ausente.');
  }, [token, successParam, errorParam]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: '#f5f5f5'
    }}>
      <Card style={{ maxWidth: 600, width: '100%' }}>
        {status === 'loading' && (
          <Result
            icon={<Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />}
            title="Verificando e-mail..."
            subTitle="Por favor, aguarde enquanto verificamos seu e-mail"
          />
        )}

        {status === 'success' && (
          <Result
            status="success"
            icon={<CheckCircleOutlined />}
            title="E-mail verificado!"
            subTitle={message}
            extra={[
              <Button type="primary" key="login" onClick={() => router.push('/coletores')}>
                Ir para Login
              </Button>,
            ]}
          />
        )}

        {status === 'already_verified' && (
          <Result
            status="info"
            icon={<CheckCircleOutlined style={{ color: '#1890ff' }} />}
            title="E-mail já verificado"
            subTitle={message}
            extra={[
              <Button type="primary" key="login" onClick={() => router.push('/coletores')}>
                Ir para Login
              </Button>,
            ]}
          />
        )}

        {status === 'expired' && (
          <Result
            status="warning"
            icon={<WarningOutlined />}
            title="Link expirado"
            subTitle={message}
            extra={[
              <Button type="primary" key="register" onClick={() => router.push('/coletores/cadastro')}>
                Novo Cadastro
              </Button>,
            ]}
          />
        )}

        {status === 'error' && (
          <Result
            status="error"
            icon={<CloseCircleOutlined />}
            title="Erro na verificação"
            subTitle={message}
            extra={[
              <Button type="primary" key="login" onClick={() => router.push('/coletores')}>
                Ir para Login
              </Button>,
              <Button key="register" onClick={() => router.push('/coletores/cadastro')}>
                Novo Cadastro
              </Button>,
            ]}
          />
        )}
      </Card>
    </div>
  );
}
