'use client';

import { useEffect, useMemo } from 'react';
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

  // Derivar status e message dos searchParams (sem useEffect/setState)
  const { status, message } = useMemo((): { status: Status; message: string } => {
    if (successParam === 'verified') {
      return { status: 'success', message: 'E-mail verificado com sucesso! Seu cadastro será analisado pela nossa equipe.' };
    }
    if (successParam === 'already_verified') {
      return { status: 'already_verified', message: 'Este e-mail já foi verificado anteriormente.' };
    }
    if (errorParam === 'token_invalid') {
      return { status: 'error', message: 'Link de verificação inválido.' };
    }
    if (errorParam === 'token_not_found') {
      return { status: 'error', message: 'Link de verificação não encontrado ou expirado.' };
    }
    if (errorParam === 'token_expired') {
      return { status: 'expired', message: 'Link de verificação expirado. Por favor, solicite um novo cadastro.' };
    }
    if (errorParam === 'server_error') {
      return { status: 'error', message: 'Erro ao processar verificação. Tente novamente mais tarde.' };
    }
    if (token) {
      return { status: 'loading', message: '' };
    }
    return { status: 'error', message: 'Link de verificação inválido ou ausente.' };
  }, [token, successParam, errorParam]);

  // Redirect para GET endpoint se tiver token
  useEffect(() => {
    if (token && !successParam && !errorParam) {
      window.location.href = `/api/coletores/auth/confirm-email?token=${token}`;
    }
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
